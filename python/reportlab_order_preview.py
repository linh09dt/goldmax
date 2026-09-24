"""GOLDMAX - PDF preview kiểu báo giá chuyên nghiệp.

Đây là template thử nghiệm độc lập với PDF V2 hiện tại.
- A4 landscape, text/vector sắc nét khi in.
- Cột HÌNH ẢNH nằm cuối bảng.
- Hình ảnh của một bộ cửa được gom từ ảnh bộ cửa chính + ảnh chi tiết/phụ kiện.
- Không thay đổi pipeline PDF V2 hiện tại.
- Không có khu vực chữ ký; giữ khối tổng hợp thanh toán, đã bỏ checklist xác nhận kỹ thuật (V52).
- Toàn bộ font tăng thêm 4pt để in dễ đọc hơn.
"""

from __future__ import annotations

import io
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.platypus import Image, LongTable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from python.reportlab_order_v2 import (
    FOOTNOTE_LINES,
    FOOTNOTE_TITLE,
    FONTS,
    COMPANY,
    _logo_flowable,
    _prefetch_product_images,
    build_groups,
    clean,
    decimal4,
    fmt_date,
    has_pricing,
    integer,
    line_amount,
    money,
    number_to_vietnamese_words,
    raw_block_details,
    totals,
)

PAGE_W, PAGE_H = landscape(A4)
LEFT = RIGHT = 5 * mm
TOP = 7 * mm
BOTTOM = 9 * mm
CONTENT_W = PAGE_W - LEFT - RIGHT

NAVY = colors.HexColor("#123F72")
NAVY_DARK = colors.HexColor("#0B2E52")
BLUE = colors.HexColor("#1D5E9E")
PALE_BLUE = colors.HexColor("#EAF3FA")
PALE_ROW = colors.HexColor("#F8FBFD")
BORDER = colors.HexColor("#9FB0BF")
TEXT = colors.HexColor("#152238")
MUTED = colors.HexColor("#526579")
WHITE = colors.white
ORANGE = colors.HexColor("#EA6A11")

# Yêu cầu preview test: tăng toàn bộ font thêm 4pt so với bản mẫu trước.
FONT_DELTA = 4.0

COMPANY_LINES = [
    "GPKD: 2401031714",
    "VP Miền Bắc: Số 670 Toàn Thắng - Xã Thuận An - TP. Hà Nội",
    "VP Miền Nam: A34 Shophouse Phú Mỹ Hưng - TP. Hồ Chí Minh",
    "NHÀ MÁY SẢN XUẤT: Cụm CN Non Sáo, Xã Tân Dĩnh, Bắc Ninh",
    "Hotline: 1900 8135    Email: Goldmaxdoor@gmail.com",
]


def pstyle(name: str, *, size: float = 7.7, leading: float | None = None, bold: bool = False,
           color: colors.Color = TEXT, align: int = TA_LEFT) -> ParagraphStyle:
    actual_size = size + FONT_DELTA
    actual_leading = (leading + FONT_DELTA) if leading is not None else actual_size * 1.18
    return ParagraphStyle(
        name,
        parent=getSampleStyleSheet()["BodyText"],
        fontName=FONTS["bold"] if bold else FONTS["regular"],
        fontSize=actual_size,
        leading=actual_leading,
        textColor=color,
        alignment=align,
        spaceBefore=0,
        spaceAfter=0,
        splitLongWords=1,
    )


