# -*- coding: utf-8 -*-
"""V122 — Bộ câu hỏi CHUẨN cho module Lên kế hoạch sản xuất (làm lại từ đầu, gộp V117+V118 đã chốt)."""
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ROW_HEIGHT_RULE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

DO = RGBColor(0x0E, 0x74, 0x90); XAM = RGBColor(0x55, 0x55, 0x55); RED = RGBColor(0xB9, 0x1C, 0x1C)
doc = Document()
s = doc.sections[0]
s.page_width, s.page_height = Cm(21), Cm(29.7)
s.left_margin = s.right_margin = Cm(1.2); s.top_margin = Cm(1.2); s.bottom_margin = Cm(1.3)
n = doc.styles["Normal"]; n.font.name = "Arial"; n.font.size = Pt(9)
n._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial"); n._element.rPr.rFonts.set(qn("w:cs"), "Arial")
WT = Cm(21 - 2.4)


def run(p, t, size=9, bold=False, italic=False, color=None):
    r = p.add_run(t); r.font.name = "Arial"; r.font.size = Pt(size); r.bold = bold; r.italic = italic
    if color is not None: r.font.color.rgb = color
    r._element.rPr.rFonts.set(qn("w:cs"), "Arial"); return r


def rich(p, text, size=9, bold=False, italic=False, color=None):
    """Như run() nhưng hiểu thẻ <b>...</b> thành chữ đậm thật (không in thẻ ra)."""
    import re as _re
    for part in _re.split(r'(<b>.*?</b>)', text):
        if not part:
            continue
        if part.startswith('<b>') and part.endswith('</b>'):
            run(p, part[3:-4], size=size, bold=True, italic=italic, color=color)
        else:
            run(p, part, size=size, bold=bold, italic=italic, color=color)


def shade(cell, c):
    el = OxmlElement("w:shd"); el.set(qn("w:val"), "clear"); el.set(qn("w:fill"), c)
    cell._tc.get_or_add_tcPr().append(el)


def head(t, size=11.5):
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(10); p.paragraph_format.space_after = Pt(3)
    pPr = p._p.get_or_add_pPr()
    el = OxmlElement("w:shd"); el.set(qn("w:val"), "clear"); el.set(qn("w:fill"), "DDEEF5"); pPr.append(el)
    bd = OxmlElement("w:pBdr"); l = OxmlElement("w:left")
    l.set(qn("w:val"), "single"); l.set(qn("w:sz"), "20"); l.set(qn("w:color"), "0E7490")
    bd.append(l); pPr.append(bd)
    run(p, " " + t, size=size, bold=True, color=RGBColor(0x08, 0x33, 0x44))


def note(t):
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(2)
    run(p, t, size=8, italic=True, color=XAM)


def qs(rows):
    ws = [Cm(1.3), WT - Cm(1.3) - Cm(1.2) - Cm(5.7), Cm(1.2), Cm(5.7)]
    table = doc.add_table(rows=1, cols=4); table.style = "Table Grid"
    for i, t in enumerate(["#", "Câu hỏi — vì sao cần hỏi", "Mức", "Trả lời"]):
        c = table.rows[0].cells[i]; shade(c, "EEEEEE")
        p = c.paragraphs[0]
        if i in (0, 2): p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run(p, t, size=8, bold=True)
    trPr = table.rows[0]._tr.get_or_add_trPr(); trPr.append(OxmlElement("w:tblHeader"))
    for code, q, why, lv in rows:
        cells = table.add_row().cells
        table.rows[-1].height = Cm(0.5); table.rows[-1].height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
        p = cells[0].paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run(p, code, size=8, bold=True); shade(cells[0], "F7F7F7")
        p = cells[1].paragraphs[0]; p.paragraph_format.space_after = Pt(0)
        rich(p, q, size=8.5, bold=True)
        if why:
            pw = cells[1].add_paragraph(); pw.paragraph_format.space_before = Pt(0)
            run(pw, why, size=7, italic=True, color=XAM)
        p = cells[2].paragraphs[0]; p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run(p, lv, size=8, bold=True, color=RED if lv == "P1" else None)
        shade(cells[3], "FFFDF2")
    table.autofit = False
    for r in table.rows:
        for i, w in enumerate(ws): r.cells[i].width = w
    return table


