# -*- coding: utf-8 -*-
"""V123 — Bộ câu hỏi ĐẦY ĐỦ CHI TIẾT THEO TỔ & CÔNG ĐOẠN (module Lên kế hoạch sản xuất) — phần 1/2."""
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ROW_HEIGHT_RULE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import re as _re

DO = RGBColor(0x0E, 0x74, 0x90); XAM = RGBColor(0x55, 0x55, 0x55); RED = RGBColor(0xB9, 0x1C, 0x1C)
XANH = RGBColor(0x0B, 0x4A, 0x6F)
doc = Document()
s = doc.sections[0]
s.page_width, s.page_height = Cm(21), Cm(29.7)
s.left_margin = s.right_margin = Cm(1.1); s.top_margin = Cm(1.1); s.bottom_margin = Cm(1.2)
n = doc.styles["Normal"]; n.font.name = "Arial"; n.font.size = Pt(9)
n._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial"); n._element.rPr.rFonts.set(qn("w:cs"), "Arial")
WT = Cm(21 - 2.2)


def run(p, t, size=9, bold=False, italic=False, color=None):
    r = p.add_run(t); r.font.name = "Arial"; r.font.size = Pt(size); r.bold = bold; r.italic = italic
    if color is not None: r.font.color.rgb = color
    r._element.rPr.rFonts.set(qn("w:cs"), "Arial"); return r


def rich(p, text, size=9, bold=False, italic=False, color=None):
    for part in _re.split(r'(<b>.*?</b>)', text):
        if not part: continue
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


def sub(t):
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(6); p.paragraph_format.space_after = Pt(2)
    rich(p, t, size=9.5, bold=True, color=XANH)


def note(t):
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(2)
    rich(p, t, size=8, italic=True, color=XAM)


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
run(p, "BỘ CÂU HỎI TỔNG HỢP ĐẦY ĐỦ — MODULE LÊN KẾ HOẠCH SẢN XUẤT", size=13.5, bold=True)
p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(5)
run(p, "Công ty: ", size=8, bold=True); run(p, ".....................................     ", size=8)
run(p, "Ngày: ", size=8, bold=True); run(p, "....../....../2026     ", size=8)
run(p, "Người trả lời: ", size=8, bold=True); run(p, "..................................... (quản đốc / tổ trưởng / kỹ thuật)\n", size=8)
run(p, "Cách dùng: PHẦN A–B cho quản đốc · PHẦN C–H gửi từng tổ tự điền · PHẦN I cho người lên kế hoạch · PHẦN J câu bổ sung · PHẦN K–O bảng điền và mặc định. Mức ", size=8)
run(p, "P1", size=8, bold=True, color=RED)
run(p, " = bắt buộc để lập trình; ", size=8); run(p, "P2", size=8, bold=True)
run(p, " = làm sau cũng được. Chưa rõ thì ghi “chưa rõ” — app chạy theo mặc định ở mục 10.\n", size=8)
run(p, "Trong mỗi công đoạn, câu hỏi đi theo đúng 7 nhóm để tổ dễ trả lời: ", size=8, italic=True, color=XAM)
run(p, "① nội dung & phạm vi · ② thời lượng · ③ nguồn lực & máy móc · ④ setup & gom lô · ⑤ chờ & ràng buộc · ⑥ kiểm tra & lỗi · ⑦ ghi nhận trong app.", size=8, italic=True, color=XAM)

# ================= 1. TỔ MÁY =================

head("PHẦN A. 7 CÂU CHẶN — trả lời được là bắt đầu lập trình được")
note("Trả lời ngay ở đây, hoặc trả lời ở phần chi tiết (cột “Chi tiết ở”) — chỉ cần trả lời một lần.")
tbl(["#", "Câu hỏi chặn", "Chi tiết ở", "Trả lời"], [
 ("A1", "Quy tắc “cần <b>đầy đủ đơn</b> để đẩy công đoạn kế tiếp”: đủ <b>3 phần của 1 bộ</b> (khung+cánh+phào) hay đủ <b>tất cả các bộ trong đơn hàng</b>?", "CH5 · F7", ""),
 ("A2", "<b>Đơn vị thời gian</b> trong bảng công đoạn là <b>giờ</b> hay <b>ngày làm việc</b>? Có làm <b>thứ 7 / chủ nhật</b> không? Ngày lễ tính thế nào?", "trả lời ngay ở đây", ""),
 ("A3", "<b>Ép cánh</b> mất bao lâu? <b>Lắp kính + phụ kiện</b> có phải công đoạn không, do ai làm, mất bao lâu?", "EP3 · LK1 · LK4", ""),
 ("A4", "Mỗi tổ <b>bao nhiêu người</b> và một tuần làm được <b>bao nhiêu bộ</b> (số thực tế, không phải lý thuyết)?", "E1", ""),
 ("A5", "Chương trình <b>Bồi Lares</b> làm theo <b>model nhôm</b> hay theo <b>từng bộ</b>? Chương trình đã có thì nạp lại mất bao lâu?", "BL1 · BL3", ""),
 ("A6", "Hiện nay <b>ai lên kế hoạch</b>, bao lâu một lần, làm bằng gì? <b>Xin 1 bản mẫu kế hoạch.</b>", "KH1 · KH2", ""),
 ("A7", "Khi xếp lịch, ưu tiên theo <b>hạn giao</b> / <b>đơn đến trước</b> / <b>khách giục</b> / <b>vật tư đã có</b>?", "F2", ""),
], [Cm(1.0), Cm(9.2), Cm(2.3), Cm(5.7)])

head("PHẦN B. PHẠM VI & ĐIỀU KIỆN VÀO KẾ HOẠCH")
qs([
 ("B1", "Đơn vị lên kế hoạch là <b>1 bộ cửa</b> (theo Bộ số) — đúng chứ? Có trường hợp nửa bộ / lẻ bộ không?", "khóa chính của bảng kế hoạch", "P1"),
 ("B2", "Đơn nào được đưa vào kế hoạch: chỉ <b>Sản xuất + Đã xác nhận</b>, hay cả <b>đơn làm lại</b> / <b>đơn hàng mẫu</b>?", "bộ lọc đầu vào — chi tiết ở KH17 · KH18", "P1"),
 ("B3", "Một bộ được coi là <b>đủ điều kiện vào sản xuất</b> khi nào (bản vẽ đã duyệt · chương trình đã có · nhôm/màu đã có · khách đã xác nhận)?", "tránh xếp lịch ảo rồi máy phải chờ", "P1"),
 ("B4", "Hiện có mẫu <b>“đề nghị sản xuất” / “lệnh sản xuất”</b> không? <b>Ai phát lệnh</b> cho xưởng? Gồm những nội dung gì? <b>Xin 1 bản mẫu.</b>", "app sẽ in phiếu lệnh theo mẫu này", "P1"),
 ("B5", "<b>Bộ số</b> do ai đánh, lúc nào? Trước khi vào kế hoạch đã có Bộ số chưa? Trùng số thì xử lý sao?", "Bộ số là định danh khi xếp lịch", "P2"),
 ("B6", "“Hạn giao” ghi trên đơn là ngày <b>xưởng làm xong</b> hay ngày <b>giao tới khách</b>?", "mốc mà kế hoạch phải nhắm tới", "P1"),
 ("B7", "Có được <b>giao từng phần</b> (giao trước vài bộ) không?", "chia nhỏ kế hoạch giao hàng", "P2"),
 ("B8", "Có cần <b>nhập các đơn đang sản xuất dở</b> vào app lúc bắt đầu không? Hiện có bao nhiêu đơn/bộ đang dở?", "không nhập thì tuần đầu kế hoạch thiếu hàng thật", "P1"),
])

