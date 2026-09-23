"""GOLDMAX - PDF V2 bằng ReportLab.

Dùng độc lập:
    python python/reportlab_order_v2.py --input order.json --output bao-gia-v2.pdf

Payload JSON là dữ liệu đơn hàng đã chuẩn hóa của web app. Ứng dụng hiện tại import
Excel vào PostgreSQL/Supabase trước, sau đó API PDF V2 truyền payload cùng cấu trúc
vào hàm build_order_pdf().
"""

from __future__ import annotations

import argparse
import io
import json
import math
import os
import re
import urllib.request
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterable

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import (
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

PAGE_W, PAGE_H = landscape(A4)
LEFT = RIGHT = 12 * mm
TOP = BOTTOM = 10 * mm
CONTENT_W = PAGE_W - LEFT - RIGHT  # 273 mm

NAVY = colors.HexColor("#1E3A8A")
AMBER = colors.HexColor("#D97706")
TEXT = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#6B7280")
LIGHT = colors.HexColor("#F3F4F6")
BORDER = colors.HexColor("#D1D5DB")
PALE_AMBER = colors.HexColor("#FFF7E6")
WHITE = colors.white

COMPANY = "CÔNG TY TNHH SXTM GOLDMAX VIỆT NAM"
COMPANY_LINE = "Địa chỉ: Cụm CN Non Sáo, Xã Tân Dĩnh, Bắc Ninh  |  SĐT: 1900 8135  |  Email: Goldmaxdoor@gmail.com"
TITLE = "XÁC NHẬN ĐƠN HÀNG & BÁO GIÁ"


def _find_font_file(names: Iterable[str]) -> str | None:
    roots = [
        Path(os.getenv("REPORTLAB_FONT_DIR", "")) if os.getenv("REPORTLAB_FONT_DIR") else None,
        Path("public/fonts"),
        Path("/usr/share/fonts/truetype/dejavu"),
        Path("/usr/share/fonts/truetype"),
        Path("/usr/share/fonts"),
    ]
    for root in roots:
        if not root or not root.exists():
            continue
        for name in names:
            direct = root / name
            if direct.exists():
                return str(direct)
        try:
            for path in root.rglob("*.ttf"):
                lower = path.name.lower()
                if any(name.lower() == lower for name in names):
                    return str(path)
        except OSError:
            pass
    return None


def register_fonts() -> dict[str, str]:
    regular = os.getenv("REPORTLAB_FONT_PATH") or _find_font_file([
        "DejaVuSans.ttf", "NotoSans-Regular.ttf", "Arial.ttf", "LiberationSans-Regular.ttf"
    ])
    bold = os.getenv("REPORTLAB_FONT_BOLD_PATH") or _find_font_file([
        "DejaVuSans-Bold.ttf", "NotoSans-Bold.ttf", "Arial Bold.ttf", "LiberationSans-Bold.ttf"
    ])
    italic = os.getenv("REPORTLAB_FONT_ITALIC_PATH") or _find_font_file([
        "DejaVuSans-Oblique.ttf", "NotoSans-Italic.ttf", "Arial Italic.ttf", "LiberationSans-Italic.ttf"
    ])

    if regular:
        pdfmetrics.registerFont(TTFont("GM-Regular", regular))
        pdfmetrics.registerFont(TTFont("GM-Bold", bold or regular))
        pdfmetrics.registerFont(TTFont("GM-Italic", italic or regular))
        return {"regular": "GM-Regular", "bold": "GM-Bold", "italic": "GM-Italic"}

    # Fallback cuối cùng. Trên Vercel nên có DejaVu/Noto hoặc cấu hình REPORTLAB_FONT_PATH
    # để tiếng Việt hiển thị đầy đủ.
    return {"regular": "Helvetica", "bold": "Helvetica-Bold", "italic": "Helvetica-Oblique"}


FONTS = register_fonts()


def pstyle(name: str, *, size: float = 8, leading: float | None = None, font: str = "regular",
           color: colors.Color = TEXT, align: int = TA_LEFT, **kwargs: Any) -> ParagraphStyle:
    return ParagraphStyle(
        name,
        parent=getSampleStyleSheet()["BodyText"],
        fontName=FONTS[font],
        fontSize=size,
        leading=leading or size * 1.18,
        textColor=color,
        alignment=align,
        spaceBefore=0,
        spaceAfter=0,
        **kwargs,
    )


S = {
    "company": pstyle("company", size=12, font="bold", color=NAVY),
    "company_line": pstyle("company_line", size=8.5, color=MUTED),
    "title": pstyle("title", size=14, font="bold", color=NAVY, align=TA_RIGHT),
    "order_code": pstyle("order_code", size=8.5, font="bold", color=AMBER, align=TA_RIGHT),
    "meta": pstyle("meta", size=8.0),
    "meta_bold": pstyle("meta_bold", size=8.0, font="bold"),
    "th": pstyle("th", size=6.5, leading=7.2, font="bold", color=WHITE, align=TA_CENTER),
    "main": pstyle("main", size=6.8, leading=7.8, font="bold"),
    "body": pstyle("body", size=6.7, leading=7.7),
    "detail": pstyle("detail", size=6.5, leading=7.4, font="italic", color=MUTED),
    "num": pstyle("num", size=6.7, leading=7.7, align=TA_RIGHT),
    "num_bold": pstyle("num_bold", size=6.7, leading=7.7, font="bold", align=TA_RIGHT),
    "center": pstyle("center", size=6.7, leading=7.7, align=TA_CENTER),
    "note": pstyle("note", size=6.6, leading=7.6),
    "export_note": pstyle("export_note", size=9, leading=10.5, font="bold", color=AMBER, align=TA_CENTER),
    "check_title": pstyle("check_title", size=7.7, font="bold", color=NAVY),
    "check": pstyle("check", size=6.7, leading=8.1),
    "summary": pstyle("summary", size=7.5),
    "summary_bold": pstyle("summary_bold", size=7.5, font="bold"),
    "summary_amount": pstyle("summary_amount", size=7.5, font="bold", align=TA_RIGHT),
    "summary_total": pstyle("summary_total", size=7.5, font="bold", color=WHITE),
    "summary_total_amount": pstyle("summary_total_amount", size=7.5, font="bold", color=WHITE, align=TA_RIGHT),
    "words": pstyle("words", size=6.4, leading=7.4, font="italic", color=MUTED, align=TA_RIGHT),
    "sign": pstyle("sign", size=7.3, leading=8.5, font="bold", align=TA_CENTER),
    "sign_sub": pstyle("sign_sub", size=6.3, leading=7.3, color=MUTED, align=TA_CENTER),
}


def esc(value: Any) -> str:
    text = "" if value is None else str(value)
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def para(value: Any, style: str = "body") -> Paragraph:
    return Paragraph(esc(value).replace("\n", "<br/>"), S[style])


def money(value: Any) -> str:
    n = number(value)
    if n is None:
        return ""
    return f"{int(round(n)):,}".replace(",", ".")


def decimal4(value: Any) -> str:
    n = number(value)
    if n is None:
        return ""
    return f"{n:.4f}".rstrip("0").rstrip(".")


def integer(value: Any) -> str:
    n = number(value)
    if n is None or n == 0:
        return ""
    return f"{int(round(n))}"


def number(value: Any) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(float(value)) else None
    text = str(value).strip().replace(",", "")
    try:
        n = float(text)
    except ValueError:
        return None
    return n if math.isfinite(n) else None


def clean(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text in {"", "-", "—"} else text


def fmt_date(value: Any) -> str:
    if not value:
        return ""
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y"):
        try:
            return datetime.strptime(text[:19], fmt).strftime("%d/%m/%Y")
        except ValueError:
            continue
    return text


def has_pricing(value: Any) -> bool:
    n = number(value)
    return n is not None and n > 0


def line_amount(row: dict[str, Any]) -> float:
    explicit = number(row.get("amount"))
    if explicit is not None and explicit > 0:
        return explicit
    return (number(row.get("pricingQuantity")) or 0) * (number(row.get("unitPrice")) or 0)


def build_groups(order: dict[str, Any]) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    for item in order.get("items") or []:
        rows: list[dict[str, Any]] = []
        if has_pricing(item.get("pricingQuantity")):
            rows.append({"row": item, "main": True, "first": True})
        details = item.get("details") or []
        if not details and isinstance(item.get("rawBlock"), list):
            details = raw_block_details(item.get("rawBlock") or [])
        for detail in details:
            if has_pricing(detail.get("pricingQuantity")):
                rows.append({"row": detail, "main": False, "first": len(rows) == 0})
        if rows:
            groups.append({
                "lineNo": item.get("lineNo"),
                "setNo": item.get("setNo"),
                "imagePath": item.get("imagePath"),
                "rows": rows,
            })
    return groups


def raw_block_details(block: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for raw in block[1:]:
        if not isinstance(raw, dict):
            continue
        out.append({
            "productName": raw.get("C"), "productCode": raw.get("D"), "model": raw.get("E"),
            "openingDirection": raw.get("F"), "trimDirection": raw.get("G"), "paintColor": raw.get("H"),
            "heightMm": raw.get("I"), "widthMm": raw.get("J"), "frameMm": raw.get("K"),
            "clearHeightMm": raw.get("L"), "clearWidthMm": raw.get("M"), "panelInfo": raw.get("N"),
            "quantity": raw.get("T"), "unit": raw.get("U"), "pricingQuantity": raw.get("V"),
            "unitPrice": raw.get("W"), "amount": raw.get("X"), "note": raw.get("Y"),
        })
    return out


def totals(order: dict[str, Any], groups: list[dict[str, Any]]) -> dict[str, float]:
    goods = round(sum(line_amount(entry["row"]) for g in groups for entry in g["rows"]), 2)
    shipping = max(0.0, number(order.get("shippingFee")) or 0.0)
    order_total = round(goods + shipping, 2)
    discount_pct = max(0.0, min(100.0, number(order.get("discountPercent")) if number(order.get("discountPercent")) is not None else 12.0))
    discount = round(order_total * discount_pct / 100.0, 2)
    after = round(max(0.0, order_total - discount), 2)
    deposit = max(0.0, number(order.get("depositAmount")) or 0.0)
    warehouse = max(0.0, number(order.get("warehouseReceiptDeduction")) or 0.0)
    due = round(max(0.0, after - deposit - warehouse), 2)
    return {
        "goods": goods, "shipping": shipping, "orderTotal": order_total, "discountPercent": discount_pct,
        "discountAmount": discount, "afterDiscount": after, "deposit": deposit,
        "warehouse": warehouse, "paymentDue": due,
    }


def _download_image(url: str, max_bytes: int = 5_000_000) -> io.BytesIO | None:
    if not url or not re.match(r"^https?://", url, re.I):
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "GoldMax-PDF-V2/1.0"})
        with urllib.request.urlopen(req, timeout=4) as resp:
            data = resp.read(max_bytes + 1)
            if len(data) > max_bytes:
                return None
            return io.BytesIO(data)
    except Exception:
        return None


def _image_flowable(url: str) -> Any:
    stream = _download_image(url)
    if not stream:
        return para("", "center")
    try:
        img = Image(stream, width=11 * mm, height=11 * mm, kind="proportional")
        img.hAlign = "CENTER"
        return img
    except Exception:
        return para("", "center")


class NumberedCanvas(pdfcanvas.Canvas):
    def __init__(self, *args: Any, order_code: str = "", **kwargs: Any):
        super().__init__(*args, **kwargs)
        self._saved_page_states: list[dict[str, Any]] = []
        self._order_code = order_code

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        page_count = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_footer(page_count)
            pdfcanvas.Canvas.showPage(self)
        pdfcanvas.Canvas.save(self)

    def _draw_footer(self, page_count: int) -> None:
        self.saveState()
        y = 5.5 * mm
        self.setStrokeColor(colors.HexColor("#E5E7EB"))
        self.setLineWidth(0.5)
        self.line(LEFT, y + 4 * mm, PAGE_W - RIGHT, y + 4 * mm)
        self.setFillColor(MUTED)
        self.setFont(FONTS["regular"], 6.5)
        self.drawString(LEFT, y, f"{COMPANY} - Báo giá Đơn hàng #{self._order_code}")
        self.drawRightString(PAGE_W - RIGHT, y, f"Trang {self._pageNumber} / {page_count}")
        self.restoreState()


def build_order_pdf(order: dict[str, Any], output: str | os.PathLike[str] | io.BytesIO, export_note: str = "") -> None:
    groups = build_groups(order)
    calc = totals(order, groups)
    order_code = clean(order.get("orderCode")) or f"DH-{order.get('id', '')}"

    doc = SimpleDocTemplate(
        output,
        pagesize=landscape(A4),
        leftMargin=LEFT,
        rightMargin=RIGHT,
        topMargin=TOP,
        bottomMargin=BOTTOM,
        title=f"{TITLE} - {order_code}",
        author=COMPANY,
        subject="Báo giá đơn hàng GOLDMAX V2",
    )

    story: list[Any] = []
    story.extend(_header(order, order_code))
    story.append(Spacer(1, 3 * mm))
    story.append(_data_table(groups))

    if export_note.strip():
        story.append(Spacer(1, 2.5 * mm))
        note_box = Table([[para(export_note.strip(), "export_note")]], colWidths=[CONTENT_W])
        note_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), PALE_AMBER),
            ("BOX", (0, 0), (-1, -1), 1.2, AMBER),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(note_box)

    story.append(Spacer(1, 3 * mm))
    story.append(KeepTogether([_bottom_section(order, calc)]))
    story.append(Spacer(1, 4 * mm))
    story.append(KeepTogether([_signatures()]))

    doc.build(
        story,
        canvasmaker=lambda *args, **kwargs: NumberedCanvas(*args, order_code=order_code, **kwargs),
    )