def tbl(header, rows, ws, tick=True):
    table = doc.add_table(rows=1, cols=len(ws)); table.style = "Table Grid"
    for i, t in enumerate(header):
        c = table.rows[0].cells[i]; shade(c, "EEEEEE")
        run(c.paragraphs[0], t, size=8, bold=True)
    trPr = table.rows[0]._tr.get_or_add_trPr(); trPr.append(OxmlElement("w:tblHeader"))
    for r in rows:
        cells = table.add_row().cells
        table.rows[-1].height = Cm(0.5); table.rows[-1].height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
        for i, v in enumerate(r):
            p = cells[i].paragraphs[0]; p.paragraph_format.space_after = Pt(0)
            rich(p, str(v), size=8.5, bold=(i == 0))
        if tick: shade(cells[len(r) - 1], "FFFDF2")
    table.autofit = False
    for row in table.rows:
        for i, w in enumerate(ws): row.cells[i].width = w
    return table


# ================= TIÊU ĐỀ =================
p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(2)
run(p, "BỘ CÂU HỎI CHO MODULE LÊN KẾ HOẠCH SẢN XUẤT", size=14, bold=True)
p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(6)
run(p, "Công ty: ", size=8, bold=True); run(p, "...................................     ", size=8)
run(p, "Ngày: ", size=8, bold=True); run(p, "....../....../2026     ", size=8)
run(p, "Người trả lời: ", size=8, bold=True); run(p, "................................... (quản đốc / kỹ thuật / tổ trưởng)\n", size=8)
run(p, "Bộ câu hỏi này dựng riêng cho module Lên kế hoạch sản xuất, đã gộp các thông tin đã chốt trước đó (quy trình 5 tổ, "
    "Bồi Lares = bước nạp chương trình máy cắt, quy tắc “đầy đủ đơn”). Mức ", size=8)
run(p, "P1", size=8, bold=True, color=RED)
run(p, " = bắt buộc để lập trình; ", size=8)
run(p, "P2", size=8, bold=True)
run(p, " = làm sau cũng được. Câu nào chưa rõ ghi “chưa rõ” — app chạy theo giá trị mặc định ở Phần J.", size=8)

# ================= 6 CÂU CHẶN =================
head("PHẦN A. 6 CÂU CHẶN — trả lời được là bắt đầu lập trình được")
qs([
 ("A1", "Quy tắc “cần đầy đủ đơn để đẩy công đoạn kế tiếp” nghĩa là gì: đủ <b>3 phần của 1 bộ</b> (khung+cánh+phào), hay đủ <b>tất cả các bộ trong đơn hàng</b>?",
  "quyết định app cho đẩy từng bộ hay bắt buộc theo đơn", "P1"),
 ("A2", "Đơn vị thời gian trong bảng công đoạn là <b>giờ</b> hay <b>ngày làm việc</b>? Xưởng có làm <b>thứ 7 / chủ nhật</b> không?",
  "sai đơn vị là sai toàn bộ kế hoạch", "P1"),
 ("A3", "<b>Ép cánh</b> mất bao lâu? <b>Lắp kính + phụ kiện</b> có phải công đoạn không, ai làm, mất bao lâu?",
  "2 công đoạn đang thiếu/trống thời lượng trong bảng", "P1"),
 ("A4", "Mỗi tổ <b>bao nhiêu người</b>, một tuần làm được <b>bao nhiêu bộ</b> (số thực tế, không phải lý thuyết)?",
  "không có số này thì app không cảnh báo được quá tải", "P1"),
 ("A5", "Chương trình <b>Bồi Lares</b> làm theo <b>model nhôm</b> hay theo <b>từng bộ</b>? Chương trình đã có thì nạp lại mất bao lâu?",
  "nếu theo model thì 1 chương trình dùng cho nhiều bộ — tải tính theo model", "P1"),
 ("A6", "Hiện nay <b>ai lên kế hoạch</b>, bao lâu một lần, làm bằng gì (giấy / Excel / bảng trắng / Zalo)? <b>Xin 1 bản mẫu</b>.",
  "app phải thay đúng thứ đang dùng", "P1"),
])

