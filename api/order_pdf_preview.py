"""Endpoint thử nghiệm PDF mẫu mới.

Giữ nguyên /api/order_pdf_v2 hiện tại. Nút test gọi endpoint riêng này để người dùng
đánh giá layout trước khi quyết định thay PDF chính thức.
"""

from __future__ import annotations

import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, quote, urlparse

from api.order_pdf_v2 import _camel, _count_pages, _db_url, load_order


def load_order_preview(order_id: int) -> dict:
    """Dùng dữ liệu PDF V2 hiện tại và bổ sung các field header chỉ cho PDF mẫu mới."""
    order = load_order(order_id)
    try:
        import psycopg
        from psycopg.rows import dict_row

        with psycopg.connect(_db_url(), row_factory=dict_row, connect_timeout=8) as conn:
            extra = conn.execute("""
                SELECT status, delivery_km, region, group_no, excel_update_date,
                       form_code, form_effective_date
                FROM sales_orders WHERE id = %s
            """, (order_id,)).fetchone()
        if extra:
            order.update(_camel(extra))
    except Exception:
        # Header bổ sung không được phép làm hỏng PDF test. Phần dữ liệu chính
        # vẫn đã được load_order() lấy đầy đủ như PDF V2 hiện tại.
        pass
    return order


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        tmp_path: Path | None = None
        response_started = False
        try:
            query = parse_qs(urlparse(self.path).query)
            raw_id = (query.get("orderId") or [""])[0]
            note = (query.get("note") or [""])[0][:1000]
            no_images = (query.get("noImages") or [""])[0].lower() in {"1", "true", "yes"}
            order_id = int(raw_id)

            order = load_order_preview(order_id)
            from python.reportlab_order_preview import build_order_pdf_preview

            fd, name = tempfile.mkstemp(prefix=f"goldmax-pdf-preview-{order_id}-", suffix=".pdf", dir="/tmp")
            os.close(fd)
            tmp_path = Path(name)
            build_order_pdf_preview(order, tmp_path, export_note=note, include_images=not no_images)

            file_size = tmp_path.stat().st_size
            if file_size > 4_300_000:
                raise RuntimeError(f"PDF mẫu mới quá lớn để trả qua Vercel ({file_size / 1024 / 1024:.2f} MB).")

            pdf_bytes = tmp_path.read_bytes()
            pages = _count_pages(tmp_path)
            code = str(order.get("orderCode") or order_id).replace('"', "").replace("/", "-")
            response_started = True
            self._send_pdf(
                pdf_bytes,
                f"Bao-gia-Mau-moi-{code}.pdf",
                pages=pages,
                ascii_filename=f"Bao-gia-Mau-moi-{order_id}.pdf",
            )
        except ValueError:
            if not response_started:
                self._error(400, "orderId không hợp lệ.")
        except LookupError as exc:
            if not response_started:
                self._error(404, str(exc))
        except Exception as exc:
            if not response_started:
                self._error(500, f"Không thể xuất PDF mẫu mới: {exc}")
        finally:
            if tmp_path:
                try:
                    tmp_path.unlink(missing_ok=True)
                except Exception:
                    pass

    def _send_pdf(self, pdf_bytes: bytes, filename: str, pages: int = 0, ascii_filename: str | None = None):
        utf8_filename = filename.replace("\r", "").replace("\n", "")
        fallback = (ascii_filename or "goldmax-preview.pdf").replace("\r", "").replace("\n", "")
        fallback = fallback.encode("ascii", "ignore").decode("ascii") or "goldmax-preview.pdf"
        fallback = fallback.replace('"', "-")
        disposition = f'attachment; filename="{fallback}"; filename*=UTF-8\'\'{quote(utf8_filename, safe="")}'

        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Disposition", disposition)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(pdf_bytes)))
        self.send_header("X-GoldMax-PDF-Version", "PREVIEW-1")
        if pages:
            self.send_header("X-GoldMax-PDF-Pages", str(pages))
        self.end_headers()
        self.wfile.write(pdf_bytes)
        self.wfile.flush()

    def _error(self, status: int, message: str):
        data = json.dumps({"ok": False, "version": "PREVIEW-1", "error": message}, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)
        self.wfile.flush()