def build_order_pdf_bytes(order: dict[str, Any], export_note: str = "") -> bytes:
    output = io.BytesIO()
    build_order_pdf(order, output, export_note=export_note)
    return output.getvalue()


def _header(order: dict[str, Any], order_code: str) -> list[Any]:
    left = [para(COMPANY, "company"), Spacer(1, 1.2 * mm), para(COMPANY_LINE, "company_line")]
    right = [para(TITLE, "title"), Spacer(1, 1.2 * mm), para(f"Mã ĐH: {order_code}", "order_code")]
    header = Table([[left, right]], colWidths=[CONTENT_W * 0.60, CONTENT_W * 0.40])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    meta = [
        [
            _meta("Đại lý / Khách hàng", clean(order.get("customerName")) or clean(order.get("receiverName")) or clean(order.get("customerCode"))),
            _meta("Mã Đơn Sản Xuất", order_code),
            _meta("Ngày Đặt Hàng", fmt_date(order.get("orderDate"))),
        ],
        [
            _meta("Mã Đại Lý", clean(order.get("customerCode"))),
            _meta("Địa Chỉ Lắp Đặt", clean(order.get("receiverAddress"))),
            _meta("Ngày Trả Dự Kiến", fmt_date(order.get("requiredDeliveryDate"))),
        ],
    ]
    meta_table = Table(meta, colWidths=[CONTENT_W * 0.40, CONTENT_W * 0.34, CONTENT_W * 0.26], rowHeights=[8.2 * mm, 8.2 * mm])
    meta_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.65, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E5E7EB")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return [header, Spacer(1, 2.5 * mm), meta_table]