head("PHẦN C. TỔ MÁY — Thiết kế · Bồi Lares · Cắt · Chấn")
sub("C.1. Công đoạn THIẾT KẾ")
qs([
 ("TK1", "① 1 bộ cửa cần những bản vẽ gì (cắt nhôm, cánh/panel, kính, lắp ráp)? Có bản vẽ khung bao / ô thoáng riêng không?", "app cần biết phải lưu/ in gì theo bộ", "P1"),
 ("TK2", "② Một bộ (hoặc một model) thiết kế mất bao lâu? Có phụ thuộc loại cửa / kích thước không?", "định mức thời gian của bước chuẩn bị", "P1"),
 ("TK3", "③ Ai làm, mấy người? Dùng phần mềm gì? Làm ở văn phòng hay tại xưởng?", "đây là nguồn lực riêng, không cộng vào năng lực tổ thợ", "P1"),
 ("TK4", "④ Model/mã hàng đã từng làm thì có dùng lại bản vẽ cũ không? Khách đổi thì sửa mất bao lâu?", "nếu tái sử dụng được thì thời lượng = 0 với mã quen", "P1"),
 ("TK5", "⑤ Thiết kế cần những thông tin gì từ đơn (cao/rộng · khung bao · thông thủy · số cánh · ô thoáng · màu · loại kính · hướng mở)? App đang có đủ chưa, còn thiếu gì?", "đây là danh sách trường app phải bổ sung/bắt buộc", "P1"),
 ("TK6", "⑥ Ai duyệt bản vẽ? Khách có phải duyệt trước khi sản xuất không? Duyệt xong mới được cắt đúng không?", "mốc “đủ điều kiện vào sản xuất”", "P1"),
 ("TK7", "⑦ Có cần lưu bản vẽ lên app theo từng bộ để tổ xem tại xưởng không?", "thay việc gửi Zalo thủ công", "P2"),
])
sub("C.2. Công đoạn <b>BỒI LARES</b> — nạp chương trình cho MÁY CẮT CHUYÊN DỤNG (hậu thiết kế)")
note("Đã xác nhận: Bồi Lares là bước chuyển file thiết kế sang chương trình cho máy cắt chuyên dụng (không phải vật liệu, không phải ép cốt).")
qs([
 ("BL1", "① Chương trình làm theo <b>MODEL NHÔM</b> hay theo <b>TỪNG BỘ / kích thước</b>? Một chương trình dùng lại được cho các đơn sau không?", "nếu theo model thì 1 chương trình dùng cho nhiều bộ — tải tính theo model", "P1"),
 ("BL2", "③ Ai làm chương trình (kỹ thuật / văn phòng hay tại máy cắt)? Mấy người? Dùng phần mềm gì?", "xác định đây là nguồn lực riêng (nhóm KỸ THUẬT/CAM)", "P1"),
 ("BL3", "② Chương trình <b>MỚI</b> (model chưa từng làm) mất bao lâu? Chương trình <b>ĐÃ CÓ</b> thì nạp lại/sửa mất bao lâu?", "hai con số khác nhau — app cần cả hai để tính tải", "P1"),
 ("BL4", "⑤ Chưa có chương trình thì máy cắt có chạy được không? Đã bao giờ <b>máy cắt đứng chờ chương trình</b> chưa?", "đây là ràng buộc bắt buộc (prerequisite) của công đoạn Cắt", "P1"),
 ("BL5", "① Một chương trình gồm những phần nào (khung / cánh / phào)? Là 1 file cho cả bộ hay mỗi phần 1 file?", "biết đơn vị theo dõi: theo bộ hay theo bộ phận", "P2"),
 ("BL6", "④ Chương trình lưu ở đâu (phần mềm máy / máy tính / USB)? Đặt tên theo gì? Khách đổi thì tạo phiên bản mới thế nào?", "để dựng thư viện chương trình theo model trong app", "P2"),
 ("BL7", "③ Xưởng có mấy <b>máy cắt chuyên dụng</b>? Model máy gì, đọc định dạng file nào, có phải chuyển file bằng tay (USB) không?", "năng lực cắt thật + chương trình phải khớp máy", "P2"),
 ("BL8", "⑥ Có <b>chạy thử / cắt mẫu</b> 1 bộ trước khi cắt hàng loạt không? Mất bao lâu? Có phải kiểm mẫu rồi mới chạy tiếp không?", "nếu có thì thêm một bước và một khoản thời gian trước khi cắt", "P2"),
 ("BL9", "⑤ Khách đổi kích thước/mẫu giữa lúc đang làm thì <b>sửa chương trình</b> mất bao lâu? Có phải cắt lại từ đầu không?", "thời gian phát sinh khi đơn thay đổi giữa chừng", "P1"),
])
sub("C.3. Công đoạn CẮT")
qs([
 ("C1", "③ Cắt bằng máy gì (máy chuyên dụng / CNC / cắt tay)? Mấy máy, mấy người đứng máy?", "năng lực thật của công đoạn cắt", "P1"),
 ("C2", "① Cắt cho những phần nào: khung · cánh · phào? Là 3 việc làm song song hay 1 người làm lần lượt?", "3 luồng song song — ảnh hưởng cách xếp tải", "P1"),
 ("C3", "② Thời gian cắt tính theo gì: số bộ · số mét dài nhôm · số thanh? Một bộ mất bao lâu?", "công thức định mức thời gian", "P1"),
 ("C4", "④ Đổi sang model nhôm khác mất bao lâu (đổi dao, cài đặt, lấy nhôm)? Có gom các bộ cùng model để cắt chung không?", "thời gian setup — quyết định có nên gom lô cắt", "P1"),
 ("C5", "⑤ Nhôm có sẵn kho theo model hay phải đặt theo đơn? Chờ bao lâu? App có cần cảnh báo “thiếu nhôm” trước khi xếp lịch?", "nếu chờ lâu thì kế hoạch phải chừa thời gian vật tư", "P1"),
 ("C6", "⑤ Cắt có phải chờ <b>chương trình Bồi Lares</b> không? Thường chờ bao lâu?", "đo mức độ rủi ro của ràng buộc bắt buộc", "P1"),
 ("C7", "⑥ Sau cắt có kiểm tra kích thước / số lượng không? Ai kiểm? Cắt sai/hụt xử lý thế nào, mất bao lâu?", "điểm QC + xử lý lỗi", "P2"),
 ("C8", "③② Một ngày cắt được bao nhiêu bộ? Nhôm cắt xong để chờ chấn được bao lâu, có giới hạn chỗ không?", "năng lực + giới hạn hàng chờ", "P1"),
])
sub("C.4. Công đoạn CHẤN")
qs([
 ("CH1", "③ Có mấy máy chấn? Cần khuôn riêng theo model nhôm không? Hiện có mấy khuôn?", "nút thắt theo khuôn, không chỉ theo người", "P1"),
 ("CH2", "① Chấn khung / cánh / phào trên cùng 1 máy hay máy khác nhau? Có bị tranh máy giữa 3 luồng không?", "tranh chấp máy giữa 3 luồng khung/cánh/phào", "P1"),
 ("CH3", "② Một bộ chấn mất bao lâu? Có phụ thuộc kích thước cửa / độ dài thanh không?", "định mức thời gian", "P1"),
 ("CH4", "④ Đổi khuôn / đổi model mất bao lâu? Có gom lô theo model để đỡ đổi khuôn không? Tối thiểu bao nhiêu bộ 1 lượt?", "thời gian setup + quy tắc gom lô", "P1"),
 ("CH5", "⑤ Ghi chú trong bảng: <b>“cần đầy đủ đơn để đẩy công đoạn kế tiếp”</b> — nghĩa là đủ <b>3 phần của 1 bộ</b> (khung+cánh+phào), hay đủ <b>tất cả các bộ trong đơn</b>?", "quyết định app cho đẩy từng bộ hay bắt buộc theo đơn — câu chặn quan trọng nhất", "P1"),
 ("CH6", "⑥ Sau chấn có kiểm tra góc / kích thước không? Ai kiểm? Chấn lỗi (méo, lệch góc) sửa được không hay phải cắt lại?", "điểm QC + xử lý lỗi", "P2"),
 ("CH7", "③② Một ngày chấn được bao nhiêu bộ? Hàng đã chấn để chờ hàn ở đâu, được bao lâu?", "năng lực + chỗ để hàng chờ", "P1"),
])
sub("C.5. TỔ MÁY — câu hỏi chung")
qs([
 ("TM1", "③ Tổ máy bao nhiêu người? Chia thế nào cho 4 việc: thiết kế · Bồi Lares · cắt · chấn?", "năng lực theo người", "P1"),
 ("TM2", "③ Làm mấy ca? Giờ bắt đầu – kết thúc? Nghỉ trưa bao lâu?", "quy đổi ngày công ra giờ làm việc", "P1"),
 ("TM3", "② Một ngày tổ máy ra được bao nhiêu bộ “sạch” (đã chấn xong, sẵn sàng chuyển hàn)?", "đầu ra của tổ để tính tải", "P1"),
 ("TM4", "⑥ Máy nào hay hỏng / phải bảo trì? Bao lâu bảo trì 1 lần, mất bao lâu?", "app phải chừa thời gian dừng máy, không xếp kín", "P2"),
 ("TM5", "⑤ Việc nào ở tổ máy hay bị kẹt nhất: chờ nhôm · chờ chương trình · chờ thiết kế · chờ máy?", "nguyên nhân trễ để app cảnh báo đúng chỗ", "P1"),
 ("TM6", "⑦ Tổ máy cập nhật tiến độ ở đâu? Ai cập nhật (tổ trưởng hay văn phòng)?", "quyết định giao diện nhập liệu", "P1"),
])