head("PHẦN B. PHẠM VI &amp; ĐIỀU KIỆN VÀO KẾ HOẠCH")
qs([
 ("B1", "Đơn vị lên kế hoạch là <b>1 bộ cửa</b> (theo Bộ số) — đúng chứ? Có trường hợp nửa bộ / lẻ bộ không?", "khóa chính của bảng kế hoạch", "P1"),
 ("B2", "Đơn nào được đưa vào kế hoạch: chỉ <b>Sản xuất + Đã xác nhận</b>, hay cả <b>đơn làm lại</b> / <b>đơn hàng mẫu</b>?", "bộ lọc đầu vào của kế hoạch", "P1"),
 ("B3", "Một bộ được coi là <b>đủ điều kiện vào sản xuất</b> khi nào (đã có bản vẽ duyệt? đã có chương trình máy? đã có nhôm/màu? khách đã xác nhận?)", "tránh xếp lịch ảo rồi máy phải chờ", "P1"),
 ("B4", "Có mẫu “<b>đề nghị sản xuất</b>” / <b>lệnh sản xuất</b> không? Ai phát lệnh, nội dung gồm gì? <b>Xin mẫu</b>.", "app sẽ in phiếu lệnh theo mẫu này", "P1"),
 ("B5", "Bộ số do ai đánh, lúc nào? Trước khi vào kế hoạch đã có Bộ số chưa?", "Bộ số là định danh khi xếp lịch", "P2"),
 ("B6", "“Hạn giao” trên đơn là ngày <b>xưởng làm xong</b> hay ngày <b>giao tới khách</b>?", "mốc mà kế hoạch phải nhắm tới", "P1"),
 ("B7", "Có được <b>giao từng phần</b> (giao trước vài bộ) không?", "chia nhỏ kế hoạch giao hàng", "P2"),
 ("B8", "Xưởng có <b>sản xuất trước / làm tồn kho</b> không, hay chỉ làm theo đơn?", "nếu có thì kế hoạch phải có cả phần dự báo", "P2"),
])

head("PHẦN C. QUY TRÌNH &amp; CÔNG ĐOẠN")
note("Bảng công đoạn hiện có (5 tổ): Tổ Máy: Thiết kế · Bồi Lares · Cắt · Chấn — Tổ Hàn: Hàn · Ép cánh · Test cơ khí — Sơn · Vân — Kho: Vệ sinh + Đóng gói · Kho. "
     "Bồi Lares đã xác nhận là bước nạp chương trình cho máy cắt chuyên dụng (hậu thiết kế).")
qs([
 ("C1", "So với bảng trên, xưởng có công đoạn nào <b>còn thiếu</b> không (ví dụ: mài mối hàn / lắp kính + phụ kiện / kiểm tra trước khi giao)?", "thiếu công đoạn là sai cả tiến độ và hạn giao", "P1"),
 ("C2", "Công đoạn nào làm <b>song song</b> cho khung / cánh / phào, công đoạn nào <b>phải ghép đủ bộ</b> mới làm tiếp?", "biết đâu là 3 luồng song song, đâu là điểm ghép", "P1"),
 ("C3", "Chưa có <b>chương trình Bồi Lares</b> thì máy cắt có chạy được không? Đã bao giờ <b>máy cắt đứng chờ chương trình</b> chưa?", "Bồi Lares là ràng buộc bắt buộc trước khi cắt", "P1"),
 ("C4", "Có mấy <b>máy cắt chuyên dụng</b>, model gì? Chương trình lưu ở đâu, đặt tên theo gì?", "năng lực cắt + dựng thư viện chương trình", "P2"),
 ("C5", "Có <b>chạy thử / cắt mẫu</b> 1 bộ trước khi cắt hàng loạt không? Mất bao lâu?", "nếu có thì thêm một bước trước khi cắt", "P2"),
 ("C6", "Có bước <b>kiểm tra chất lượng</b> ở những đâu? Ai kiểm, ghi kết quả ở đâu?", "app có thể hiện checklist QC theo bộ", "P2"),
 ("C7", "Công đoạn nào <b>thuê ngoài</b> (kính, sơn, phào, phụ kiện)? Thời gian gửi/nhận bao lâu?", "thời gian ngoài vẫn phải nằm trong kế hoạch", "P2"),
 ("C8", "Có <b>dòng sản phẩm khác</b> dùng quy trình khác không (cửa thép, tủ, vách, lan can…)?", "quy trình phải là dữ liệu theo nhóm sản phẩm, không cứng một chuỗi", "P2"),
 ("C9", "Khi khách <b>đổi kích thước/mẫu</b> giữa lúc đang làm: sửa bản vẽ/chương trình mất bao lâu, có phải cắt lại từ đầu không?", "thời gian phát sinh khi đơn thay đổi", "P2"),
 ("C10", "<b>Đơn làm lại</b> (hàng lỗi khách trả): quay lại công đoạn nào? Có chen trước đơn thường không?", "nhánh xử lý mà quy trình chưa có", "P1"),
])