def _meta(label: str, value: str) -> Paragraph:
    return Paragraph(
        f'<font name="{FONTS["regular"]}" color="#6B7280">{esc(label)}:</font> '
        f'<font name="{FONTS["bold"]}" color="#1F2937">{esc(value)}</font>',
        S["meta"],
    )


def _data_table(groups: list[dict[str, Any]]) -> Table:
    headers = [
        "STT", "BỘ SỐ", "TÊN SẢN PHẨM / QUY CÁCH", "MODEL", "Ô TH.", "HƯỚNG", "PHÀO", "MÀU SƠN",
        "KT CỬA (MM)", "KHUÔN", "SL", "ĐVT", "KHỐI LƯỢNG", "ĐƠN GIÁ (Đ)", "THÀNH TIỀN (Đ)", "GHI CHÚ KỸ THUẬT", "HÌNH ẢNH SP",
    ]
    data: list[list[Any]] = [[para(h, "th") for h in headers]]
    main_row_numbers: list[int] = []
    detail_row_numbers: list[int] = []
    group_ranges: list[tuple[int, int]] = []

    for group in groups:
        group_start = len(data)
        for entry in group["rows"]:
            row = entry["row"]
            main = bool(entry["main"])
            first = bool(entry["first"])
            h = integer(row.get("heightMm"))
            w = integer(row.get("widthMm"))
            size_text = f"{h} x {w}" if h and w else h or w
            name = clean(row.get("productName"))
            row_values: list[Any] = [
                para(group.get("lineNo") if first else "", "center"),
                para(group.get("setNo") if first else "", "center"),
                para(name if main else f"↳ {name}", "main" if main else "detail"),
                para(clean(row.get("productCode")) or clean(row.get("model")), "main" if main else "detail"),
                para(clean(row.get("panelInfo")), "center" if main else "detail"),
                para(clean(row.get("openingDirection")), "center" if main else "detail"),
                para(clean(row.get("trimDirection")), "center" if main else "detail"),
                para(clean(row.get("paintColor")), "center" if main else "detail"),
                para(size_text, "center" if main else "detail"),
                para(integer(row.get("frameMm")), "center" if main else "detail"),
                para(integer(row.get("quantity")), "center" if main else "detail"),
                para(clean(row.get("unit")), "center" if main else "detail"),
                para(decimal4(row.get("pricingQuantity")), "num_bold" if main else "detail"),
                para(money(row.get("unitPrice")), "num_bold" if main else "detail"),
                para(money(line_amount(row)), "num_bold" if main else "detail"),
                para(clean(row.get("note")), "note" if main else "detail"),
                _image_flowable(clean(group.get("imagePath"))) if main else para("", "center"),
            ]
            data.append(row_values)
            if main:
                main_row_numbers.append(len(data) - 1)
            else:
                detail_row_numbers.append(len(data) - 1)
        group_end = len(data) - 1
        if group_end >= group_start:
            group_ranges.append((group_start, group_end))

    if len(data) == 1:
        data.append([para("Không có dòng hàng hóa có KH/Lượng để xuất.", "body")] + [""] * 16)

    widths_mm = [7, 13, 30, 24, 12, 12, 12, 12, 23, 11, 9, 10, 14, 18, 20, 31, 15]
    assert sum(widths_mm) == 273
    table = Table(data, colWidths=[w * mm for w in widths_mm], repeatRows=1, splitByRow=1, hAlign="LEFT")
    commands: list[tuple[Any, ...]] = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.55, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.2),
        ("TOPPADDING", (0, 0), (-1, 0), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 4.5),
        ("TOPPADDING", (0, 1), (-1, -1), 2.4),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 2.4),
    ]
    for idx, row_no in enumerate(main_row_numbers):
        commands.append(("BACKGROUND", (0, row_no), (-1, row_no), LIGHT if idx % 2 else WHITE))
    for row_no in detail_row_numbers:
        commands.append(("BACKGROUND", (0, row_no), (-1, row_no), colors.HexColor("#FBFDFF")))
    for start_row, end_row in group_ranges:
        commands.append(("NOSPLIT", (0, start_row), (-1, end_row)))
    table.setStyle(TableStyle(commands))
    return table