doc.add_page_break()
# ================= 2. TỔ HÀN =================
head("PHẦN D. TỔ HÀN — Hàn · Ép cánh · Test cơ khí")
sub("D.1. Công đoạn HÀN")
qs([
 ("HAN1", "③ Hàn bằng máy gì, mấy máy, mấy người?", "năng lực", "P1"),
 ("HAN2", "① Hàn những phần nào: khung · cánh · phào? 3 người làm song song hay 1 người tuần tự?", "3 luồng song song hay tuần tự", "P1"),
 ("HAN3", "② Một bộ hàn mất bao lâu? Tính theo số góc / mối hàn hay theo bộ?", "định mức thời gian", "P1"),
 ("HAN4", "④ Có phải gom lô theo model để đỡ đổi khuôn/gá không? Tối thiểu bao nhiêu bộ 1 lượt?", "quy tắc gom lô hàn", "P1"),
 ("HAN5", "⑤ Có phải chờ <b>đủ 3 phần</b> (khung, cánh, phào) mới hàn được không? Hàng chờ ở đâu, tối đa bao nhiêu bộ?", "điều kiện vào công đoạn + giới hạn hàng chờ", "P1"),
 ("HAN6", "⑥ Sau hàn có <b>mài mối hàn / làm sạch ba via</b> không? Ai làm, mất bao lâu? Có kiểm mối hàn không?", "bước hoàn thiện thường bị bỏ sót khi định mức", "P1"),
 ("HAN7", "⑥⑦ Mối hàn lỗi xử lý thế nào, mất bao lâu? Một ngày tổ hàn được bao nhiêu bộ?", "xử lý lỗi + năng lực", "P1"),
])
sub("D.2. Công đoạn ÉP CÁNH  (bảng công đoạn đang để trống thời gian)")
qs([
 ("EP1", "① Ép cánh là ép cái gì vào cánh (tấm cốt / panel nhôm / kính)? Làm cho loại cửa nào?", "xác định đúng công đoạn và phạm vi áp dụng", "P1"),
 ("EP2", "③ Có máy ép không, mấy cái? Mỗi lượt ép được bao nhiêu cánh?", "năng lực + gom lô ép", "P1"),
 ("EP3", "② Một bộ (hoặc 1 cánh) ép mất bao lâu? Có phải <b>chờ keo khô</b> không, bao lâu?", "định mức + thời gian chờ", "P1"),
 ("EP4", "⑤ Ép cánh nằm ở đâu trong chuỗi: trước hay sau khi hàn cánh? Trước hay sau Test cơ khí?", "thứ tự công đoạn trong kế hoạch", "P1"),
 ("EP5", "④⑤ Vật tư (keo, cốt) lấy từ kho hay đặt ngoài? Có bị thiếu làm dừng việc không?", "ảnh hưởng lead time và cảnh báo vật tư", "P2"),
 ("EP6", "⑥ Ép lỗi (bọt khí, lệch, bong) xử lý thế nào? Có phải làm lại từ đầu không? Mất bao lâu?", "làm lại — ảnh hưởng lớn tới lead time", "P2"),
 ("EP7", "②③ Một ngày ép được bao nhiêu bộ?", "năng lực", "P1"),
])
sub("D.3. Công đoạn TEST CƠ KHÍ")
qs([
 ("TC1", "① Test gồm những gì (đóng/mở, khe hở cánh, khoá, bản lề, gioăng, độ vuông, kín nước)?", "app có thể hiện checklist QC — cần biết nội dung", "P1"),
 ("TC2", "②③ Ai test, mất bao lâu 1 bộ? Test từng bộ hay chỉ test mẫu?", "thời lượng + tần suất", "P1"),
 ("TC3", "⑥⑦ Kết quả test ghi ở đâu (giấy/app)? Có cần lưu lịch sử theo bộ trong app không? Đạt thì có dán tem/đánh dấu không?", "app có cần form nhập kết quả QC", "P2"),
 ("TC4", "⑥ Tỷ lệ phải sửa sau test khoảng bao nhiêu %? Lỗi thường gặp là gì?", "để dự phòng thời gian làm lại trong kế hoạch", "P1"),
 ("TC5", "⑤⑥ Phát hiện lỗi ở test thì quay lại công đoạn nào (hàn? chấn? ép cánh?)? Việc làm lại có chen trước đơn thường không?", "xác định luồng quay lại khi làm lại", "P1"),
 ("TC6", "②③ Một ngày test được bao nhiêu bộ?", "năng lực", "P2"),
])
sub("D.4. TỔ HÀN — câu hỏi chung")
qs([
 ("TH1", "③ Tổ hàn bao nhiêu người, mấy ca, giờ làm?", "năng lực theo người/giờ", "P1"),
 ("TH2", "⑤ Hàng sau khi test cơ khí <b>chờ sơn</b> bao lâu? Chỗ để có giới hạn không (tối đa bao nhiêu bộ)?", "giới hạn hàng chờ trước sơn — thường là nút thắt", "P1"),
 ("TH3", "② Một ngày tổ hàn ra được bao nhiêu bộ hoàn chỉnh (đã test đạt)?", "năng lực thực tế", "P1"),
 ("TH4", "⑥ Máy hàn/máy ép hay hỏng không? Bảo trì bao lâu 1 lần?", "thời gian dừng máy", "P2"),
 ("TH5", "⑤ Tổ hàn có bị ảnh hưởng khi tổ máy giao thiếu hoặc không đúng model không? Có phải chờ không?", "rủi ro phụ thuộc giữa các tổ", "P1"),
])

