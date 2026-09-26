"""V137 — Sinh bản in A4: HƯỚNG DẪN TẠO LỆNH SẢN XUẤT (module Lên kế hoạch sản xuất).

Chạy:
    pip install python-docx
    python3 scripts/v137/mk_v137.py
    libreoffice --headless --convert-to pdf --outdir artifacts artifacts/huong-dan-tao-lenh-san-xuat-v137.docx

Lưu ý (đã từng gặp ở V122): KHÔNG đưa thẻ HTML (<b>…</b>) vào run() — chữ sẽ in ra nguyên thẻ.
Dùng nhiều run với bold=True.
"""

import os

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt, RGBColor

OUT_DIR = "artifacts"
OUT_DOCX = os.path.join(OUT_DIR, "huong-dan-tao-lenh-san-xuat-v137.docx")

FONT = "Arial"
BLUE = RGBColor(0x1F, 0x4E, 0x79)
RED = RGBColor(0xC0, 0x00, 0x00)
GREY = RGBColor(0x59, 0x59, 0x59)


def setup(doc: Document) -> None:
    section = doc.sections[0]
    section.orientation = WD_ORIENT.PORTRAIT
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    for attr, value in (("top_margin", 1.5), ("bottom_margin", 1.5), ("left_margin", 1.7), ("right_margin", 1.5)):
        setattr(section, attr, Cm(value))

    style = doc.styles["Normal"]
    style.font.name = FONT
    style.font.size = Pt(10.5)
    style.paragraph_format.space_after = Pt(4)
    style.paragraph_format.line_spacing = 1.08


def run(paragraph, text: str, *, bold=False, italic=False, size=None, color=None):
    r = paragraph.add_run(text)
    r.bold = bold
    r.italic = italic
    r.font.name = FONT
    if size:
        r.font.size = Pt(size)
    if color is not None:
        r.font.color.rgb = color
    return r


def title(doc, text, sub=None):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run(p, text, bold=True, size=16, color=BLUE)
    if sub:
        s = doc.add_paragraph()
        s.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run(s, sub, italic=True, size=9.5, color=GREY)