STYLES = {
    "company": pstyle("preview_company", size=13.5, bold=True, color=NAVY_DARK),
    "company_line": pstyle("preview_company_line", size=7.4, leading=8.6, color=MUTED),
    "title": pstyle("preview_title", size=14, bold=True, color=NAVY_DARK, align=TA_CENTER),
    "order_code": pstyle("preview_order_code", size=9.6, bold=True, color=ORANGE, align=TA_CENTER),
    "meta": pstyle("preview_meta", size=7.9, leading=9.0),
    "meta_label": pstyle("preview_meta_label", size=7.7, bold=True, color=NAVY_DARK),
    "th": pstyle("preview_th", size=7.5, leading=8.2, bold=True, color=WHITE, align=TA_CENTER),
    "body": pstyle("preview_body", size=7.7, leading=8.7),
    "body_bold": pstyle("preview_body_bold", size=7.7, leading=8.7, bold=True),
    "small": pstyle("preview_small", size=7.0, leading=8.0, color=MUTED),
    "center": pstyle("preview_center", size=7.7, leading=8.7, align=TA_CENTER),
    "right": pstyle("preview_right", size=7.7, leading=8.7, align=TA_RIGHT),
    "right_bold": pstyle("preview_right_bold", size=7.7, leading=8.7, bold=True, align=TA_RIGHT),
    "total_label": pstyle("preview_total_label", size=8.5, leading=9.4, bold=True, color=NAVY_DARK),
    "total_value": pstyle("preview_total_value", size=8.8, leading=9.6, bold=True, color=NAVY_DARK, align=TA_RIGHT),
    "grand_label": pstyle("preview_grand_label", size=9.3, leading=10.4, bold=True, color=WHITE),
    "grand_value": pstyle("preview_grand_value", size=10.4, leading=11.4, bold=True, color=WHITE, align=TA_RIGHT),
    "words": pstyle("preview_words", size=6.8, leading=7.8, color=MUTED, align=TA_RIGHT),
    "check_title": pstyle("preview_check_title", size=7.8, leading=8.8, bold=True, color=NAVY_DARK),
    "check": pstyle("preview_check", size=7.3, leading=8.5, color=TEXT),
    "summary": pstyle("preview_summary", size=7.5, leading=8.6, color=TEXT),
    "summary_bold": pstyle("preview_summary_bold", size=7.5, leading=8.6, bold=True, color=TEXT),
    "summary_amount": pstyle("preview_summary_amount", size=7.5, leading=8.6, color=TEXT, align=TA_RIGHT),
    "summary_total": pstyle("preview_summary_total", size=7.8, leading=8.9, bold=True, color=WHITE),
    "summary_total_amount": pstyle("preview_summary_total_amount", size=8.0, leading=9.1, bold=True, color=WHITE, align=TA_RIGHT),
    "footnote_title": pstyle("preview_footnote_title", size=6.6, leading=7.8, bold=True, color=MUTED),
    "footnote": pstyle("preview_footnote", size=6.6, leading=7.8, color=MUTED),
}


def esc(value: Any) -> str:
    text = "" if value is None else str(value)
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def para(value: Any, style: str = "body") -> Paragraph:
    return Paragraph(esc(value).replace("\n", "<br/>"), STYLES[style])


def rich(html: str, style: str = "body") -> Paragraph:
    return Paragraph(html, STYLES[style])


def _details_for_item(item: dict[str, Any]) -> list[dict[str, Any]]:
    details = item.get("details") or []
    if not details and isinstance(item.get("rawBlock"), list):
        details = raw_block_details(item.get("rawBlock") or [])
    return [d for d in details if isinstance(d, dict)]


def build_preview_groups(order: dict[str, Any]) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    for item in order.get("items") or []:
        if not isinstance(item, dict):
            continue
        details = _details_for_item(item)
        rows: list[dict[str, Any]] = []
        if has_pricing(item.get("pricingQuantity")):
            rows.append({"row": item, "main": True})
        for detail in details:
            if has_pricing(detail.get("pricingQuantity")):
                rows.append({"row": detail, "main": False})
        if not rows:
            continue

        urls: list[str] = []
        seen: set[str] = set()
        for candidate in [item.get("imagePath"), *[d.get("imagePath") for d in details]]:
            url = clean(candidate)
            if url and url not in seen:
                seen.add(url)
                urls.append(url)

        groups.append({
            "lineNo": item.get("lineNo"),
            "setNo": item.get("setNo"),
            "item": item,
            "rows": rows,
            "allDetails": details,
            "imageUrls": urls,
        })
    return groups