# ================= 3. TỔ SƠN =================
doc.add_page_break()
head("PHẦN E. TỔ SƠN — nút thắt theo bảng công đoạn — 2 đơn vị thời gian")
qs([
 ("SON1", "③ Công nghệ sơn gì (sơn tĩnh điện / sơn nước / phun dầu)? Có lò sấy/nung không? Mấy lò?", "công nghệ quyết định thời gian và cách gom lô", "P1"),
 ("SON2", "② Mỗi <b>mẻ lò</b> sơn được bao nhiêu bộ? Một mẻ mất bao lâu (tính cả sấy)?", "con số quan trọng nhất của module", "P1"),
 ("SON3", "③ Một ngày sơn được mấy mẻ? Tổ sơn mấy người?", "năng lực/ngày", "P1"),
 ("SON4", "① Sơn những phần nào (khung · cánh · phào)? Cả bộ sơn 1 lượt hay sơn riêng từng phần?", "phạm vi theo khung/cánh/phào", "P1"),
 ("SON5", "④ Danh sách màu đang dùng ở đâu (bảng mã RAL / theo mã hàng)? Màu do khách chọn hay sale chọn?", "app cần danh mục màu để gom lô", "P1"),
 ("SON6", "④ Đổi màu mất bao lâu (vệ sinh súng/buồng)? Có phải bắn màu nhạt trước màu đậm không?", "thời gian setup theo màu", "P1"),
 ("SON7", "④ Có phải <b>gom lô theo màu</b> không? Tối thiểu bao nhiêu bộ cho 1 lô màu?", "quy tắc gom lô sơn — ảnh hưởng trực tiếp lead time", "P1"),
 ("SON8", "④ Khách cần 1 bộ màu lạ / số lượng ít thì xử lý thế nào (vẫn sơn riêng, hay chờ ghép lô)?", "ngoại lệ của quy tắc gom lô", "P1"),
 ("SON9", "④ Gom đủ lô cả tuần mới sơn 1 lượt, hay sơn hằng ngày?", "tần suất sơn quyết định cách xếp kế hoạch", "P1"),
 ("SON10", "⑤ Hàng trước khi sơn cần gì (sạch, sấy, che chắn)? Chờ gì trước khi sơn?", "điều kiện vào công đoạn", "P2"),
 ("SON11", "⑤ Sau sơn bao lâu mới được <b>vân</b>? Bao lâu mới <b>đóng gói</b> được? Có sấy cưỡng bức không?", "thời gian chờ — chỗ kế hoạch hay bị trượt", "P1"),
 ("SON12", "⑥ Kiểm tra màu/bề mặt: ai duyệt, so với gì (mẫu khách / mã RAL)?", "điểm QC", "P2"),
 ("SON13", "⑥ Lỗi sơn (chảy, bụi, lệch màu) xử lý thế nào? Sơn lại mất bao lâu? Tỷ lệ lỗi khoảng bao nhiêu %?", "làm lại — ảnh hưởng lớn tới lead time", "P1"),
 ("SON14", "②③ Một tuần tổ sơn làm được tối đa bao nhiêu bộ?", "năng lực/tuần để cảnh báo quá tải", "P1"),
 ("SON15", "③ Lò/súng sơn có bảo trì định kỳ không? Bao lâu 1 lần, mất bao lâu?", "app phải chừa thời gian dừng", "P2"),
 ("SON16", "⑤ Có <b>thuê ngoài</b> khâu sơn không? Đơn vị nào, thời gian gửi/nhận bao lâu?", "nếu có thì ghi như một công đoạn riêng trong kế hoạch", "P2"),
 ("SON17", "⑤⑦ Hàng sơn xong để ở đâu, bao lâu, có giới hạn chỗ không? Ai cập nhật tiến độ sơn, ở đâu?", "giới hạn hàng chờ + cách ghi nhận", "P1"),
 ("SON18", "④ Màu/dung môi đặc biệt có phải đặt trước không? Đặt mất bao lâu?", "lead time vật tư sơn", "P2"),
 ("SON19", "⑥ Có phải sơn lại khi hàng đã vân mà bị lỗi không (bóc vân → sơn lại)? Mất bao lâu?", "làm lại nhiều bước — rất ảnh hưởng lead time", "P1"),
])

# ================= 4. TỔ VÂN =================
head("PHẦN F. TỔ VÂN")
qs([
 ("VAN1", "③ Công nghệ vân là gì (dán film vân / ép nhiệt / in chuyển ấn nóng)? Có buồng sấy không?", "xác nhận công nghệ và thiết bị", "P1"),
 ("VAN2", "① Vân cho những phần nào (khung · cánh · phào)? Có khi nào 1 bộ dùng 2 mã vân khác nhau không?", "phạm vi + khả năng chia nhiều mã vân trong 1 bộ", "P1"),
 ("VAN3", "④ Mã vân lấy từ đâu (mẫu khách chọn / theo mã hàng / theo model)? Hiện có bao nhiêu mã vân? App có cần thêm trường “mã vân” trên đơn không?", "app cần trường mã vân để gom lô", "P1"),
 ("VAN4", "② Một bộ vân mất bao lâu? Tính theo mét dài / m² / số bộ?", "định mức thời gian", "P1"),
 ("VAN5", "③ Mấy máy vân, mấy người, một ngày được bao nhiêu bộ?", "năng lực", "P1"),
 ("VAN6", "④ Đổi mã vân mất bao lâu? Có phải gom lô theo mã vân không? Tối thiểu bao nhiêu bộ 1 lượt?", "thời gian setup + quy tắc gom lô vân", "P1"),
 ("VAN7", "⑤ Hàng trước khi vân phải khô/sạch thế nào? Có phải che kính khi vân không?", "điều kiện vào công đoạn", "P2"),
 ("VAN8", "⑤ Sau vân bao lâu mới <b>lắp kính / đóng gói</b> được? Có phải chờ nguội/khô không?", "thời gian chờ", "P1"),
 ("VAN9", "⑥ Ai kiểm màu/vân so với mẫu? Kiểm trước hay sau khi đóng gói?", "điểm QC cuối", "P2"),
 ("VAN10", "⑥ Vân lỗi (bong, lệch, xước) xử lý thế nào? Có phải bóc ra sơn lại không? Mất bao lâu?", "làm lại nhiều bước", "P1"),
 ("VAN11", "⑤⑦ Hàng vân xong để ở đâu, có giới hạn chỗ không? Ai cập nhật tiến độ vân?", "giới hạn hàng chờ + ghi nhận", "P2"),
 ("VAN12", "②③ Một tuần tổ vân làm được tối đa bao nhiêu bộ?", "năng lực/tuần", "P1"),
])