head("PHẦN D. THỜI LƯỢNG &amp; ĐỊNH MỨC (điền vào bảng dưới)")
qs([
 ("D1", "Thời gian nào <b>cố định</b> (thiết kế, bồi Lares, cắt) và thời gian nào <b>tăng theo số bộ</b>?", "công đoạn chuẩn bị không được nhân theo số bộ", "P1"),
 ("D2", "<b>Cắt</b> tính theo gì: số bộ, số mét dài nhôm, hay kích thước? <b>Chấn</b> có phụ thuộc kích thước không?", "công thức định mức thời gian", "P1"),
 ("D3", "Tổ hàn: 1 bộ mất bao lâu? Có phải gom lô theo model để đỡ đổi khuôn/gá không?", "định mức + quy tắc gom lô hàn", "P1"),
 ("D4", "<b>Sơn</b>: 1 mẻ lò bao nhiêu bộ, mất bao lâu, một ngày mấy mẻ? Đổi màu mất bao lâu?", "nút thắt lớn nhất theo bảng công đoạn", "P1"),
 ("D5", "<b>Vân</b>: 1 bộ mất bao lâu, tính theo mét dài hay số bộ? Đổi mã vân mất bao lâu?", "định mức + gom lô vân", "P1"),
 ("D6", "Thời gian <b>chờ</b>: sau sơn bao lâu mới vân được? sau vân bao lâu mới lắp kính/đóng gói? sau bồi Lares bao lâu mới cắt?", "thời gian chờ hay bị bỏ quên khi xếp lịch", "P1"),
 ("D7", "<b>Lắp kính + phụ kiện</b> mất bao lâu 1 bộ? <b>Vệ sinh + đóng gói</b> mất bao lâu 1 bộ?", "2 công đoạn cuối còn thiếu định mức", "P1"),
 ("D8", "Thời gian <b>đổi setup</b>: đổi khuôn chấn / đổi model nhôm / đổi màu sơn / đổi mã vân mất bao lâu mỗi lần?", "dùng để quyết định có nên gom lô hay không", "P1"),
 ("D9", "Có <b>công đoạn nào làm trước được</b> (không phụ thuộc công đoạn trước) để tranh thủ khi rảnh không?", "tăng khả năng lấp đầy năng lực", "P2"),
])

note("Bảng thời lượng công đoạn — điền ô còn trống (đơn vị: ............). Cột “Loại”: G = gia công (tăng theo số bộ) / C = chuẩn bị (theo file/model).")
rows_tg = [
 ("1", "Thiết kế", "C", "1", ""),
 ("2", "Bồi Lares (nạp chương trình máy cắt)", "C", "1", ""),
 ("3", "Cắt (khung / cánh / phào)", "G", "1", ""),
 ("4", "Chấn (khung / cánh / phào)", "G", "1", ""),
 ("5", "Hàn (khung / cánh / phào)", "G", "2", ""),
 ("6", "Ép cánh", "G", "", "chưa có số"),
 ("7", "Test cơ khí", "G", "1", ""),
 ("8", "Sơn", "G", "2", ""),
 ("9", "Vân (khung / cánh / phào)", "G", "2", ""),
 ("10", "Lắp kính + phụ kiện", "G", "", "chưa có công đoạn này"),
 ("11", "Vệ sinh + Đóng gói", "G", "1", ""),
 ("12", "Kho / giao hàng", "G", "0", ""),
 ("13", "Chờ khô sau sơn", "-", "", "chưa có số"),
 ("14", "Chờ sau vân trước khi đóng gói", "-", "", "chưa có số"),
]
tbl(["#", "Công đoạn", "Loại", "Số (bảng gốc)", "Trả lời / bổ sung"], rows_tg, [Cm(1.0), Cm(6.4), Cm(1.3), Cm(2.3), Cm(7.8)])