def _prefetch_groups(groups: list[dict[str, Any]]) -> dict[str, bytes | None]:
    # Tận dụng downloader/optimizer đã ổn định của PDF V2, nhưng gom cả ảnh chi tiết
    # dù chi tiết đó không có KH/Lượng để cột ảnh vẫn phản ánh đầy đủ một bộ cửa.
    fake_groups = []
    for group in groups:
        urls = group.get("imageUrls") or []
        fake_groups.append({
            "imagePath": urls[0] if urls else "",
            "rows": [{"row": {"imagePath": url}} for url in urls[1:]],
        })
    return _prefetch_product_images(fake_groups)


def _thumb(url: str, cache: dict[str, bytes | None], size_mm: float = 16.5) -> Any:
    data = cache.get(url)
    if not data:
        return para("", "center")
    try:
        img = Image(io.BytesIO(data), width=size_mm * mm, height=size_mm * mm, kind="proportional")
        img.hAlign = "CENTER"
        return img
    except Exception:
        return para("", "center")


def _group_gallery(urls: list[str], cache: dict[str, bytes | None]) -> Any:
    valid = [url for url in urls if cache.get(url)]
    if not valid:
        return para("", "center")

    # 1 ảnh: ảnh lớn. Nhiều ảnh: lưới 2 cột, thể hiện cửa chính + phụ kiện đi kèm.
    if len(valid) == 1:
        return _thumb(valid[0], cache, 27)

    rows: list[list[Any]] = []
    for idx in range(0, len(valid), 2):
        pair = valid[idx:idx + 2]
        cells = [_thumb(url, cache, 14.5) for url in pair]
        if len(cells) == 1:
            cells.append("")
        rows.append(cells)
    gallery = Table(rows, colWidths=[17 * mm, 17 * mm], hAlign="CENTER")
    gallery.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0.8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0.8),
        ("TOPPADDING", (0, 0), (-1, -1), 0.8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.8),
    ]))
    return gallery


def _technical_description(row: dict[str, Any], main: bool, set_no: Any) -> Paragraph:
    name = clean(row.get("productName")) or ("Bộ cửa" if main else "Chi tiết")
    model = clean(row.get("productCode")) or clean(row.get("model"))
    lines: list[str] = []
    if main:
        title = f'<font name="{FONTS["bold"]}">{esc(name)}</font>'
        if set_no:
            title += f' &nbsp; <font color="#526579">Bộ số: {esc(set_no)}</font>'
        lines.append(title)
        if model:
            lines.append(f'<font name="{FONTS["bold"]}">Model:</font> {esc(model)}')
        spec_parts = []
        for label, key in [
            ("Ô TH", "panelInfo"),
            ("Hướng", "openingDirection"),
            ("Phào", "trimDirection"),
            ("Màu", "paintColor"),
        ]:
            value = clean(row.get(key))
            if value:
                spec_parts.append(f"{label}: {value}")
        frame = integer(row.get("frameMm"))
        if frame:
            spec_parts.append(f"Khuôn: {frame}")
        if spec_parts:
            lines.append(" &nbsp; | &nbsp; ".join(esc(x) for x in spec_parts))
        note = clean(row.get("note"))
        if note:
            lines.append(f'<font color="#526579">Ghi chú: {esc(note)}</font>')
    else:
        title = f'↳ <font name="{FONTS["bold"]}">{esc(name)}</font>'
        if model:
            title += f' &nbsp; <font color="#526579">{esc(model)}</font>'
        lines.append(title)
        note = clean(row.get("note"))
        if note:
            lines.append(f'<font color="#526579">{esc(note)}</font>')
    return rich("<br/>".join(lines), "body")