# ================= 5. LẮP KÍNH + PHỤ KIỆN =================
doc.add_page_break()
head("PHẦN G. LẮP KÍNH + PHỤ KIỆN — công đoạn CHƯA có trong bảng công đoạn nhưng đơn hàng đang có")
note("Trong đơn hàng của app có: kính trên cánh + vách kính 8.38, mã khoá (khoá tay trúc…), phụ kiện ở bảng chi tiết, ô thoáng — "
     "nhưng bảng công đoạn đang nhảy từ Vân sang Vệ sinh + Đóng gói. Cần chốt mục này để không bỏ sót công đoạn.")
qs([
 ("LK1", "① Có bước lắp kính + phụ kiện không? <b>Do tổ nào làm</b> (tổ vân / tổ hàn / tổ riêng / tổ kho)?", "xác nhận có/không và gán về tổ — nếu thiếu, kế hoạch sẽ tính sai", "P1"),
 ("LK2", "① Lắp kính gồm những việc gì (gioăng, silicon, nêm, nẹp, kính cường lực, kính dán 8.38)?", "nội dung công đoạn", "P1"),
 ("LK3", "① Lắp phụ kiện gồm những gì (khoá, bản lề, tay nắm, ray, bánh xe, chốt, phụ kiện ô thoáng)?", "nội dung công đoạn", "P1"),
 ("LK4", "② Một bộ lắp kính + phụ kiện mất bao lâu? Có phụ thuộc số cánh / kích thước / loại cửa không?", "định mức thời gian", "P1"),
 ("LK5", "⑤⑤ Vị trí trong chuỗi: sau Vân hay sau Sơn (nếu không vân)? Trước Vệ sinh + Đóng gói đúng không?", "vị trí trong chuỗi công đoạn", "P1"),
 ("LK6", "⑤ Kính tự cắt hay đặt ngoài? Thời gian chờ kính bao lâu? Có bao giờ <b>chờ kính</b> làm đứng cả bộ không?", "lead time vật tư — có thể làm trễ cả bộ", "P1"),
 ("LK7", "⑤ Thiếu kính / thiếu phụ kiện thì các bộ khác có được đẩy trước không, hay bộ đó đứng chờ?", "quy tắc đẩy từng bộ (ngoại lệ của “đủ đơn”)", "P1"),
 ("LK8", "⑥ Sau khi lắp có kiểm tra đóng/mở trơn, khoá khít, kín nước không? Ai kiểm?", "điểm QC trước đóng gói", "P2"),
 ("LK9", "①⑥ Có phải lắp thử toàn bộ bộ cửa rồi tháo ra để vận chuyển không? Mất thêm bao lâu?", "thời gian lắp/tháo 2 lần", "P2"),
 ("LK10", "③ Mấy người làm, một ngày lắp được bao nhiêu bộ?", "năng lực", "P1"),
 ("LK11", "⑦ App đang có đủ thông tin để mua/lắp phụ kiện chưa (mã khoá, số lượng phụ kiện, loại/dày kính)? <b>Còn thiếu gì?</b>", "đây là danh sách trường dữ liệu app cần bổ sung", "P1"),
 ("LK12", "⑦ Khi nhận đơn, xưởng có phải gọi sale <b>hỏi lại thông tin gì</b> không? Hỏi những gì, hay gặp nhất là gì?", "danh sách trường app cần thêm hoặc bắt buộc nhập", "P1"),
])

# ================= 6. TỔ KHO =================
head("PHẦN H. TỔ KHO — Vệ sinh · Đóng gói · Kho · Giao hàng · Lắp đặt")
sub("H.1. Công đoạn VỆ SINH + ĐÓNG GÓI")
qs([
 ("KHO1", "① Vệ sinh + đóng gói gồm những gì (lai chùi, dán băng dính bảo vệ, bọc xốp/màng co, đóng thùng, chèn chống xước)?", "nội dung công đoạn", "P2"),
 ("KHO2", "② Một bộ mất bao lâu? Có phụ thuộc kích thước / số cánh không?", "định mức thời gian", "P1"),
 ("KHO3", "① Đóng gói theo bộ hay theo kiện (nhiều bộ 1 kiện)? Mỗi kiện mấy bộ?", "đơn vị đóng gói để lập kế hoạch giao", "P2"),
 ("KHO4", "⑦ Có dán nhãn/tem gì trên kiện không (mã đơn · bộ số · tên khách · số kiện)?", "app có thể in tem tự động thay vì ghi tay", "P2"),
 ("KHO5", "⑤ Sau khi đóng gói, bộ được coi là <b>“hoàn thành sản xuất”</b> đúng không?", "mốc dữ liệu Hoàn thành sản xuất", "P1"),
 ("KHO6", "③ Mấy người? Một ngày đóng gói được bao nhiêu bộ?", "năng lực", "P1"),
 ("KHO7", "⑤ Hàng đóng gói xong để ở đâu, được bao lâu? Có giới hạn chỗ không?", "giới hạn hàng chờ giao", "P2"),
 ("KHO8", "⑥ Có kiểm lại / lau lại lần cuối trước khi giao không, hay giao luôn?", "bước kiểm tra cuối", "P2"),
])
doc.add_page_break()
sub("H.2. KHO, GIAO HÀNG & LẮP ĐẶT TẠI CÔNG TRÌNH")
qs([
 ("GH1", "⑦ Ai ghi <b>ngày giao thực tế</b>? Ghi ở đâu (app / phiếu giao hàng giấy)?", "app chưa có trường này — cần để tính đúng hạn", "P1"),
 ("GH2", "⑤ “Hạn giao” trên đơn là ngày <b>xưởng làm xong</b> hay ngày <b>giao tới khách</b>?", "mốc mà kế hoạch phải nhắm tới", "P1"),
 ("GH3", "③ Xưởng có xe riêng không? Mấy chuyến/ngày? Mỗi chuyến bao nhiêu bộ?", "đội giao hàng cũng là nguồn lực phải xếp", "P1"),
 ("GH4", "④ Có gom chuyến theo khu vực / đại lý không? App đang có Khu vực và Số km — có dùng để gom chuyến không?", "quy tắc gom chuyến giao", "P2"),
 ("GH5", "① Có <b>giao từng phần</b> cho khách không (giao trước vài bộ)?", "chia nhỏ kế hoạch giao hàng", "P2"),
 ("GH6", "①③ Có <b>lắp đặt tại công trình</b> không? Ai đi lắp, mất bao lâu 1 bộ? Có lấy ngày lắp làm mốc hoàn thành không?", "công việc ngoài xưởng nhưng vẫn phải nằm trong kế hoạch", "P1"),
 ("GH7", "⑥ Khách có ký nhận / ghi biên bản khi giao không?", "nguồn dữ liệu ngày giao thực tế đáng tin", "P2"),
 ("GH8", "⑥ Hàng sai/lỗi phát hiện tại công trình: quay lại xưởng hay sửa tại chỗ? Mất bao lâu?", "xử lý làm lại sau giao", "P1"),
 ("GH9", "⑤ Có trường hợp khách chưa lấy hàng, hàng để kho lâu không? Bao lâu thì coi là tồn?", "app cần cảnh báo hàng đã xong nhưng chưa giao", "P2"),
 ("GH10", "⑤ Giao hàng có phải chờ thanh toán không (thu tiền khi giao)?", "nếu có thì kế hoạch giao phụ thuộc kế toán", "P2"),
 ("GH11", "③ Một tuần giao được tối đa bao nhiêu bộ?", "năng lực giao hàng", "P1"),
 ("GH12", "⑥ Trễ hạn hiện nay thường do <b>khâu giao hàng</b> hay do <b>sản xuất chưa xong</b>?", "xác định đúng nút thắt của trễ hạn", "P1"),
])

