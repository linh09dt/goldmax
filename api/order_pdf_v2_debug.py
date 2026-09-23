from __future__ import annotations

import json
import os
import platform
import sys
import tempfile
import time
import traceback
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from http.server import BaseHTTPRequestHandler

VERSION = "V41.16-debug-response"


def _rss_mb():
    try:
        import resource
        v = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        # Linux reports KiB, macOS bytes.
        return round((v / 1024.0) if sys.platform != "darwin" else (v / 1024.0 / 1024.0), 1)
    except Exception:
        return None


def _pages(path: Path) -> int:
    try:
        import re
        return len(re.findall(rb"/Type\s*/Page\b", path.read_bytes()))
    except Exception:
        return 0


def _safe_error(exc: BaseException) -> dict:
    return {
        "type": type(exc).__name__,
        "message": str(exc),
        "traceback": traceback.format_exc()[-12000:],
    }


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        started = time.monotonic()
        tmp: Path | None = None
        stage = "START"
        try:
            q = parse_qs(urlparse(self.path).query)
            test = (q.get("test") or ["all"])[0].strip().lower()
            raw_id = (q.get("orderId") or [""])[0]
            no_images = (q.get("noImages") or ["1"])[0].lower() in {"1", "true", "yes"}
            limit_raw = (q.get("limit") or [""])[0]
            limit = int(limit_raw) if limit_raw else None
            order_id = int(raw_id) if raw_id else None

            result = {
                "ok": True,
                "version": VERSION,
                "test": test,
                "orderId": order_id,
                "noImages": no_images,
                "limit": limit,
                "checks": [],
            }

            def check(name: str, fn):
                nonlocal stage
                stage = name
                t0 = time.monotonic()
                before = _rss_mb()
                value = fn()
                result["checks"].append({
                    "stage": name,
                    "ok": True,
                    "elapsedMs": round((time.monotonic() - t0) * 1000),
                    "rssBeforeMb": before,
                    "rssAfterMb": _rss_mb(),
                    "result": value,
                })
                return value

            if test in {"runtime", "all"}:
                check("01_RUNTIME", lambda: {
                    "python": sys.version,
                    "platform": platform.platform(),
                    "cwd": os.getcwd(),
                    "tmpWritable": os.access("/tmp", os.W_OK),
                    "vercel": bool(os.getenv("VERCEL")),
                })
                if test == "runtime":
                    return self._json(200, result, started)

            if test in {"imports", "all"}:
                def imports():
                    import reportlab
                    import psycopg
                    import PIL
                    import fontpkg
                    from python import reportlab_order_v2 as rv2
                    return {
                        "reportlab": getattr(reportlab, "Version", "?"),
                        "psycopg": getattr(psycopg, "__version__", "?"),
                        "pillow": getattr(PIL, "__version__", "?"),
                        "fontpkgModule": getattr(fontpkg, "__file__", "?"),
                        "reportModule": getattr(rv2, "__file__", "?"),
                    }
                check("02_IMPORTS", imports)
                if test == "imports":
                    return self._json(200, result, started)

            if test in {"font", "all"}:
                def fonts():
                    from python import reportlab_order_v2 as rv2
                    f = rv2.register_fonts()
                    return {"fonts": f}
                check("03_FONT", fonts)
                if test == "font":
                    return self._json(200, result, started)

            if test in {"db", "data", "build", "response", "all"}:
                if order_id is None:
                    raise ValueError("Các test db/data/build/response/all cần orderId, ví dụ ?orderId=14&test=db")
                def db_load():
                    from api.order_pdf_v2 import load_order
                    o = load_order(order_id)
                    return o
                order = check("04_DB_LOAD", db_load)
                # Không trả toàn bộ dữ liệu đơn trong JSON debug.
                result["checks"][-1]["result"] = {
                    "items": len(order.get("items") or []),
                    "details": sum(len(x.get("details") or []) for x in (order.get("items") or [])),
                    "requirements": len(order.get("requirements") or []),
                    "orderCode": order.get("orderCode"),
                }
                if test == "db":
                    return self._json(200, result, started)

                if limit is not None:
                    order = dict(order)
                    order["items"] = list(order.get("items") or [])[:max(0, limit)]

                if test in {"data", "all"}:
                    def data_check():
                        bad = []
                        for i, item in enumerate(order.get("items") or []):
                            for key in ("productName", "productCode", "model", "note", "imagePath"):
                                v = item.get(key)
                                if v is not None and not isinstance(v, (str, int, float, bool)):
                                    bad.append({"item": i + 1, "field": key, "type": type(v).__name__})
                        return {
                            "itemsAfterLimit": len(order.get("items") or []),
                            "badScalarFields": bad[:50],
                        }
                    check("05_DATA_SHAPE", data_check)
                    if test == "data":
                        return self._json(200, result, started)

                if test in {"build", "response", "all"}:
                    def build():
                        nonlocal tmp
                        from python.reportlab_order_v2 import build_order_pdf
                        fd, name = tempfile.mkstemp(prefix=f"goldmax-debug-{order_id}-", suffix=".pdf", dir="/tmp")
                        os.close(fd)
                        tmp = Path(name)
                        build_order_pdf(order, tmp, export_note="DEBUG", include_images=not no_images)
                        size = tmp.stat().st_size
                        return {"bytes": size, "pages": _pages(tmp), "itemsBuilt": len(order.get("items") or [])}
                    build_result = check("06_REPORTLAB_BUILD", build)
                    if test == "build":
                        return self._json(200, result, started)

                    # V41.16: response test THẬT. Dùng chính file PDF vừa được
                    # ReportLab tạo trên Vercel và trả binary application/pdf.
                    # Không trả JSON ở nhánh này. Nếu trình duyệt tải/mở PDF được,
                    # binary response của debug endpoint hoạt động.
                    if test == "response":
                        stage = "07_BINARY_RESPONSE"
                        pdf_bytes = tmp.read_bytes()
                        if not pdf_bytes.startswith(b"%PDF-"):
                            raise RuntimeError("File build xong nhưng không có PDF signature %PDF-.")
                        if len(pdf_bytes) != int(build_result.get("bytes") or 0):
                            raise RuntimeError("Kích thước PDF thay đổi trước khi gửi response.")
                        filename = f"goldmax-debug-response-{order_id}.pdf"
                        self.send_response(200)
                        self.send_header("Content-Type", "application/pdf")
                        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
                        self.send_header("Cache-Control", "no-store")
                        self.send_header("Content-Length", str(len(pdf_bytes)))
                        self.send_header("X-GoldMax-Debug-Version", VERSION)
                        self.send_header("X-GoldMax-Debug-Pages", str(build_result.get("pages") or 0))
                        self.end_headers()
                        self.wfile.write(pdf_bytes)
                        self.wfile.flush()
                        return

            return self._json(200, result, started)
        except Exception as exc:
            payload = {
                "ok": False,
                "version": VERSION,
                "failedStage": stage,
                "elapsedMs": round((time.monotonic() - started) * 1000),
                "rssMb": _rss_mb(),
                "error": _safe_error(exc),
                "hint": "Nếu endpoint trả trang HTML 500 thay vì JSON này, Vercel đã kill function ở tầng platform. Hãy chạy từng test riêng và giảm limit để tìm ngưỡng.",
            }
            self._json(500, payload, started, add_elapsed=False)
        finally:
            if tmp:
                try:
                    tmp.unlink(missing_ok=True)
                except Exception:
                    pass

    def _json(self, status: int, payload: dict, started: float, add_elapsed: bool = True):
        if add_elapsed:
            payload["elapsedMs"] = round((time.monotonic() - started) * 1000)
            payload["rssMb"] = _rss_mb()
        data = json.dumps(payload, ensure_ascii=False, default=str, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