def _size_text(row: dict[str, Any], main: bool) -> Paragraph:
    h = integer(row.get("heightMm"))
    w = integer(row.get("widthMm"))
    clear_h = integer(row.get("clearHeightMm"))
    clear_w = integer(row.get("clearWidthMm"))
    lines = []
    if h or w:
        lines.append(f"{h or '-'} x {w or '-'}")
    if main and (clear_h or clear_w):
        lines.append(f"TT: {clear_h or '-'} x {clear_w or '-'}")
    return para("\n".join(lines), "center")


def _header(order: dict[str, Any], order_code: str) -> list[Any]:
    company = [
        para(COMPANY, "company"),
        Spacer(1, 0.6 * mm),
        para("\n".join(COMPANY_LINES), "company_line"),
    ]
    # Giữ form mẫu, nhưng phần đầu theo form hiện tại: THÔNG TIN ĐƠN HÀNG + Mã ĐH.
    quote_box = Table([
        [para("THÔNG TIN ĐƠN HÀNG", "title")],
        [para(f"Mã ĐH: {order_code}", "order_code")],
    ], colWidths=[100 * mm])
    quote_box.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
    ]))

    top = Table(
        [[_logo_flowable(), company, quote_box]],
        colWidths=[31 * mm, CONTENT_W - 31 * mm - 102 * mm, 102 * mm],
        hAlign="LEFT",
    )
    top.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    meta_values = [
        ("Khách hàng", clean(order.get("customerName")) or clean(order.get("receiverName"))),
        ("Mã đại lý", clean(order.get("customerCode"))),
        ("NVKD", clean(order.get("salesEmployeeCode"))),
        ("Người nhận", clean(order.get("receiverName"))),
        ("Địa chỉ", clean(order.get("receiverAddress"))),
        ("Số điện thoại", clean(order.get("receiverPhone"))),
        ("Ngày đặt hàng", fmt_date(order.get("orderDate"))),
        ("Ngày cần giao", fmt_date(order.get("requiredDeliveryDate"))),
        ("Vùng miền", clean(order.get("region"))),
        ("Số Km giao hàng", clean(order.get("deliveryKm"))),
        ("Ngày cập nhật", fmt_date(order.get("excelUpdateDate")) or datetime.now().strftime("%d/%m/%Y")),
        ("Trạng thái", clean(order.get("status")) or "Nháp"),
    ]
    meta_data = []
    for r in range(3):
        row = []
        for c in range(4):
            label, value = meta_values[r * 4 + c]
            row.append(rich(
                f'<font name="{FONTS["bold"]}" color="#123F72">{esc(label)}:</font> {esc(value or "-")}',
                "meta",
            ))
        meta_data.append(row)
    meta = Table(meta_data, colWidths=[CONTENT_W / 4] * 4)
    meta.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.7, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CDD7E0")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FBFD")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return [top, Spacer(1, 1.8 * mm), meta]