# ================= 7. XUYÊN SUỐT =================
doc.add_page_break()
head("PHẦN I. CÁC VẤN ĐỀ XUYÊN SUỐT KHI LÊN KẾ HOẠCH — dành cho người lên kế hoạch / quản đốc")
sub("I.1. Cách lên kế hoạch hiện nay")
qs([
 ("KH1", "Hiện nay <b>ai</b> lên kế hoạch sản xuất? Bao lâu lên 1 lần (hằng ngày / hằng tuần)?", "biết nghiệp vụ gốc và tần suất cập nhật", "P1"),
 ("KH2", "Kế hoạch đang làm bằng gì (giấy / bảng trắng / Excel / Zalo)? <b>Xin 1 bản mẫu.</b>", "app phải thay đúng thứ đang dùng", "P1"),
 ("KH3", "Kế hoạch hiện chia theo gì: theo tuần · theo ngày · theo tổ · theo đơn?", "quyết định màn hình chính của module", "P1"),
 ("KH4", "Khi xếp lịch, xem yếu tố nào trước: hạn giao · ngày nhận đơn · khách giục · vật tư đã có?", "thuật toán xếp lịch", "P1"),
 ("KH5", "Một bộ được coi là <b>đủ điều kiện vào sản xuất</b> khi nào (bản vẽ đã duyệt? chương trình đã có? nhôm/màu đã có? khách đã xác nhận?)", "tránh xếp lịch ảo rồi máy phải chờ", "P1"),
 ("KH6", "Có bao nhiêu đơn/bộ đang làm dở thường xuyên? Bao nhiêu bộ là “quá nhiều” với xưởng?", "app cần cảnh báo WIP", "P2"),
])
sub("I.2. Năng lực & thực tế sản xuất")
qs([
 ("KH7", "Thực tế hiện nay xưởng làm ra bao nhiêu bộ/tuần (không phải con số lý thuyết)? Tối đa được bao nhiêu?", "con số nền để so tải kế hoạch", "P1"),
 ("KH8", "Có mùa cao điểm không? Tháng nào đông nhất? Chênh lệch bao nhiêu %?", "kế hoạch theo mùa, dự báo", "P2"),
 ("KH9", "Ngày thường làm mấy tiếng, mấy ca? Cao điểm <b>tăng ca</b> được bao nhiêu %?", "năng lực linh hoạt", "P1"),
 ("KH10", "Tỷ lệ <b>trễ hạn</b> hiện nay khoảng bao nhiêu %? Nguyên nhân chính: chờ nhôm · chờ chương trình · chờ lô sơn · khách đổi · thiếu người · máy hỏng · giao hàng?", "app cần danh mục lý do trễ + đo lường được", "P1"),
 ("KH11", "Năng suất 1 người 1 ngày bao nhiêu bộ (hoặc m²)? Có chấm công / tính lương theo sản phẩm không?", "nếu có thì app có thể hỗ trợ tính năng suất", "P2"),
 ("KH12", "Tỷ lệ phải <b>làm lại</b> khoảng bao nhiêu %? Một lần làm lại mất thêm bao nhiêu thời gian?", "dự phòng thời gian làm lại trong kế hoạch", "P2"),
 ("KH13", "Có phải <b>chờ vật tư</b> (nhôm · kính · phụ kiện · keo · màu) làm dừng sản xuất không? Thường chờ bao lâu?", "app cần cảnh báo thiếu vật tư trước khi xếp lịch", "P1"),
])
sub("I.3. Ngoại lệ & thay đổi")
qs([
 ("KH14", "Ai được quyền <b>chen đơn gấp</b> lên trước? Sale có tự chen được không?", "phân quyền và quy tắc ưu tiên", "P1"),
 ("KH15", "Khách <b>đổi</b> kích thước / màu / số lượng sau khi đã vào sản xuất thì xử lý thế nào?", "app cần luồng xử lý thay đổi giữa chừng", "P1"),
 ("KH16", "Đơn bị <b>hủy</b> giữa lúc đang sản xuất thì xử lý thế nào? Hàng đã làm dở tính sao?", "xử lý đơn hủy — app mới chỉ có trạng thái Đã hủy", "P2"),
 ("KH17", "<b>Đơn làm lại</b> (hàng lỗi khách trả) có chen trước đơn thường không? Quay lại công đoạn nào?", "quy tắc xử lý đơn làm lại", "P1"),
 ("KH18", "<b>Đơn hàng mẫu</b> có chiếm chỗ sản xuất không? Ưu tiên thế nào?", "loại đơn nào được vào kế hoạch", "P1"),
 ("KH19", "Có <b>sản xuất trước / làm tồn kho</b> không? Bao nhiêu % sản lượng?", "nếu có thì kế hoạch phải gồm cả phần dự báo", "P1"),
 ("KH20", "Khi kế hoạch và thực tế lệch (máy hỏng, nghỉ người, khách đổi), <b>ai cập nhật lại</b> và cập nhật ở đâu?", "app cần màn hình cập nhật nhanh", "P1"),
])
doc.add_page_break()
sub("I.4. Cập nhật tiến độ & báo cáo")
qs([
 ("KH21", "Xưởng muốn <b>cập nhật tiến độ ở đâu</b>: máy tính ở xưởng · điện thoại · ghi giấy rồi văn phòng nhập?", "quyết định app có được dùng thật hay không", "P1"),
 ("KH22", "Cập nhật theo mức <b>bộ</b> hay mức <b>từng công đoạn</b> của từng bộ?", "mức chi tiết dữ liệu — chi tiết quá thì không ai nhập", "P1"),
 ("KH23", "Ai là người cập nhật (tổ trưởng tổ nào, hay 1 người văn phòng)?", "phân quyền và trách nhiệm", "P1"),
 ("KH24", "Mỗi ngày xưởng cần xem gì: việc hôm nay của tổ · việc đang chậm · việc đã xong · tải tuần sau?", "thiết kế màn hình kế hoạch", "P1"),
 ("KH25", "Có cần <b>in phiếu lệnh sản xuất</b> cho từng tổ không? In nội dung gì, khổ giấy nào?", "mẫu in (app đã có sẵn công cụ in)", "P2"),
 ("KH26", "Có cần <b>in danh sách việc theo ngày/tuần</b> để dán ở xưởng không?", "mẫu in thứ hai", "P2"),
 ("KH27", "Có cần <b>gắn tên thợ</b> vào từng bộ để tính năng suất / lỗi theo người không?", "nếu có thì app phải lưu người phụ trách", "P2"),
 ("KH28", "Có cần theo dõi <b>máy đang dừng</b> và <b>lý do dừng</b> (bảo trì · hỏng · chờ chương trình · chờ vật tư · thiếu người)?", "dừng máy làm giảm năng lực thật", "P2"),
 ("KH29", "Xưởng muốn app <b>cảnh báo</b> những gì: quá tải tổ · chờ đủ đơn · chờ chương trình máy cắt · bộ sắp trễ hạn · máy đang dừng · thiếu vật tư?", "cảnh báo là giá trị chính của module — phải đúng thứ xưởng cần", "P1"),
 ("KH30", "Có khâu nào khác phải <b>thuê ngoài</b> ngoài sơn không (kính · phào · phụ kiện · mạ · uốn)? Thời gian gửi/nhận bao lâu?", "thời gian ngoài vẫn phải nằm trong kế hoạch", "P2"),
])