head("PHẦN E. NĂNG LỰC &amp; NGUỒN LỰC")
qs([
 ("E1", "Mỗi tổ: <b>mấy người, mấy ca, giờ làm</b>? Một tuần làm được <b>bao nhiêu bộ</b> (ghi từng tổ)?", "năng lực — con số quan trọng nhất của module", "P1"),
 ("E2", "Cả xưởng 1 tuần “ra” được bao nhiêu bộ? Cao điểm tăng ca được bao nhiêu %?", "so tải kế hoạch với năng lực thật", "P1"),
 ("E3", "Máy móc từng tổ: <b>mấy máy, model gì</b>? Máy chấn có mấy khuôn, 3 luồng khung/cánh/phào có tranh máy không?", "nút thắt theo máy/khuôn, không chỉ theo người", "P1"),
 ("E4", "Khâu <b>kỹ thuật</b> (thiết kế + Bồi Lares): mấy người? Mỗi tuần bao nhiêu <b>model mới</b> phải làm chương trình? Có bị nghẽn không?", "có thể là nút thắt thật của xưởng", "P1"),
 ("E5", "Có giới hạn <b>chỗ để hàng chờ</b> giữa công đoạn không? Bao nhiêu bộ thì hết chỗ?", "quyết định “đủ đơn mới đẩy” có phải vì hết chỗ", "P2"),
 ("E6", "<b>Giao hàng</b>: mấy xe, mấy chuyến/ngày, gom theo khu vực? Có lắp đặt tại công trình không?", "đội giao hàng cũng là một nguồn lực phải xếp", "P2"),
 ("E7", "Tổ nào đang <b>chờ nhiều nhất / hay nghẽn nhất</b> trong thực tế?", "ưu tiên tối ưu đúng chỗ", "P1"),
])

head("PHẦN F. XẾP LỊCH, GOM LÔ &amp; NGOẠI LỆ")
qs([
 ("F1", "Kế hoạch hiện chia theo <b>tuần, ngày, tổ hay đơn</b>? Màn hình chính của app nên theo cái nào?", "quyết định màn hình chính của module", "P1"),
 ("F2", "Khi xếp lịch, ưu tiên theo: <b>hạn giao</b> / <b>đơn đến trước</b> / <b>khách giục</b> / <b>vật tư đã có</b>?", "thuật toán xếp lịch", "P1"),
 ("F3", "Ai được quyền <b>chen đơn gấp</b> lên trước? Sale có tự chen được không?", "phân quyền + quy tắc ưu tiên", "P1"),
 ("F4", "<b>Gom lô sơn</b>: tối thiểu bao nhiêu bộ cho 1 lô màu? Khách cần 1 bộ màu lạ thì xử lý sao?", "nút thắt sơn — gom lô sai là tăng lead time", "P1"),
 ("F5", "<b>Gom lô vân</b>: theo mã vân? tối thiểu bao nhiêu bộ?", "giảm thời gian đổi mã vân", "P1"),
 ("F6", "<b>Gom lô chấn/cắt</b> theo model nhôm? tối thiểu bao nhiêu bộ? Đổi model mất bao lâu?", "quyết định xếp chung tuần hay rải tuần", "P1"),
 ("F7", "Nếu <b>thiếu 1–2 bộ</b> trong đơn (thiếu nhôm/màu/kính), các bộ còn lại có được đẩy sang công đoạn kế tiếp không?", "ngoại lệ của quy tắc A1 — ảnh hưởng lớn tới hạn giao", "P1"),
 ("F8", "Kế hoạch có cần <b>chừa thời gian</b> cho hàng lỗi/làm lại không? Ước bao nhiêu %?", "dự phòng làm lại để không trễ hạn", "P2"),
 ("F9", "Có <b>mùa cao điểm</b> không? Tháng nào? Chênh lệch bao nhiêu %?", "kế hoạch theo mùa + dự báo", "P2"),
 ("F10", "Khi thực tế lệch kế hoạch (máy hỏng, nghỉ người, khách đổi): <b>ai cập nhật lại</b> và cập nhật ở đâu?", "app cần màn hình cập nhật nhanh", "P1"),
 ("F11", "Tỷ lệ <b>trễ hạn</b> hiện nay bao nhiêu %? Nguyên nhân chính (chờ nhôm / chờ chương trình / sơn / khách đổi / thiếu người / giao hàng)?", "cần danh mục lý do trễ + đo lường được", "P1"),
 ("F12", "Đơn <b>hủy giữa lúc đang sản xuất</b>: xử lý thế nào? Hàng đã làm dở tính sao?", "xử lý đơn hủy — app mới chỉ có trạng thái Đã hủy", "P2"),
])