def h1(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    run(p, text, bold=True, size=12.5, color=BLUE)


def h2(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(3)
    run(p, text, bold=True, size=11)


def para(doc, parts):
    """parts: str hoặc list các (text, bold) — cho phép trộn đậm/nhạt."""
    p = doc.add_paragraph()
    if isinstance(parts, str):
        run(p, parts)
    else:
        for text, bold in parts:
            run(p, text, bold=bold)
    return p


def bullet(doc, parts, level=0):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.left_indent = Cm(0.6 + 0.5 * level)
    p.paragraph_format.space_after = Pt(2)
    if isinstance(parts, str):
        run(p, parts)
    else:
        for text, bold in parts:
            run(p, text, bold=bold)


def note(doc, text, *, color=RED):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.left_indent = Cm(0.4)
    run(p, text, italic=True, size=10, color=color)


def table(doc, headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for index, head in enumerate(headers):
        cell = t.rows[0].cells[index]
        cell.text = ""
        run(cell.paragraphs[0], head, bold=True, size=9.5)
    for row in rows:
        cells = t.add_row().cells
        for index, value in enumerate(row):
            cells[index].text = ""
            run(cells[index].paragraphs[0], str(value), size=9.5)
    if widths:
        for row in t.rows:
            for index, width in enumerate(widths):
                row.cells[index].width = Cm(width)
    return t


def code(doc, lines):
    for line in lines:
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.8)
        p.paragraph_format.space_after = Pt(1)
        run(p, line, size=9.5)


def build():
    doc = Document()
    setup(doc)

    title(
        doc,
        "HƯỚNG DẪN TẠO LỆNH SẢN XUẤT",
        "GOLDMAX · Module Lên kế hoạch sản xuất · V137 (cập nhật V138) · in A4",
    )

    para(
        doc,
        [
            ("Dành cho: ", True),
            ("người lên kế hoạch · văn phòng xưởng · quản đốc.     ", False),
            ("Một câu tóm tắt: ", True),
            ("tạo lệnh sản xuất = đưa bộ cửa của đơn ĐÃ XÁC NHẬN vào kế hoạch. ", False),
        ],
    )
    note(
        doc,
        "Cập nhật V138: đã có IN PHIẾU LỆNH A4 · KẾ HOẠCH TUẦN (chốt) · nút tạo lệnh từ trang đơn · "
        "xoá lệnh khi bộ bị xoá khỏi đơn · sửa số lượng lệnh con · BÁO CÁO OTD/% lỗi.",
        color=GREY,
    )
    para(
        doc,
        [
            ("App tự sinh ", False),
            ("1 lệnh CHA (bộ cửa) + 3 lệnh CON (cánh · khung · phào) + 24 công đoạn", True),
            (" — không phải nhập tay công đoạn nào.", False),
        ],
    )

    # 1
    h1(doc, "1. Điều kiện để một bộ cửa vào được kế hoạch")
    table(
        doc,
        ["#", "Điều kiện", "Không đạt thì"],
        [
            ["1", "Đơn ở trạng thái ĐÃ XÁC NHẬN (đã bấm “Lưu đơn hàng”)", "Bộ không hiện. Đơn Nháp (bấm “Lưu nháp”) không vào kế hoạch"],
            ["2", "Loại đơn nằm trong danh sách cho phép — hiện đặt CẢ 3 LOẠI (mẫu · sản xuất · làm lại)", "Bộ không hiện. Sửa ở Cấu hình sản xuất → Cấu hình chung"],
            ["3", "Đơn đã có Bộ số (hệ thống tự cấp khi “Lưu đơn hàng”)", "Không có Bộ số thì không định danh được"],
            ["4", "Bộ cửa CHƯA có lệnh trong kế hoạch", "App bỏ qua, không tạo trùng"],
            ["5", "DB đã chạy migration V136 + V136.1", "Báo lỗi “table … does not exist” → chạy migration trước"],
        ],
        widths=[0.8, 8.2, 8.0],
    )
    note(
        doc,
        "Thiếu Cao / Rộng / Hướng mở / Màu sơn: app VẪN tạo lệnh nhưng hiện cảnh báo vàng “chưa đủ thông tin để xếp lịch” "
        "và không xếp lịch cho bộ đó — cần sale bổ sung.",
    )
    para(
        doc,
        [
            ("Đơn vị tạo lệnh: ", True),
            ("mỗi dòng bộ cửa (mỗi Bộ số) = 1 lệnh cha. Dòng phụ kiện/chi tiết (khoá, phào, kính, ô thoáng…) KHÔNG tạo lệnh riêng. "
             "Một đơn 5 bộ cửa → 5 lệnh cha → 15 lệnh con.", False),
        ],
    )

    # 2
    h1(doc, "2. Ba cách tạo lệnh")
    h2(doc, "Cách 1 — Tạo cho MỘT VÀI bộ cụ thể (dùng hằng ngày)")
    code(
        doc,
        [
            "Menu trái:  Sản xuất  →  Kế hoạch sản xuất",
            "Nút (góc phải):  “Nhập bộ đang sản xuất dở (N)”",
            "Danh sách hiện các bộ CHƯA có lệnh  →  tick chọn từng bộ",
            "Nút:  “Đưa N bộ đã chọn vào kế hoạch”",
            "Báo:  “Đã đưa N bộ vào kế hoạch (… công đoạn). Bỏ qua 0 bộ đã có.”",
        ],
    )
    h2(doc, "Cách 2 — Tạo cho TẤT CẢ bộ còn lại (dùng lần đầu / sau khi nhập nhiều đơn)")
    para(
        doc,
        "Cùng màn hình trên → bấm “Đưa TẤT CẢ vào kế hoạch”. Nút này đưa toàn bộ bộ cửa của mọi đơn đã xác nhận mà chưa có lệnh "
        "(không giới hạn). Màn hình chỉ hiện 300 bộ đầu (xếp theo hạn giao gần nhất).",
    )
    h2(doc, "Cách 3 — Tạo cho một ĐƠN cụ thể (từ trang đơn hàng)")
    code(
        doc,
        [
            "Quản lý đơn hàng  →  mở một đơn đã xác nhận",
            "Nút  “Tạo lệnh sản xuất”  (cạnh nút Sửa đơn)",
            "Báo: “Đã tạo N lệnh sản xuất (… công đoạn) cho đơn …”  +  link “Mở kế hoạch sản xuất”",
        ],
    )
    para(doc, "Nút chỉ bật khi đơn ĐÃ XÁC NHẬN; đơn nháp hiện chú thích “Đơn nháp — chưa có Bộ số”. Bấm lại không tạo trùng.")

    # 3
    h1(doc, "3. App tự sinh ra những gì (1 + 3 + 24)")
    h2(doc, "3.1. Một LỆNH CHA = bộ cửa")
    para(
        doc,
        "Sao chép từ đơn: Bộ số · mã đơn · loại đơn · khách hàng · tên sản phẩm · model · hướng mở · màu sơn · Cao × Rộng · "
        "số cánh · số bộ · KH/Lượng · hạn giao.",
    )
    table(
        doc,
        ["Trường", "Tự điền"],
        [
            ["Trạng thái", "Chờ xếp lịch"],
            ["Ưu tiên", "Đơn làm lại = 0 (chen trước) · Sản xuất = 5 · Đơn hàng mẫu = 8"],
            ["Số cánh quy đổi (tính tải)", "số cánh × số bộ"],
        ],
        widths=[5.0, 12.0],
    )
    h2(doc, "3.2. Ba LỆNH CON: Cánh · Khung · Phào")
    table(
        doc,
        ["Lệnh con", "Số lượng"],
        [
            ["CÁNH", "số cánh × số bộ  (số cánh đọc từ tên sản phẩm: “cửa đi 4 cánh” = 4)"],
            ["KHUNG", "số bộ"],
            ["PHÀO", "(số cánh + phào rời mặc định) × số bộ — mặc định cửa đi = 3 · cửa sổ = 4"],
        ],
        widths=[3.0, 14.0],
    )
    note(
        doc,
        "Ví dụ: cửa đi 1 cánh, 1 bộ → Cánh 1 · Khung 1 · Phào 4.  Cửa sổ 1 cánh, 1 bộ → Phào 5.",
        color=GREY,
    )

    h2(doc, "3.3. 24 CÔNG ĐOẠN (16 công đoạn; Cắt / Chấn / Hàn / Vân tách theo phần)")
    table(
        doc,
        ["#", "Công đoạn", "Phạm vi", "Tổ"],
        [
            ["1", "Thiết kế (bản vẽ CAD)", "cả bộ", "Kỹ thuật"],
            ["2", "Bồi Lares (nạp chương trình máy cắt)", "cả bộ", "Kỹ thuật"],
            ["3", "Chờ sau Bồi Lares", "cả bộ", "—"],
            ["4", "CẮT", "khung · cánh · phào", "Tổ máy"],
            ["5", "CHẤN", "khung · cánh · phào", "Tổ máy"],
            ["6", "HÀN + mài ba via", "khung · cánh · phào", "Tổ hàn"],
            ["7", "ÉP CÁNH", "chỉ cánh", "Tổ hàn"],
            ["8", "TEST CƠ KHÍ (QC)", "cả bộ", "Tổ hàn"],
            ["9", "Chờ trước sơn", "cả bộ", "—"],
            ["10", "SƠN", "cả bộ (1 lượt)", "Tổ sơn"],
            ["11", "Chờ khô / nguội sau sơn", "cả bộ", "—"],
            ["12", "VÂN", "khung · cánh · phào", "Tổ vân"],
            ["13", "Chờ sau vân", "cả bộ", "—"],
            ["14", "LẮP KÍNH + PHỤ KIỆN", "cả bộ", "Tổ đóng gói"],
            ["15", "VỆ SINH + ĐÓNG GÓI", "cả bộ", "Tổ đóng gói"],
            ["16", "KHO / GIAO HÀNG", "cả bộ", "Kho"],
        ],
        widths=[0.8, 7.4, 5.0, 3.8],
    )
    para(doc, [("App tự bỏ qua 2 trường hợp (không phải sửa tay):", True)])
    bullet(doc, [("Bồi Lares: ", True), ("model đã có chương trình trong Cấu hình sản xuất → Chương trình máy cắt ⇒ thành “Bỏ qua”.", False)])
    bullet(doc, [("Vân: ", True), ("màu sơn là 11 hoặc 14 ⇒ cả 3 công đoạn Vân (cánh/khung/phào) thành “Bỏ qua”.", False)])

    h2(doc, "3.4. Điều kiện chuyển bước — app CHẶN, không chỉ cảnh báo")
    table(
        doc,
        ["Công đoạn", "Chỉ mở khi"],
        [
            ["Cắt", "Bồi Lares xong"],
            ["Chấn", "Cắt xong (cùng phần)"],
            ["Hàn", "Chấn xong (cùng phần)"],
            ["Ép cánh", "Hàn xong CỦA CÁNH (không cần chờ khung/phào)"],
            ["TEST CƠ KHÍ", "CẢ 3 PHẦN (cánh + khung + phào) ĐÃ HÀN XONG  ← “đủ bộ mới test được”"],
            ["Sơn", "Test cơ khí xong"],
            ["Vân", "Sơn xong"],
            ["LẮP KÍNH + ĐÓNG GÓI", "CẢ 3 PHẦN ĐÃ VÂN XONG  ← “đủ bộ mới chuyển vệ sinh, đóng gói”"],
            ["Kho / giao hàng", "Đóng gói xong"],
        ],
        widths=[4.6, 12.4],
    )
    note(
        doc,
        "Báo sai thứ tự sẽ bị TỪ CHỐI kèm lý do. Ví dụ: “Chưa đủ điều kiện: Test cơ khí (đang chờ Hàn + mài ba via). "
        "Phải báo hoàn thành công đoạn trước rồi mới báo bước sau.”",
    )

    # 4
    h1(doc, "4. Làm gì tiếp sau khi tạo lệnh")
    bullet(doc, [("Xếp lịch: ", True), ("ở màn Kế hoạch sản xuất, bấm “Xếp lịch tự động”. Mặc định chỉ xếp các bộ đang Chờ xếp lịch; "
                                       "tick “Xếp lại cả bộ đã có lịch” nếu muốn xếp lại. Cách xếp: hạn giao gần nhất trước, đơn làm lại chen trước, "
                                       "tôn trọng năng lực từng tổ và nghỉ Chủ nhật + ngày lễ.", False)])
    bullet(doc, [("Xem tải: ", True), ("bảng “Tải theo tổ và ngày” — xanh = trong năng lực, vàng > 85%, đỏ = vượt năng lực.", False)])
    bullet(doc, [("Cập nhật tiến độ: ", True), ("mở một bộ cửa → bảng “Cập nhật tiến độ theo công đoạn”: chọn Trạng thái, ghi Lý do nếu tạm dừng/làm lại, "
                                               "rồi bấm “Lưu tiến độ”. Đổi nhiều dòng rồi lưu MỘT LẦN. Dòng bị khoá hiện dấu 🔒 và không chọn được Đang làm / Xong. "
                                               "Khi tất cả công đoạn Xong → bộ tự chuyển Hoàn thành.", False)])
    bullet(doc, [("Đánh dấu đã giao: ", True), ("nút “Đánh dấu đã giao” ở trang bộ cửa (ghi ngày giao thực tế, dùng để tính tỷ lệ giao đúng hạn).", False)])
    bullet(doc, [("Kế hoạch tuần + chốt kế hoạch: ", True), ("Sản xuất → Kế hoạch tuần → chọn khoảng ngày (mặc định T2→CN) → “Tạo / gom bộ vào kế hoạch” → "
                                                          "nhập tên người chốt → “Chốt kế hoạch”. Chốt không khoá việc cập nhật tiến độ nhưng có ghi lịch sử; có nút Mở lại và Xoá.", False)])
    bullet(doc, [("In cho xưởng: ", True), ("Sản xuất → Kế hoạch sản xuất → “In phiếu lệnh SX”. Phiếu lệnh A4 cho một bộ (từ trang bộ cửa) hoặc cho mọi bộ có việc "
                                            "trong ngày (lọc theo tổ); thêm Danh sách việc theo ngày — mỗi tổ một trang để dán ở xưởng. Trong trang in bấm “In / Lưu PDF”.", False)])
    bullet(doc, [("Xem kết quả: ", True), ("Báo cáo → Sản xuất (OTD): giao đúng hạn, bộ giao trễ, tỷ lệ làm lại, thời gian thực tế từng công đoạn so với định mức, "
                                           "năng suất tổ, lý do trễ, tồn thành phẩm.", False)])

    # 5
    h1(doc, "5. Câu hỏi thường gặp")
    faq = [
        ("Bấm tạo lệnh 2 lần có bị trùng không?",
         "Không. App chống trùng theo id dòng hàng VÀ theo (mã đơn + Bộ số) → bấm lại báo “bỏ qua”. Nhờ vậy sửa đơn rồi tạo lại cũng KHÔNG sinh lệnh trùng."),
        ("Sửa đơn sau khi đã tạo lệnh thì tiến độ có mất không?",
         "Không mất — lệnh là bản ghi riêng, liên kết giữ theo mã đơn + Bộ số. Nhưng thông tin cũ (kích thước, màu…) trong lệnh KHÔNG tự cập nhật."),
        ("Vì sao không thấy bộ nào trong danh sách?",
         "Kiểm 3 việc: (1) đơn đã bấm “Lưu đơn hàng” chưa; (2) loại đơn có bị tắt trong Cấu hình sản xuất không; (3) bộ đó đã có lệnh rồi (thì nằm ở bảng kế hoạch, không nằm ở màn nhập)."),
        ("Một bộ cửa tạo ra mấy lệnh?",
         "1 lệnh cha + 3 lệnh con (cánh/khung/phào) = 24 công đoạn. Một đơn 5 bộ → 5 lệnh cha."),
        ("Đơn hàng mẫu có vào kế hoạch không?",
         "Có — hiện đặt cả 3 loại đơn đều vào (nhà máy chốt 26/09/2026). Ưu tiên thấp hơn đơn sản xuất và đơn làm lại."),
        ("Bộ không nằm trong đơn nào (làm bù, hàng tồn) thì sao?",
         "Chưa hỗ trợ tạo lệnh tay ngoài đơn hàng — cần tạo một đơn cho bộ đó trước."),
        ("In phiếu lệnh sản xuất cho tổ?",
         "ĐÃ CÓ. Sản xuất → Kế hoạch sản xuất → “In phiếu lệnh SX”, chọn tổ + ngày. Phiếu A4 dọc gồm thông tin bộ, 3 lệnh con và bảng công đoạn có ô tích để tổ ghi. Có thêm Danh sách việc theo ngày (mỗi tổ 1 trang)."),
        ("Chốt kế hoạch tuần (giám đốc duyệt)?",
         "ĐÃ CÓ. Sản xuất → Kế hoạch tuần: tạo kế hoạch cho khoảng ngày, gom các bộ đã xếp lịch, rồi bấm Chốt kế hoạch (ghi tên giám đốc nhà máy). Có lưu lịch sử ai chốt/mở lại."),
        ("Bộ cửa bị xoá khỏi đơn thì lệnh sản xuất ra sao?",
         "Tự xử lý khi lưu đơn: bộ CHƯA có tiến độ → xoá hẳn lệnh; bộ ĐÃ có tiến độ → giữ lại và đánh dấu ĐÃ HUỶ (không phá công xưởng đã làm). Bộ đã huỷ không hiện trên bảng kế hoạch."),
        ("Cần đổi số lượng cánh/khung/phào của một bộ thì sao?",
         "Mở bộ cửa → khối “Số lượng lệnh con (sửa tay được)” → sửa 3 ô → bấm Lưu tiến độ. Số hiện cạnh là số theo công thức để đối chiếu; sửa khác thì số công thức hiện màu vàng."),
    ]
    for question, answer in faq:
        bullet(doc, [(question + " ", True), (answer, False)])

    # 6
    h1(doc, "6. Những việc CHƯA làm (để không hiểu nhầm là đã có)")
    table(
        doc,
        ["Việc", "Trạng thái"],
        [
            ["In phiếu lệnh sản xuất A4 + danh sách việc dán xưởng", "ĐÃ CÓ"],
            ["Màn kế hoạch tuần + nút chốt kế hoạch (giám đốc duyệt)", "ĐÃ CÓ"],
            ["Nút “Tạo lệnh sản xuất” trên trang đơn hàng", "ĐÃ CÓ"],
            ["Xoá lệnh sản xuất khi bộ cửa bị xoá khỏi đơn", "ĐÃ CÓ (chưa tiến độ → xoá; có tiến độ → HUỶ)"],
            ["Sửa số lượng lệnh con bằng tay", "ĐÃ CÓ"],
            ["Báo cáo OTD · % lỗi · năng suất tổ · lý do trễ", "ĐÃ CÓ (xem trên màn, chưa xuất Excel)"],
            ["Ép ràng buộc gom lô sơn ≥ 20 cánh / ≤ 2 lượt đổi khuôn mỗi ngày", "mới chỉ cảnh báo"],
            ["Màn nhập chương trình máy cắt từ file", "chưa có (đang nhập tay ở Cấu hình sản xuất)"],
            ["Đăng nhập / phân quyền", "chưa có (ai có link cũng sửa được)"],
        ],
        widths=[11.0, 6.0],
    )

    # 7
    h1(doc, "7. Ai làm gì")
    table(
        doc,
        ["Bước", "Ai làm", "Ở đâu"],
        [
            ["Chốt đơn với khách", "Kinh doanh", "Quản lý đơn hàng → Lưu đơn hàng (cấp Bộ số)"],
            ["Đưa bộ cửa vào kế hoạch", "Người lên kế hoạch", "Sản xuất → Kế hoạch sản xuất → Nhập bộ đang sản xuất dở"],
            ["Xếp lịch, xem tải, xử lý quá tải", "Người lên kế hoạch / quản đốc", "Sản xuất → Kế hoạch sản xuất"],
            ["Cập nhật tiến độ từng công đoạn", "Văn phòng xưởng", "Sản xuất → Kế hoạch sản xuất → mở bộ cửa"],
            ["Sửa năng lực tổ, thời lượng công đoạn, lý do", "Quản đốc", "Sản xuất → Cấu hình sản xuất"],
            ["Chốt kế hoạch tuần", "Giám đốc nhà máy", "Sản xuất → Kế hoạch tuần"],
            ["In phiếu lệnh SX / danh sách việc", "Văn phòng xưởng", "Sản xuất → Kế hoạch sản xuất → In phiếu lệnh SX"],
            ["Xem OTD, % lỗi, năng suất", "Chủ / quản đốc", "Báo cáo → Sản xuất (OTD)"],
        ],
        widths=[5.4, 4.6, 7.0],
    )

    os.makedirs(OUT_DIR, exist_ok=True)
    doc.save(OUT_DOCX)
    print("đã ghi", OUT_DOCX)


if __name__ == "__main__":
    build()