# ================= 8-11. BẢNG =================
doc.add_page_break()
head("PHẦN J. 12 CÂU BỔ SUNG (các lỗ hổng đã rà lại")
note("Những chỗ module sẽ cần nhưng bản trước chưa hỏi. Ba câu quan trọng nhất: J1 · J2 · J3.")
qs([
 ("J1", "Ai có quyền <b>sửa / xóa kế hoạch đã chốt</b>? Có cần lưu lại <b>ai đổi gì, lúc nào</b> không?", "phân quyền + lịch sử sửa đổi — hiện app chưa có đăng nhập", "P1"),
 ("J2", "Khi một bộ <b>hoàn thành</b>, ai là người <b>xác nhận</b> — tổ trưởng hay quản đốc? Xác nhận ở đâu?", "mốc “hoàn thành” phải do một người chịu trách nhiệm", "P1"),
 ("J3", "Kế hoạch tuần được <b>chốt vào ngày nào</b> (ví dụ chiều thứ 6 cho tuần sau)? Ai chốt? Có khóa lại không?", "thời điểm chốt quyết định luồng làm việc hằng tuần", "P1"),
 ("J4", "Có cần <b>xem lại kế hoạch các tuần trước</b> để đối chiếu làm được / không không?", "lưu lịch sử kế hoạch để đánh giá năng lực thật", "P2"),
 ("J5", "Có cần theo dõi <b>% tiến độ</b> từng bộ, hay chỉ cần <b>trạng thái</b> (chờ / đang / hoàn thành / đã giao)?", "chọn % là phải nhập số liệu liên tục, dễ bỏ", "P1"),
 ("J6", "Mỗi tổ có cần <b>xem kế hoạch của tổ khác</b> không (để chủ động chuẩn bị)?", "quyết định nội dung màn hình xưởng + phân quyền", "P2"),
 ("J7", "Khi một bộ bị <b>tạm dừng</b> (chờ vật tư, khách đổi, lỗi), có cần trạng thái riêng + <b>lý do</b> không?", "trạng thái tạm dừng + danh mục lý do", "P1"),
 ("J8", "Nếu hàng <b>trễ hạn</b>, app có cần <b>tự đề xuất lại lịch</b> không, hay chỉ báo đỏ để người xử lý?", "mức độ “tự động” của module", "P2"),
 ("J9", "Có cần <b>thông báo</b> (chuông trong app / Zalo) khi bộ sắp trễ hoặc có việc mới không? Ai nhận?", "cảnh báo chỉ có giá trị nếu đến đúng người", "P2"),
 ("J10", "Báo cáo nên tính theo <b>bộ · m² · hay giá trị</b>?", "đơn vị báo cáo — ảnh hưởng cách nhập KH/Lượng", "P2"),
 ("J11", "Có cần <b>in kế hoạch ra giấy dán ở xưởng</b> (thay bảng công đoạn giấy hiện nay) không?", "mẫu in thứ ba", "P2"),
 ("J12", "Có khâu nào khác phải <b>thuê ngoài</b> ngoài sơn (kính, phào, phụ kiện, mạ, uốn)? Thời gian gửi/nhận bao lâu?", "thời gian ngoài vẫn phải nằm trong kế hoạch", "P2"),
])

head("PHẦN K. BẢNG ĐIỀN THỜI LƯỢNG CÔNG ĐOẠN (đơn vị thời gian: ..................... ")
note("Cột “Loại”: <b>G</b> = gia công (thời gian tăng theo số bộ) · <b>C</b> = chuẩn bị (tính theo file/model, có thể tái sử dụng, ≈ 0 nếu đã có).")
tbl(["#", "Công đoạn", "Loại", "Số trong bảng gốc", "Điền lại / bổ sung"], [
 ("1", "Thiết kế", "C", "1", ""), ("2", "Bồi Lares (nạp chương trình máy cắt)", "C", "1", ""),
 ("3", "Cắt (khung/cánh/phào)", "G", "1", ""), ("4", "Chấn (khung/cánh/phào)", "G", "1", ""),
 ("5", "Hàn (khung/cánh/phào)", "G", "2", ""), ("6", "Ép cánh", "G", "", "chưa có số"),
 ("7", "Mài mối hàn / làm sạch ba via", "G", "", "chưa có công đoạn này"),
 ("8", "Test cơ khí", "G", "1", ""), ("9", "Sơn", "G", "2", ""), ("10", "Vân (khung/cánh/phào)", "G", "2", ""),
 ("11", "Lắp kính + phụ kiện", "G", "", "chưa có công đoạn này"),
 ("12", "Vệ sinh + Đóng gói", "G", "1", ""), ("13", "Kho / giao hàng", "G", "0", ""),
 ("14", "Chờ khô sau sơn", "-", "", "chưa có số"), ("15", "Chờ sau vân trước khi đóng gói", "-", "", "chưa có số"),
 ("16", "Chờ sau Bồi Lares mới cắt được", "-", "", "chưa có số"),
], [Cm(0.9), Cm(6.2), Cm(1.2), Cm(2.4), Cm(7.9)])

head("PHẦN L. DỮ LIỆU APP CẦN THÊM (đánh dấu: Cần / Không cần")
tbl(["Trường đề xuất thêm", "Ý nghĩa", "Cần?"], [
 ("Trạng thái sản xuất từng BỘ (Chờ SX / Đang SX / Hoàn thành / Đã giao / Tạm dừng)", "biết bộ nào đã xong", ""),
 ("Trạng thái từng CÔNG ĐOẠN của từng bộ", "theo dõi chi tiết nếu xưởng nhập được", ""),
 ("Loại công đoạn: GIA_CONG / CHUAN_BI", "công đoạn chuẩn bị không nhân theo số bộ", ""),
 ("Phạm vi công việc: KHUNG / CÁNH / PHAO / CẢ BỘ", "biết khung đã xong chưa", ""),
 ("Chương trình máy cắt theo model (tên file, phiên bản, máy, người làm, ngày, thời gian)", "tái sử dụng; cảnh báo model chưa có chương trình", ""),
 ("Giờ công định mức theo loại cửa / model", "tính tải chính xác", ""),
 ("Năng lực từng tổ (số người, bộ/tuần, giờ/tuần)", "cảnh báo quá tải", ""),
 ("Thời gian setup (đổi màu sơn · mã vân · khuôn chấn · model nhôm)", "quyết định gom lô", ""),
 ("Thời gian chờ (sau sơn · sau vân · sau Bồi Lares · chờ keo khô)", "không xếp sát nhau khi chưa khô", ""),
 ("Tổ phụ trách + Người phụ trách từng bộ/công đoạn", "phân công & năng suất", ""),
 ("Ngày bắt đầu / kết thúc thực tế từng công đoạn", "biết chỗ nào trễ, đo năng suất thật", ""),
 ("Ngày hoàn thành sản xuất (đơn/bộ)", "so với hạn giao", ""),
 ("Ngày giao thực tế", "tính tỷ lệ giao đúng hạn", ""),
 ("Lý do trễ (danh mục: chờ nhôm · chờ chương trình · chờ lô sơn · khách đổi · thiếu người · máy hỏng…)", "thống kê nguyên nhân trễ", ""),
 ("Lỗi & làm lại (bộ nào, công đoạn nào, mất bao lâu)", "tỷ lệ lỗi theo tổ", ""),
 ("Mã vân + mã màu chuẩn (danh mục)", "gom lô sơn / lô vân", ""),
 ("Ghi chú sản xuất theo bộ (khác ghi chú của sale) + đính kèm bản vẽ/chương trình", "thay vì gửi Zalo thủ công", ""),
], [Cm(8.6), Cm(6.7), Cm(2.1)])

