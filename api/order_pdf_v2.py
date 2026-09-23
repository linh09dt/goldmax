from __future__ import annotations

import json
import os
import tempfile
import time
from datetime import date, datetime
from decimal import Decimal
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse


def _log(stage: str, **extra) -> None:
    payload = {"stage": stage, **extra}
    print("[PDF_V2] " + json.dumps(payload, ensure_ascii=False, default=str), flush=True)


def _db_url() -> str:
    url = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Thiếu DIRECT_URL/DATABASE_URL.")
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    for key in ["pgbouncer", "connection_limit", "pool_timeout"]:
        query.pop(key, None)
    clean_query = "&".join(f"{k}={v[-1]}" for k, v in query.items() if v)
    return parsed._replace(query=clean_query).geturl()


def _json_value(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _camel(row: dict) -> dict:
    mapping = {
        "order_code": "orderCode", "customer_code": "customerCode", "customer_name": "customerName",
        "sales_employee_code": "salesEmployeeCode", "order_date": "orderDate", "required_delivery_date": "requiredDeliveryDate",
        "receiver_name": "receiverName", "receiver_phone": "receiverPhone", "receiver_address": "receiverAddress",
        "shipping_fee": "shippingFee", "discount_percent": "discountPercent", "deposit_amount": "depositAmount",
        "warehouse_receipt_deduction": "warehouseReceiptDeduction", "line_no": "lineNo", "set_no": "setNo",
        "product_name": "productName", "product_code": "productCode", "opening_direction": "openingDirection",
        "trim_direction": "trimDirection", "paint_color": "paintColor", "height_mm": "heightMm", "width_mm": "widthMm",
        "frame_mm": "frameMm", "clear_height_mm": "clearHeightMm", "clear_width_mm": "clearWidthMm",
        "panel_info": "panelInfo", "trim_bars_per_set": "trimBarsPerSet", "trim_type": "trimType",
        "lock_model": "lockModel", "window_bars": "windowBars", "leaves_per_set": "leavesPerSet",
        "pricing_quantity": "pricingQuantity", "unit_price": "unitPrice", "image_path": "imagePath",
        "row_order": "rowOrder", "detail_type": "detailType", "question_text": "questionText", "sort_order": "sortOrder",
    }
    return {mapping.get(k, k): _json_value(v) for k, v in row.items()}


def load_order(order_id: int) -> dict:
    import psycopg
    from psycopg.rows import dict_row

    started = time.monotonic()
    with psycopg.connect(_db_url(), row_factory=dict_row, connect_timeout=8) as conn:
        order = conn.execute("""
            SELECT id, order_code, customer_code, customer_name, sales_employee_code,
                   order_date, required_delivery_date, receiver_name, receiver_phone,
                   receiver_address, shipping_fee, discount_percent, deposit_amount,
                   warehouse_receipt_deduction
            FROM sales_orders WHERE id = %s
        """, (order_id,)).fetchone()
        if not order:
            raise LookupError("Không tìm thấy đơn hàng.")

        # V41.11: không lấy raw_block cho toàn bộ đơn. Trường này chỉ là dữ liệu import
        # dự phòng và có thể rất lớn với đơn nhiều bộ, gây tăng RAM/network trên serverless.
        items = conn.execute("""
            SELECT id, order_id, line_no, set_no, product_name, product_code, model,
                   opening_direction, trim_direction, paint_color, height_mm, width_mm,
                   frame_mm, clear_height_mm, clear_width_mm, panel_info, trim_bars_per_set,
                   trim_type, lock_model, window_bars, leaves_per_set, quantity, unit,
                   pricing_quantity, unit_price, amount, note, image_path
            FROM sales_order_items WHERE order_id = %s ORDER BY line_no ASC
        """, (order_id,)).fetchall()

        item_ids = [row["id"] for row in items]
        details_by_item: dict[int, list[dict]] = {item_id: [] for item_id in item_ids}
        if item_ids:
            details = conn.execute("""
                SELECT id, order_item_id, row_order, detail_type, set_no, product_name,
                       product_code, model, opening_direction, trim_direction, paint_color,
                       height_mm, width_mm, frame_mm, clear_height_mm, clear_width_mm,
                       panel_info, trim_bars_per_set, trim_type, lock_model, window_bars,
                       leaves_per_set, quantity, unit, pricing_quantity, unit_price, amount,
                       note, image_path
                FROM sales_order_item_details
                WHERE order_item_id = ANY(%s)
                ORDER BY order_item_id ASC, row_order ASC
            """, (item_ids,)).fetchall()
            for row in details:
                details_by_item[row["order_item_id"]].append(_camel(row))

        requirements = conn.execute("""
            SELECT question_text, answer, note, sort_order
            FROM sales_order_requirements WHERE order_id = %s ORDER BY sort_order ASC
        """, (order_id,)).fetchall()

    result = _camel(order)
    result["items"] = []
    detail_count = 0
    for row in items:
        item = _camel(row)
        item_details = details_by_item.get(row["id"], [])
        detail_count += len(item_details)
        item["details"] = item_details
        result["items"].append(item)
    result["requirements"] = [_camel(row) for row in requirements]
    _log("db_loaded", orderId=order_id, items=len(items), details=detail_count,
         requirements=len(requirements), elapsedMs=round((time.monotonic() - started) * 1000))
    return result


def _count_pages(path: Path) -> int:
    try:
        data = path.read_bytes()
        # /Type /Pages cũng chứa prefix /Type /Page, nên loại bằng regex đơn giản.
        import re
        return len(re.findall(rb"/Type\s*/Page\b", data))
    except Exception:
        return 0


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        VERSION = "V41.19-root-fix"
        tmp_path: Path | None = None
        trace: list[dict] = []

        def mark(stage: str, **extra):
            row = {"stage": stage, "elapsedMs": round((time.monotonic() - started) * 1000), **extra}
            trace.append(row)
            _log(stage, **extra)
        response_started = False
        started = time.monotonic()
        try:
            query = parse_qs(urlparse(self.path).query)
            raw_id = (query.get("orderId") or [""])[0]
            note = (query.get("note") or [""])[0][:1000]
            no_images = (query.get("noImages") or [""])[0].lower() in {"1", "true", "yes"}
            diag_mode = (query.get("diag") or [""])[0].strip().lower()
            diag_db = diag_mode in {"1", "true", "yes", "db"}
            diag_build = diag_mode in {"build", "pdf"}
            diag_trace = diag_mode == "trace"

            # V41.14: smoke test không chạm DB. Dùng để xác nhận riêng tầng
            # Python runtime + binary PDF response trên Vercel.
            if diag_mode == "smoke":
                from io import BytesIO
                from reportlab.pdfgen import canvas as pdfcanvas

                buf = BytesIO()
                c = pdfcanvas.Canvas(buf)
                c.drawString(72, 800, "GoldMax PDF V2 smoke test")
                c.save()
                pdf = buf.getvalue()
                self._send_pdf(pdf, "goldmax-pdf-v2-smoke.pdf", pages=1)
                return

            order_id = int(raw_id)

            mark("01_START", orderId=order_id, noImages=no_images, diag=diag_mode or "off")
            mark("02_DB_LOAD_START")
            order = load_order(order_id)
            mark("03_DB_LOAD_DONE", items=len(order.get("items") or []), details=sum(len(x.get("details") or []) for x in (order.get("items") or [])))
            if diag_db:
                detail_count = sum(len(item.get("details") or []) for item in order.get("items") or [])
                self._json(200, {
                    "ok": True,
                    "version": "V41.19",
                    "stage": "db",
                    "orderId": order_id,
                    "items": len(order.get("items") or []),
                    "details": detail_count,
                    "requirements": len(order.get("requirements") or []),
                    "noImages": no_images,
                })
                return

            mark("04_REPORTLAB_IMPORT_START")
            from python.reportlab_order_v2 import build_order_pdf
            mark("05_REPORTLAB_IMPORT_DONE")

            mark("06_TMP_CREATE_START")
            fd, name = tempfile.mkstemp(prefix=f"goldmax-pdf-v2-{order_id}-", suffix=".pdf", dir="/tmp")
            os.close(fd)
            tmp_path = Path(name)
            mark("07_TMP_CREATE_DONE", tmp=str(tmp_path))

            build_started = time.monotonic()
            mark("08_BUILD_START", includeImages=not no_images, noteLength=len(note))
            build_order_pdf(order, tmp_path, export_note=note, include_images=not no_images)
            mark("09_BUILD_DONE")
            file_size = tmp_path.stat().st_size
            pages = _count_pages(tmp_path)
            mark("10_PDF_STAT_DONE", orderId=order_id, bytes=file_size, pages=pages, buildElapsedMs=round((time.monotonic() - build_started) * 1000))

            # Chẩn đoán riêng bước ReportLab: tạo xong PDF nhưng chỉ trả JSON nhỏ.
            # Nếu diag=build chạy OK trên Vercel mà tải PDF thường lỗi, nguyên nhân nằm
            # ở tầng response/transport chứ không phải DB hoặc phân trang ReportLab.
            if diag_build:
                self._json(200, {
                    "ok": True,
                    "version": "V41.19",
                    "stage": "build",
                    "orderId": order_id,
                    "pages": pages,
                    "bytes": file_size,
                    "noImages": no_images,
                    "elapsedMs": round((time.monotonic() - started) * 1000),
                })
                return

            # Vercel Function response có hard limit 4.5 MB. Chặn trước để trả lỗi rõ ràng.
            if file_size > 4_300_000:
                raise RuntimeError(
                    f"PDF V2 quá lớn để trả trực tiếp qua Vercel ({file_size / 1024 / 1024:.2f} MB)."
                )

            # V41.13: đọc file đã giới hạn <= 4.3 MB và write đúng MỘT lần.
            # Tránh gửi nhiều chunk qua BaseHTTPRequestHandler trên Python Runtime,
            # vì lỗi transport sau khi headers đã gửi sẽ bị Vercel thay bằng HTML 500.
            mark("11_READ_START")
            pdf_bytes = tmp_path.read_bytes()
            mark("12_READ_DONE", bytes=len(pdf_bytes), signature=pdf_bytes[:5].decode("ascii", "replace"))
            if len(pdf_bytes) != file_size:
                raise RuntimeError("Dung lượng PDF thay đổi trong lúc chuẩn bị response.")

            code = str(order.get("orderCode") or order_id).replace('"', "").replace("/", "-")
            filename = f"Bao-gia-V2-{code}.pdf"
            mark("13_RESPONSE_READY", filename=filename)

            # V41.18: chạy CHÍNH pipeline endpoint thật nhưng dừng ngay trước binary response.
            # Dùng để xác định lỗi nằm trước hay trong bước gửi file qua Vercel.
            if diag_trace:
                return self._json(200, {
                    "ok": True, "version": VERSION, "stage": "response_ready",
                    "orderId": order_id, "noImages": no_images, "pages": pages,
                    "bytes": len(pdf_bytes), "trace": trace,
                })

            mark("14_HEADERS_WRITE_START")
            response_started = True
            self._send_pdf(pdf_bytes, filename, pages=pages, ascii_filename=f"Bao-gia-V2-{order_id}.pdf")
            mark("15_RESPONSE_DONE", orderId=order_id, bytes=len(pdf_bytes), pages=pages)
            return
        except ValueError as exc:
            # UnicodeEncodeError kế thừa ValueError. Nếu lỗi xảy ra sau khi response
            # đã bắt đầu thì tuyệt đối không gửi status line thứ hai.
            mark("99_ERROR", error=repr(exc), errorType=type(exc).__name__, responseStarted=response_started)
            if not response_started:
                self._error(400, "orderId không hợp lệ.")
        except LookupError as exc:
            mark("99_ERROR", error=repr(exc), errorType=type(exc).__name__, responseStarted=response_started)
            if not response_started:
                self._error(404, str(exc))
        except Exception as exc:
            mark("99_ERROR", error=repr(exc), errorType=type(exc).__name__, responseStarted=response_started)
            # Khi binary response đã bắt đầu, tuyệt đối không ghi thêm một HTTP response
            # thứ hai. Việc send_response(500) sau 200 headers có thể làm transport của
            # Vercel coi response là hỏng và trả HTML Internal Server Error.
            if not response_started:
                self._error(500, f"Không thể xuất PDF V2: {exc}")
        finally:
            if tmp_path:
                try:
                    tmp_path.unlink(missing_ok=True)
                except Exception:
                    pass

    def _send_pdf(self, pdf_bytes: bytes, filename: str, pages: int = 0, ascii_filename: str | None = None):
        # V41.19 root cause fix:
        # BaseHTTPRequestHandler.send_header() mã hóa header bằng latin-1 strict.
        # Vì vậy filename= phải chỉ chứa ASCII; tên Unicode thật đi qua filename*=UTF-8''.
        # Giữ Content-Length + flush() theo binary response pattern đã test OK ở debug V41.16.
        utf8_filename = filename.replace("\r", "").replace("\n", "")
        fallback = (ascii_filename or "goldmax-order.pdf").replace("\r", "").replace("\n", "")
        fallback = fallback.encode("ascii", "ignore").decode("ascii") or "goldmax-order.pdf"
        fallback = fallback.replace('"', "-")
        content_disposition = (
            f'attachment; filename="{fallback}"; '
            f"filename*=UTF-8''{quote(utf8_filename, safe='')}"
        )

        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Disposition", content_disposition)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(pdf_bytes)))
        self.send_header("X-GoldMax-PDF-Version", "V41.19")
        if pages:
            self.send_header("X-GoldMax-PDF-Pages", str(pages))
        self.end_headers()
        self.wfile.write(pdf_bytes)
        self.wfile.flush()

    def _json(self, status: int, payload: dict):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)
        self.wfile.flush()

    def _error(self, status: int, message: str):
        self._json(status, {"ok": False, "version": "V41.19", "error": message})