def _items_table(groups: list[dict[str, Any]], image_cache: dict[str, bytes | None]) -> LongTable:
    header = [
        para("STT", "th"),
        para("BỘ SỐ", "th"),
        para("TÊN SẢN PHẨM / QUY CÁCH KỸ THUẬT", "th"),
        para("KÍCH THƯỚC (mm)", "th"),
        para("SL", "th"),
        para("ĐVT", "th"),
        para("KH/LƯỢNG", "th"),
        para("ĐƠN GIÁ (VND)", "th"),
        para("THÀNH TIỀN (VND)", "th"),
        para("HÌNH ẢNH BỘ CỬA", "th"),
    ]
    data: list[list[Any]] = [header]
    commands: list[tuple[Any, ...]] = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.8, BORDER),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 2.6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2.6),
        ("TOPPADDING", (0, 0), (-1, 0), 3.8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 3.8),
    ]

    for group_index, group in enumerate(groups, 1):
        start = len(data)
        rows = group.get("rows") or []
        for row_index, entry in enumerate(rows):
            row = entry.get("row") or {}
            main = bool(entry.get("main"))
            first = row_index == 0
            data.append([
                para(group_index if first else "", "center"),
                para(group.get("setNo") if first else "", "center"),
                _technical_description(row, main, group.get("setNo")),
                _size_text(row, main),
                para(integer(row.get("quantity")), "center"),
                para(clean(row.get("unit")), "center"),
                para(decimal4(row.get("pricingQuantity")), "right"),
                para(money(row.get("unitPrice")), "right"),
                para(money(line_amount(row)), "right_bold" if main else "right"),
                _group_gallery(group.get("imageUrls") or [], image_cache) if first else "",
            ])
        end = len(data) - 1
        if end < start:
            continue
        if end > start:
            commands.append(("SPAN", (9, start), (9, end)))
        commands.extend([
            ("BACKGROUND", (0, start), (-1, start), WHITE if group_index % 2 else colors.HexColor("#F3F8FC")),
            ("LINEABOVE", (0, start), (-1, start), 1.1, BLUE),
            ("TOPPADDING", (0, start), (-1, end), 3.0),
            ("BOTTOMPADDING", (0, start), (-1, end), 3.0),
            ("VALIGN", (9, start), (9, end), "MIDDLE"),
        ])
        for detail_row in range(start + 1, end + 1):
            commands.append(("BACKGROUND", (0, detail_row), (8, detail_row), PALE_ROW))

    if len(data) == 1:
        data.append([para("Không có dữ liệu có KH/Lượng để xuất.", "body")] + [""] * 9)
        commands.append(("SPAN", (0, 1), (-1, 1)))

    base_mm = [8, 13, 80, 31, 9, 12, 19, 25, 29, 42]
    total = sum(base_mm)
    widths = [CONTENT_W * (w / total) for w in base_mm]
    table = LongTable(data, colWidths=widths, repeatRows=1, splitByRow=1, hAlign="LEFT")
    table.setStyle(TableStyle(commands))
    return table