head("PHẦN M. KIỂM TRA CHÉO — thông tin app đang có, xưởng có dùng không?")
note("Ghi: <b>Có</b> (xưởng dùng) / <b>Không</b> (không cần) / <b>Thiếu gì</b> (chưa đủ để sản xuất).")
tbl(["Trường dữ liệu", "Xưởng có dùng không? (Có / Không / Thiếu gì?)"], [
 ("Bộ số (set_no)", ""), ("Mã hàng · Tên sản phẩm · Model nhôm", ""),
 ("Loại mở · Hướng phào · Loại phào · Số phào/bộ", ""),
 ("Số cánh · Thông tin cánh/panel · Ô thoáng", ""), ("Màu sơn", ""),
 ("Cao × Rộng · Khung bao · Thông thủy cao/rộng", ""),
 ("Mã khoá · Phụ kiện (tên / SL / ghi chú / ảnh)", ""), ("Ghi chú dòng hàng", ""),
 ("Ảnh sản phẩm · Ảnh chi tiết", ""), ("Hạn giao · Ngày đặt hàng", ""),
 ("Khách hàng / Đại lý / Khu vực / Số km", ""), ("KH/Lượng (pricing_quantity) & ĐVT", ""),
], [Cm(8.6), WT - Cm(8.6)])

head("PHẦN N. MẶC ĐỊNH nếu chưa trả lời được (app vẫn chạy, sửa lại sau")
tbl(["Hạng mục", "Giá trị mặc định dùng tạm"], [
 ("Đơn vị kế hoạch", "1 bộ cửa (theo Bộ số)"),
 ("Đơn vào kế hoạch", "Sản xuất + Đã xác nhận; đơn làm lại bật/tắt bằng cấu hình; đơn mẫu không vào"),
 ("Điều kiện vào sản xuất", "Đã xác nhận + có Bộ số + có hạn giao (cảnh báo vàng nếu thiếu bản vẽ/chương trình)"),
 ("Đơn vị thời gian", "Ngày làm việc, thứ 2 – thứ 6, nghỉ chủ nhật"),
 ("Thiết kế", "1 ngày · = 0 nếu mã hàng đã có mẫu"),
 ("Bồi Lares", "1 ngày cho model MỚI · ≈ 0 nếu chương trình đã có · chặn trước Cắt"),
 ("Ép cánh", "1 ngày"), ("Mài mối hàn", "0,5 ngày"),
 ("Test cơ khí", "1 ngày"), ("Lắp kính + phụ kiện", "1 ngày (sau Vân)"),
 ("Sơn · Vân", "2 ngày mỗi công đoạn (theo bảng gốc)"),
 ("Vệ sinh + Đóng gói", "1 ngày"),
 ("Chờ khô", "Sau sơn 1 ngày · sau vân 1 ngày · sau Bồi Lares 0,5 ngày"),
 ("Công đoạn theo số bộ", "Cắt 1 · Chấn 1 · Hàn 2 · Sơn 2 · Vân 2 (theo bảng gốc)"),
 ("Năng lực tổ", "Để trống — lập được kế hoạch nhưng chưa cảnh báo quá tải cho tới khi nhập số"),
 ("Quy tắc đẩy công đoạn", "Cho đẩy TỪNG BỘ khi bộ đã đủ (nếu xưởng xác nhận “đủ đơn” thì bật lại)"),
 ("Ưu tiên xếp lịch", "Hạn giao gần nhất trước (EDD)"),
 ("Gom lô", "Không giới hạn lô; chỉ gợi ý gom theo màu sơn / mã vân / model nhôm"),
 ("Đơn làm lại", "Ưu tiên cao nhất, bắt đầu ở công đoạn bị lỗi (chọn tay)"),
 ("Máy dừng", "Danh mục lý do: bảo trì · hỏng · chờ chương trình · chờ vật tư · thiếu người"),
 ("Cập nhật tiến độ", "1 người xưởng/văn phòng nhập hằng ngày, mức BỘ; bật chi tiết công đoạn sau"),
 ("Cảnh báo", "Quá tải tổ ≥ 100% năng lực · bộ sắp trễ hạn (trước 2 ngày) · chờ đủ đơn · chờ chương trình"),
 ("Trễ hạn tính cho", "Chỉ đơn đã xác nhận"),
 ("Ngày giao thực tế", "Nhập khi giao (chưa quen thì bắt đầu bằng phiếu giao hàng giấy)"),
], [Cm(4.2), WT - Cm(4.2)])

head("PHẦN O. XIN KÈM THEO (nếu có")
for line in ["[   ] Mẫu KẾ HOẠCH SẢN XUẤT xưởng đang dùng (giấy / Excel / ảnh bảng trắng / ảnh Zalo)",
             "[   ] Mẫu ĐỀ NGHỊ SẢN XUẤT / PHIẾU LỆNH SẢN XUẤT đang dùng",
             "[   ] Danh sách máy móc từng tổ (số máy, model, tình trạng) + số người mỗi tổ + ca làm việc",
             "[   ] Danh mục MÀU SƠN + MÃ VÂN đang dùng",
             "[   ] Danh sách model nhôm + loại cửa bán chạy nhất",
             "[   ] 1 bộ bản vẽ mẫu + 1 chương trình máy cắt mẫu (nếu xưởng cho)",
             "[   ] Mẫu phiếu giao hàng + cách ghi ngày giao thực tế",
             "[   ] Ảnh chụp từng tổ + chỗ để hàng chờ giữa các công đoạn",
             "[   ] Số liệu 1–2 tháng gần đây: số bộ/tuần · số đơn trễ hạn · số đơn làm lại"]:
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(1)
    run(p, line, size=8.5)

p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(10)
run(p, "GOLDMAX · Bộ câu hỏi TỔNG HỢP đầy đủ (theo tổ & công đoạn + câu bổ sung) cho module Lên kế hoạch sản xuất · V125. "
       "Bản ngắn: V117 · Theo quyết định thiết kế: V122 · Đối chiếu độ đủ: V124.", size=7.5, italic=True, color=XAM)

out = "/home/user/.workspace/artifacts/bo-cau-hoi-tong-hop-v125.docx"
doc.save(out)
print("đã tạo:", out)