head("PHẦN G. CẬP NHẬT TIẾN ĐỘ &amp; ĐẦU RA")
qs([
 ("G1", "Xưởng muốn <b>cập nhật tiến độ</b> ở đâu: máy tính ở xưởng, điện thoại, hay ghi giấy rồi văn phòng nhập?", "quyết định app có được dùng thật hay không", "P1"),
 ("G2", "Cập nhật theo mức <b>bộ</b> hay mức <b>từng công đoạn</b>? Ai là người nhập?", "chi tiết quá thì không ai nhập", "P1"),
 ("G3", "Có cần <b>in phiếu lệnh sản xuất</b> cho từng tổ không? In nội dung gì, khổ giấy nào?", "mẫu in (app đã có sẵn công cụ in)", "P2"),
 ("G4", "Có cần <b>in danh sách việc theo ngày/tuần</b> để dán ở xưởng không?", "mẫu in thứ hai", "P2"),
 ("G5", "Mỗi ngày xưởng cần xem gì: <b>việc hôm nay của tổ / việc đang chậm / việc đã xong / tải tuần sau</b>?", "thiết kế màn hình kế hoạch", "P1"),
 ("G6", "Có cần <b>gắn tên thợ</b> vào từng bộ để tính năng suất / lỗi theo người không?", "nếu có thì app phải lưu người phụ trách", "P2"),
 ("G7", "Có cần theo dõi <b>máy đang dừng</b> và <b>lý do dừng</b> (bảo trì, hỏng, chờ chương trình, chờ vật tư)?", "dừng máy làm giảm năng lực thật", "P2"),
 ("G8", "Có cần <b>cảnh báo</b>: quá tải theo tổ · “chờ đủ đơn” · “chờ chương trình máy cắt” · bộ sắp trễ hạn?", "cảnh báo là giá trị chính của module", "P1"),
 ("G9", "<b>Báo cáo cuối tuần</b> cần gì: số bộ ra, số bộ trễ, năng suất từng tổ, số việc còn lại?", "đầu ra báo cáo", "P2"),
 ("G10", "Có <b>chấm công / tính lương theo sản phẩm</b> không? Có muốn app hỗ trợ không?", "nếu có là module phụ, cần biết trước để chừa dữ liệu", "P2"),
])