def _footnote_block() -> Table:
    """V53: ghi chú nhỏ ở góc dưới bên trái (chữ nhỏ, màu xám, không viền)."""
    rows: list[list[Any]] = [[para(FOOTNOTE_TITLE, "footnote_title")]]
    rows += [[para(line, "footnote")] for line in FOOTNOTE_LINES]
    table = Table(rows, colWidths=[CONTENT_W * 0.60])
    table.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0.6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0.6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def _bottom_section(order: dict[str, Any]) -> Table:
    """Tổng hợp thanh toán + ghi chú nhỏ (V52 bỏ checklist, V53 thêm ghi chú góc dưới bên trái)."""
    calc = totals(order, build_groups(order))

    summary_rows: list[list[Any]] = [
        [para("Tổng giá trị đơn hàng:", "summary"), para(f"{money(calc['orderTotal'])} VNĐ", "summary_amount")],
    ]
    # V51: không có chiết khấu (hoặc 0%) thì ẩn luôn dòng "Tổng tiền sau chiết khấu".
    show_discount = calc["discountPercent"] > 0 and calc["discountAmount"] > 0
    after_index: int | None = None
    if show_discount:
        summary_rows.append([
            para(f"Chiết khấu thương mại ({calc['discountPercent']:g}%):", "summary"),
            para(f"- {money(calc['discountAmount'])} VNĐ", "summary_amount"),
        ])
        after_index = len(summary_rows)
        summary_rows.append([para("Tổng tiền sau chiết khấu:", "summary_bold"), para(f"{money(calc['afterDiscount'])} VNĐ", "summary_amount")])
    summary_rows.append([para("Đã đặt cọc:", "summary"), para(f"{money(calc['deposit'])} VNĐ", "summary_amount")])
    if calc["warehouse"] > 0:
        summary_rows.append([para("Trừ tiền nhận hàng tại kho:", "summary"), para(f"{money(calc['warehouse'])} VNĐ", "summary_amount")])
    due_index = len(summary_rows)
    summary_rows.append([para("CÒN LẠI CẦN THANH TOÁN:", "summary_total"), para(f"{money(calc['paymentDue'])} VNĐ", "summary_total_amount")])
    words_index = len(summary_rows)
    summary_rows.append([para(f"(Bằng chữ: {number_to_vietnamese_words(int(round(calc['paymentDue'])))} )", "words"), ""])

    summary = Table(summary_rows, colWidths=[CONTENT_W * 0.22, CONTENT_W * 0.12], hAlign="RIGHT")
    commands: list[tuple[Any, ...]] = [
        ("BOX", (0, 0), (-1, due_index), 0.8, BORDER),
        ("INNERGRID", (0, 0), (-1, due_index), 0.45, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.0),
        ("BACKGROUND", (0, due_index), (-1, due_index), NAVY),
        ("TEXTCOLOR", (0, due_index), (-1, due_index), WHITE),
        ("SPAN", (0, words_index), (1, words_index)),
    ]
    if after_index is not None:
        commands.append(("BACKGROUND", (0, after_index), (-1, after_index), colors.HexColor("#EEF2FF")))
    summary.setStyle(TableStyle(commands))

    footnote = _footnote_block()
    outer = Table([[footnote, summary]], colWidths=[CONTENT_W * 0.66, CONTENT_W * 0.34], hAlign="LEFT")
    outer.setStyle(TableStyle([
        ("VALIGN", (0, 0), (0, 0), "BOTTOM"),
        ("VALIGN", (1, 0), (1, 0), "TOP"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return outer


def _footer(canvas: pdfcanvas.Canvas, doc: SimpleDocTemplate, order_code: str) -> None:
    canvas.saveState()
    y = 4.5 * mm
    canvas.setStrokeColor(colors.HexColor("#CBD5E1"))
    canvas.setLineWidth(0.55)
    canvas.line(LEFT, y + 3.4 * mm, PAGE_W - RIGHT, y + 3.4 * mm)
    canvas.setFont(FONTS["regular"], 7 + FONT_DELTA)
    canvas.setFillColor(MUTED)
    canvas.drawString(LEFT, y, f"GOLDMAX VIỆT NAM  |  Mã đơn hàng: {order_code}")
    canvas.drawRightString(PAGE_W - RIGHT, y, f"Trang {canvas.getPageNumber()}")
    canvas.restoreState()


def build_order_pdf_preview(
    order: dict[str, Any],
    output: str | os.PathLike[str] | io.BytesIO,
    export_note: str = "",
    include_images: bool = True,
) -> None:
    groups = build_preview_groups(order)
    order_code = clean(order.get("orderCode")) or f"DH-{order.get('id', '')}"
    target = os.fspath(output) if isinstance(output, os.PathLike) else output

    doc = SimpleDocTemplate(
        target,
        pagesize=landscape(A4),
        leftMargin=LEFT,
        rightMargin=RIGHT,
        topMargin=TOP,
        bottomMargin=BOTTOM,
        title=f"Bảng báo giá chi tiết - {order_code}",
        author=COMPANY,
        subject="PDF mẫu mới GOLDMAX",
    )

    image_cache = _prefetch_groups(groups) if include_images else {}
    story: list[Any] = []
    story.extend(_header(order, order_code))
    story.append(Spacer(1, 2.2 * mm))
    story.append(_items_table(groups, image_cache))

    if export_note.strip():
        story.append(Spacer(1, 1.7 * mm))
        note = Table([[rich(f'<font name="{FONTS["bold"]}">Ghi chú chung:</font> {esc(export_note.strip())}', "body")]], colWidths=[CONTENT_W])
        note.setStyle(TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.6, BORDER),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF9ED")),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(note)

    story.append(Spacer(1, 2.3 * mm))
    story.append(_bottom_section(order))
    # Không hiển thị khu vực chữ ký trong PDF mẫu test.

    footer = lambda canvas, doc_obj: _footer(canvas, doc_obj, order_code)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def build_order_pdf_preview_bytes(order: dict[str, Any], export_note: str = "", include_images: bool = True) -> bytes:
    out = io.BytesIO()
    build_order_pdf_preview(order, out, export_note=export_note, include_images=include_images)
    return out.getvalue()
