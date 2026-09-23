from __future__ import annotations

import json
import os
from datetime import date, datetime
from decimal import Decimal
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

# Các dependency Python nặng được import lazy trong request.
# Nhờ vậy nếu Vercel thiếu dependency/font, API vẫn trả JSON lỗi chi tiết
# thay vì trang 500 trắng do lỗi ngay lúc cold-start/import module.


def _db_url() -> str:
    url = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Thiếu DIRECT_URL/DATABASE_URL.")
    # Prisma đôi khi dùng tham số riêng; psycopg không cần các tham số pool của Prisma.
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
        "pricing_quantity": "pricingQuantity", "unit_price": "unitPrice", "image_path": "imagePath", "raw_block": "rawBlock",
        "row_order": "rowOrder", "detail_type": "detailType", "question_text": "questionText", "sort_order": "sortOrder",
    }
    return {mapping.get(k, k): _json_value(v) for k, v in row.items()}


def load_order(order_id: int) -> dict:
    import psycopg
    from psycopg.rows import dict_row

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

        items = conn.execute("""
            SELECT id, order_id, line_no, set_no, product_name, product_code, model,
                   opening_direction, trim_direction, paint_color, height_mm, width_mm,
                   frame_mm, clear_height_mm, clear_width_mm, panel_info, trim_bars_per_set,
                   trim_type, lock_model, window_bars, leaves_per_set, quantity, unit,
                   pricing_quantity, unit_price, amount, note, image_path, raw_block
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
    for row in items:
        item = _camel(row)
        item["details"] = details_by_item.get(row["id"], [])
        result["items"].append(item)
    result["requirements"] = [_camel(row) for row in requirements]
    return result


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            query = parse_qs(urlparse(self.path).query)
            raw_id = (query.get("orderId") or [""])[0]
            note = (query.get("note") or [""])[0][:1000]
            order_id = int(raw_id)
            order = load_order(order_id)
            from python.reportlab_order_v2 import build_order_pdf_bytes
            pdf = build_order_pdf_bytes(order, export_note=note)
            code = str(order.get("orderCode") or order_id).replace('"', "").replace("/", "-")

            self.send_response(200)
            self.send_header("Content-Type", "application/pdf")
            self.send_header("Content-Disposition", f'attachment; filename="Bao-gia-V2-{code}.pdf"')
            self.send_header("Content-Length", str(len(pdf)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(pdf)
        except ValueError:
            self._error(400, "orderId không hợp lệ.")
        except LookupError as exc:
            self._error(404, str(exc))
        except Exception as exc:
            self._error(500, f"Không thể xuất PDF V2: {exc}")

    def _error(self, status: int, message: str):
        data = json.dumps({"ok": False, "error": message}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)