head("PHẦN H. DỮ LIỆU APP CẦN THÊM (đánh dấu: Cần / Không cần)")
rows_h = [
 ("Trạng thái sản xuất từng BỘ (Chờ SX / Đang SX / Hoàn thành / Đã giao / Tạm dừng)", "biết bộ nào đã xong", ""),
 ("Trạng thái từng CÔNG ĐOẠN của từng bộ (nếu xưởng nhập được)", "theo dõi chi tiết tới từng bước", ""),
 ("Loại công đoạn: GIA_CONG / CHUAN_BI", "công đoạn chuẩn bị không nhân theo số bộ", ""),
 ("Phạm vi công việc: KHUNG / CÁNH / PHAO / CẢ BỘ", "biết khung đã hàn xong hay chưa", ""),
 ("Chương trình máy cắt theo model (tên file, phiên bản, máy, người làm, ngày, thời gian)", "tái sử dụng; cảnh báo model chưa có chương trình", ""),
 ("Giờ công định mức theo loại cửa / model", "tính tải chính xác", ""),
 ("Năng lực từng tổ (số người, bộ/tuần, giờ/tuần)", "cảnh báo quá tải", ""),
 ("Thời gian setup (đổi màu sơn / mã vân / khuôn chấn / model nhôm)", "quyết định gom lô", ""),
 ("Thời gian chờ (khô sau sơn, sau vân, sau bồi Lares)", "không xếp sát nhau khi hàng chưa khô", ""),
 ("Tổ phụ trách + Người phụ trách từng bộ/công đoạn", "phân công & năng suất", ""),
 ("Ngày bắt đầu / kết thúc thực tế từng công đoạn", "biết chỗ nào trễ, đo năng suất thật", ""),
 ("Ngày hoàn thành sản xuất (đơn/bộ)", "so với hạn giao", ""),
 ("Ngày giao thực tế", "tính tỷ lệ giao đúng hạn", ""),
 ("Lý do trễ (danh mục: chờ nhôm, chờ chương trình, chờ lô sơn, khách đổi, thiếu người, máy hỏng…)", "thống kê nguyên nhân trễ", ""),
 ("Lỗi & làm lại (bộ nào, công đoạn nào, mất bao lâu)", "tỷ lệ lỗi theo tổ", ""),
 ("Ghi chú sản xuất theo bộ (khác ghi chú của sale)", "yêu cầu kỹ thuật phát sinh khi làm", ""),
 ("Đính kèm bản vẽ / ảnh / chương trình theo bộ", "thay vì gửi Zalo thủ công", ""),
]
tbl(["Trường đề xuất thêm", "Ý nghĩa", "Cần?"], rows_h, [Cm(8.4), Cm(6.9), Cm(2.1)])

head("PHẦN I. KIỂM TRA CHÉO — app đang có, xưởng có dùng không?")
note("Ghi: Có (xưởng dùng) / Không (không cần) / Thiếu gì (chưa đủ để sản xuất).")
rows_i = [("Bộ số (set_no)", ""), ("Mã hàng · Tên sản phẩm · Model nhôm", ""), ("Loại mở · Hướng phào · Loại phào · Số phào", ""),
          ("Số cánh · Thông tin cánh/panel · Ô thoáng", ""), ("Màu sơn", ""), ("Cao × Rộng · Khung bao · Thông thủy cao/rộng", ""),
          ("Mã khoá · Phụ kiện (tên/SL/ảnh)", ""), ("Ghi chú dòng hàng", ""), ("Ảnh sản phẩm / ảnh chi tiết", ""),
          ("Hạn giao · Ngày đặt hàng", ""), ("Khách hàng / Đại lý / Khu vực / Số km", ""), ("KH/Lượng (pricing_quantity) & ĐVT", "")]
tbl(["Trường dữ liệu", "Xưởng có dùng không? (Có / Không / Thiếu gì?)"], rows_i, [Cm(8.4), WT - Cm(8.4)])