def _bottom_section(order: dict[str, Any], calc: dict[str, float]) -> Table:
    reqs = order.get("requirements") or []
    check_lines = []
    for idx, item in enumerate(reqs, 1):
        answer = " - ".join(filter(None, [clean(item.get("answer")), clean(item.get("note"))]))
        text = f"{idx}. {clean(item.get('questionText'))}"
        if answer:
            text += f": {answer}"
        check_lines.append(para(text, "check"))
    if not check_lines:
        check_lines.append(para("Chưa có checklist xác nhận kỹ thuật.", "check"))

    checklist = Table(
        [[para("BẢNG CHECKLIST XÁC NHẬN KỸ THUẬT VỚI ĐẠI LÝ", "check_title")]] + [[x] for x in check_lines],
        colWidths=[CONTENT_W * 0.66],
    )
    checklist.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.65, BORDER),
        ("LINEBELOW", (0, 0), (-1, 0), 0.45, colors.HexColor("#E5E7EB")),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    summary_rows: list[list[Any]] = [
        [para("Tổng giá trị đơn hàng:", "summary"), para(f"{money(calc['orderTotal'])} VNĐ", "summary_amount")],
    ]
    discount_row_index: int | None = None
    if calc["discountPercent"] > 0 and calc["discountAmount"] > 0:
        discount_row_index = len(summary_rows)
        summary_rows.append([
            para(f"Chiết khấu thương mại ({calc['discountPercent']:g}%):", "summary"),
            Paragraph(f'<font color="#DC2626"><b>- {money(calc["discountAmount"])} VNĐ</b></font>', S["summary_amount"]),
        ])
    after_index = len(summary_rows)
    summary_rows.append([para("Tổng tiền sau chiết khấu:", "summary_bold"), para(f"{money(calc['afterDiscount'])} VNĐ", "summary_amount")])
    summary_rows.append([para("Đã đặt cọc:", "summary"), para(f"{money(calc['deposit'])} VNĐ", "summary_amount")])
    if calc["warehouse"] > 0:
        summary_rows.append([para("Trừ tiền nhận hàng tại kho:", "summary"), para(f"{money(calc['warehouse'])} VNĐ", "summary_amount")])
    due_index = len(summary_rows)
    summary_rows.append([para("CÒN LẠI CẦN THANH TOÁN:", "summary_total"), para(f"{money(calc['paymentDue'])} VNĐ", "summary_total_amount")])
    summary_rows.append([para(f"(Bằng chữ: {number_to_vietnamese_words(int(round(calc['paymentDue'])))})", "words"), ""])

    summary = Table(summary_rows, colWidths=[CONTENT_W * 0.22, CONTENT_W * 0.12])
    commands: list[tuple[Any, ...]] = [
        ("BOX", (0, 0), (-1, -2), 0.65, BORDER),
        ("INNERGRID", (0, 0), (-1, -2), 0.35, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
        ("BACKGROUND", (0, after_index), (-1, after_index), colors.HexColor("#EEF2FF")),
        ("BACKGROUND", (0, due_index), (-1, due_index), NAVY),
        ("TEXTCOLOR", (0, due_index), (-1, due_index), WHITE),
        ("SPAN", (0, len(summary_rows) - 1), (1, len(summary_rows) - 1)),
    ]
    if discount_row_index is not None:
        commands.append(("BACKGROUND", (0, discount_row_index), (-1, discount_row_index), PALE_AMBER))
    summary.setStyle(TableStyle(commands))

    outer = Table([[checklist, summary]], colWidths=[CONTENT_W * 0.66, CONTENT_W * 0.34], hAlign="LEFT")
    outer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return outer


def _signatures() -> Table:
    year = datetime.now().year
    data = [[
        [para("ĐẠI LÝ / KHÁCH HÀNG", "sign"), para("(Ký, ghi rõ họ tên & xác nhận kích thước)", "sign_sub"), Spacer(1, 12 * mm), para(f"Ngày .... tháng .... năm {year}", "sign_sub")],
        [para("CÁN BỘ KINH DOANH", "sign"), para("(Ký, ghi rõ họ tên)", "sign_sub"), Spacer(1, 12 * mm), para(f"Ngày .... tháng .... năm {year}", "sign_sub")],
        [para("CÔNG TY TNHH SXTM GOLDMAX", "sign"), para("(Duyệt đơn sản xuất)", "sign_sub"), Spacer(1, 12 * mm), para(f"Ngày .... tháng .... năm {year}", "sign_sub")],
    ]]
    table = Table(data, colWidths=[CONTENT_W / 3] * 3)
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return table


def number_to_vietnamese_words(value: int) -> str:
    if value == 0:
        return "Không đồng"
    digits = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]
    scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"]

    def read_three(n: int, full: bool) -> str:
        hundred, rem = divmod(n, 100)
        ten, one = divmod(rem, 10)
        words: list[str] = []
        if hundred or full:
            words += [digits[hundred], "trăm"]
        if ten > 1:
            words += [digits[ten], "mươi"]
            if one == 1:
                words.append("mốt")
            elif one == 5:
                words.append("lăm")
            elif one:
                words.append(digits[one])
        elif ten == 1:
            words.append("mười")
            if one == 5:
                words.append("lăm")
            elif one:
                words.append(digits[one])
        elif one:
            if hundred or full:
                words.append("lẻ")
            words.append(digits[one])
        return " ".join(words)

    n = abs(int(value))
    chunks: list[int] = []
    while n:
        chunks.append(n % 1000)
        n //= 1000
    words: list[str] = []
    for i in range(len(chunks) - 1, -1, -1):
        chunk = chunks[i]
        if not chunk:
            continue
        words.append(read_three(chunk, i < len(chunks) - 1 and chunk < 100))
        if i < len(scales) and scales[i]:
            words.append(scales[i])
    result = " ".join(words).strip()
    return result[:1].upper() + result[1:] + " đồng"


def load_json(path: str | os.PathLike[str]) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("JSON phải là một object đơn hàng.")
    return data


def main() -> None:
    parser = argparse.ArgumentParser(description="Xuất GOLDMAX PDF V2 bằng ReportLab")
    parser.add_argument("--input", required=True, help="File JSON đơn hàng đã chuẩn hóa")
    parser.add_argument("--output", required=True, help="Đường dẫn PDF đầu ra")
    parser.add_argument("--note", default="", help="Chú thích chỉ dùng cho lần xuất")
    args = parser.parse_args()
    order = load_json(args.input)
    build_order_pdf(order, args.output, args.note)
    print(args.output)


if __name__ == "__main__":
    main()