doc.add_page_break()
head("PHẦN J. MẶC ĐỊNH nếu chưa trả lời được (app vẫn chạy, sửa lại sau)")
mac = [
 ("Đơn vị kế hoạch", "1 bộ cửa (theo Bộ số); cho phép nửa bộ như trường hợp đặc biệt"),
 ("Đơn vào kế hoạch", "Sản xuất + Đã xác nhận; đơn làm lại bật/tắt bằng cấu hình; đơn mẫu không vào"),
 ("Điều kiện vào sản xuất", "Đã xác nhận + có Bộ số + có hạn giao (cảnh báo vàng nếu thiếu bản vẽ/chương trình)"),
 ("Đơn vị thời gian", "Ngày làm việc, thứ 2 – thứ 6, nghỉ chủ nhật"),
 ("Thiết kế", "1 ngày · = 0 nếu mã hàng đã có mẫu"),
 ("Bồi Lares", "1 ngày cho model MỚI · = 0 nếu chương trình đã có · chặn trước Cắt"),
 ("Ép cánh", "1 ngày"),
 ("Lắp kính + phụ kiện", "1 ngày, sau Vân, trước Vệ sinh + Đóng gói"),
 ("Test cơ khí", "1 ngày"),
 ("Chờ khô", "Sau sơn 1 ngày; sau vân 1 ngày"),
 ("Công đoạn theo số bộ", "Cắt 1 · Chấn 1 · Hàn 2 · Sơn 2 · Vân 2 · VS+ĐG 1 (theo bảng gốc)"),
 ("Năng lực tổ", "Để trống — lập được kế hoạch nhưng chưa cảnh báo quá tải cho tới khi nhập số"),
 ("Quy tắc đẩy công đoạn", "Cho đẩy TỪNG BỘ khi bộ đã đủ (nếu xưởng xác nhận “đủ đơn” thì bật lại)"),
 ("Ưu tiên xếp lịch", "Hạn giao gần nhất trước (EDD)"),
 ("Gom lô", "Không giới hạn lô; chỉ gợi ý gom theo màu sơn / mã vân / model nhôm"),
 ("Đơn làm lại", "Ưu tiên cao nhất, bắt đầu ở công đoạn bị lỗi (chọn tay)"),
 ("Máy dừng", "Có danh mục lý do dừng: bảo trì · hỏng · chờ chương trình · chờ vật tư · thiếu người"),
 ("Cập nhật tiến độ", "1 người xưởng/văn phòng nhập hằng ngày, theo mức BỘ; bật chi tiết công đoạn sau"),
 ("Cảnh báo", "Quá tải tổ ≥ 100% năng lực · bộ sắp trễ hạn (trước 2 ngày) · chờ đủ đơn · chờ chương trình"),
 ("Trễ hạn tính cho", "Chỉ đơn đã xác nhận"),
 ("Ngày giao thực tế", "Nhập khi giao (nếu xưởng chưa có thói quen thì bắt đầu bằng phiếu giao hàng giấy)"),
]
tbl(["Hạng mục", "Giá trị mặc định dùng tạm"], mac, [Cm(4.2), WT - Cm(4.2)])

head("XIN KÈM THEO (nếu có)")
for line in ["[   ] Mẫu KẾ HOẠCH SẢN XUẤT xưởng đang dùng (giấy / Excel / ảnh bảng trắng / ảnh Zalo)",
             "[   ] Mẫu ĐỀ NGHỊ SẢN XUẤT / PHIẾU LỆNH SẢN XUẤT đang dùng",
             "[   ] Danh sách máy móc từng tổ (số máy, model, tình trạng) + số người mỗi tổ",
             "[   ] Danh mục MÀU SƠN + MÃ VÂN đang dùng",
             "[   ] Danh sách model nhôm + loại cửa bán chạy nhất",
             "[   ] 1 bộ bản vẽ mẫu + 1 chương trình máy cắt mẫu (nếu xưởng cho)",
             "[   ] Mẫu phiếu giao hàng + cách ghi ngày giao thực tế",
             "[   ] Ảnh chụp từng tổ + chỗ để hàng chờ giữa các công đoạn",
             "[   ] Số liệu 1–2 tháng gần đây: số bộ/tuần, số đơn trễ hạn, số đơn làm lại"]:
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(1)
    run(p, line, size=8.5)

p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(10)
run(p, "GOLDMAX · Bộ câu hỏi cho module Lên kế hoạch sản xuất · V122 (thay thế V117/V118 khi làm module này; "
       "V118 giữ để tra cứu chi tiết theo từng tổ). Tài liệu tham chiếu: V115, V116, V119, V120, V121.", size=7.5, italic=True, color=XAM)

out = "/home/user/.workspace/artifacts/bo-cau-hoi-ke-hoach-san-xuat-v122.docx"
doc.save(out)
print("đã tạo:", out)
