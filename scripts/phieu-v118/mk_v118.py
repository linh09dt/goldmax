# -*- coding: utf-8 -*-
"""Sinh phiếu câu hỏi CHI TIẾT theo tổ + công đoạn (V118) — .docx (rồi convert ra PDF)."""
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ROW_HEIGHT_RULE
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

DO = RGBColor(0x0E, 0x74, 0x90)
XAM = RGBColor(0x55, 0x55, 0x55)
RED = RGBColor(0xB9, 0x1C, 0x1C)
XANH = RGBColor(0x0B, 0x4A, 0x6F)

doc = Document()
s = doc.sections[0]
s.page_width, s.page_height = Cm(21), Cm(29.7)
s.left_margin = s.right_margin = Cm(1.1)
s.top_margin = Cm(1.1)
s.bottom_margin = Cm(1.2)
n = doc.styles["Normal"]
n.font.name = "Arial"
n.font.size = Pt(9)
n._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial")
WT = Cm(21 - 2.2)


def shade(cell, c):
    el = OxmlElement("w:shd"); el.set(qn("w:val"), "clear"); el.set(qn("w:fill"), c)
    cell._tc.get_or_add_tcPr().append(el)


def run(p, text, size=9, bold=False, italic=False, color=None):
    r = p.add_run(text); r.font.name = "Arial"; r.font.size = Pt(size)
    r.bold = bold; r.italic = italic
    if color is not None: r.font.color.rgb = color
    r._element.rPr.rFonts.set(qn("w:cs"), "Arial")
    return r


def head(text, size=11, fill="DDEEF5"):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(9); p.paragraph_format.space_after = Pt(3)
    pPr = p._p.get_or_add_pPr()
    el = OxmlElement("w:shd"); el.set(qn("w:val"), "clear"); el.set(qn("w:fill"), fill); pPr.append(el)
    bd = OxmlElement("w:pBdr"); left = OxmlElement("w:left")
    left.set(qn("w:val"), "single"); left.set(qn("w:sz"), "20"); left.set(qn("w:color"), "0E7490")
    bd.append(left); pPr.append(bd)
    run(p, " " + text, size=size, bold=True, color=RGBColor(0x08, 0x33, 0x44))


def sub(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(6); p.paragraph_format.space_after = Pt(2)
    run(p, text, size=9.5, bold=True, color=XANH)


def note(text):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    run(p, text, size=8, italic=True, color=XAM)


def widths(table, ws):
    table.autofit = False
    for row in table.rows:
        for i, w in enumerate(ws):
            row.cells[i].width = w


def tbl(header, rows, ws, hdr_fill="EEEEEE", repeat=True):
    table = doc.add_table(rows=1, cols=len(ws))
    table.style = "Table Grid"
    for i, t in enumerate(header):
        c = table.rows[0].cells[i]; shade(c, hdr_fill)
        p = c.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if i != 1 else WD_ALIGN_PARAGRAPH.LEFT
        run(p, t, size=8, bold=True)
    if repeat:
        trPr = table.rows[0]._tr.get_or_add_trPr()
        trPr.append(OxmlElement("w:tblHeader"))
    for r in rows:
        cells = table.add_row().cells
        table.rows[-1].height = Cm(0.5); table.rows[-1].height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
        for i, val in enumerate(r):
            if i >= len(cells): break
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            if i == 0:
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run(p, val, size=8, bold=True); shade(cells[i], "F7F7F7")
            elif i == 1 and isinstance(val, tuple):
                # câu hỏi + vì sao
                q, why = val
                run(p, q, size=8.5, bold=True)
                if why:
                    pw = cells[i].add_paragraph(); pw.paragraph_format.space_before = Pt(0)
                    run(pw, why, size=7, italic=True, color=XAM)
            elif str(val) in ("P1", "P2"):
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                run(p, val, size=8, bold=True, color=RED if val == "P1" else None)
            else:
                run(p, str(val), size=8.5)
        # tô nền cột trả lời (cột cuối)
        shade(cells[len(r) - 1], "FFFDF2")
    widths(table, ws)
    return table


W4 = [Cm(1.3), WT - Cm(1.3) - Cm(1.3) - Cm(5.6), Cm(1.3), Cm(5.6)]
W3 = [Cm(1.3), WT - Cm(1.3) - Cm(5.6), Cm(5.6)]
H4 = ["#", "Câu hỏi — vì sao cần hỏi", "Mức", "Trả lời"]
H3 = ["#", "Câu hỏi", "Trả lời"]


def qs(rows):
    return tbl(H4, rows, W4)


# =====================  TIÊU ĐỀ  =====================
t = doc.add_paragraph(); t.paragraph_format.space_after = Pt(2)
run(t, "PHIẾU CÂU HỎI CHI TIẾT THEO TỔ & CÔNG ĐOẠN — thiết kế module Lên kế hoạch sản xuất", size=13.5, bold=True)
p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(6)
run(p, "Công ty: ", size=8, bold=True); run(p, "..........................................     ", size=8)
run(p, "Ngày: ", size=8, bold=True); run(p, "......./......./2026     ", size=8)
run(p, "Người trả lời: ", size=8, bold=True); run(p, ".......................................... (quản đốc / tổ trưởng từng tổ)\n", size=8)
run(p, "Ghi chú cách trả lời: mỗi tổ trả lời phần của mình (mục 1–6). Mức ", size=8)
run(p, "P1", size=8, bold=True, color=RED)
run(p, " = bắt buộc để lập trình được; ", size=8)
run(p, "P2", size=8, bold=True)
run(p, " = cần cho đợt sau. Chưa rõ thì ghi “chưa rõ” — app dùng giá trị mặc định ở mục 10. Kèm bản V117 (bản ngắn 12 câu) khi trao đổi nhanh.", size=8)

note("Phần quan trọng nhất là mục 0 (dữ liệu app đang có), mục 7 (lắp kính + phụ kiện), "
     "mục 8 (các vấn đề xuyên suốt khi lên kế hoạch) và mục 9 (kiểm tra chéo từng trường dữ liệu).")

# =====================  0. DỮ LIỆU APP ĐANG CÓ  =====================
head("0. DỮ LIỆU APP ĐANG CÓ CHO MỖI BỘ CỬA (đọc trước khi trả lời)")
note("Đây là tất cả thông tin app hiện lưu cho 1 dòng hàng (1 bộ cửa). Xin đánh dấu: xưởng CÓ dùng thông tin này không, "
     "và nếu thiếu gì để sản xuất được thì ghi vào cột cuối.")
rows0 = [
    ("Định danh", "Mã đơn (order_code) · Dòng hàng (line_no) · Bộ số (set_no)", "để xếp lịch và gọi tên bộ khi sản xuất", ""),
    ("Sản phẩm", "Mã hàng (product_code) · Tên sản phẩm · Model nhôm (model)", "biết cắt/chấn loại nhôm nào, gom lô theo model", ""),
    ("Cấu tạo", "Số cánh (leaves_per_set) · Thông tin cánh/panel (panel_info) · Ô thoáng (window_bars)", "biết số cánh, chia ô, ô thoáng để cắt và lắp", ""),
    ("Hướng & phào", "Loại mở (opening_direction) · Hướng phào (trim_direction) · Số phào/bộ · Loại phào", "chiều mở để lắp bản lề/khoá; phào để cắt phào", ""),
    ("Kích thước", "Cao × Rộng (height_mm, width_mm) · Khung bao (frame_mm) · Thông thủy cao/rộng (clear_*)", "cắt nhôm, cắt kính, kích thước lắp đặt", ""),
    ("Màu sắc", "Màu sơn (paint_color)", "gom lô sơn, đặt màu", ""),
    ("Phụ kiện", "Mã khoá (lock_model) · danh sách phụ kiện ở bảng chi tiết (tên, SL, ĐVT, ghi chú, ảnh)", "mua và lắp khoá, bản lề, tay nắm…", ""),
    ("Khối lượng", "Số lượng (quantity) · ĐVT (unit) · KH/Lượng (pricing_quantity) · Đơn giá · Thành tiền", "tính tải sản xuất và doanh thu", ""),
    ("Giao hàng", "Ngày đặt (order_date) · Hạn giao (required_delivery_date) · Người nhận/ĐT/Địa chỉ · Số km · Khu vực", "xếp thứ tự ưu tiên, gom chuyến giao", ""),
    ("Khác", "Ghi chú dòng hàng + ghi chú từng phụ kiện · Ảnh sản phẩm · Ảnh chi tiết", "yêu cầu riêng của khách, hình dạng cửa", ""),
    ("Chương trình máy", "Chương trình cắt cho máy chuyên dụng theo model (tên file, phiên bản, máy, người làm, ngày) — app CHƯA có", "tái sử dụng chương trình, biết model nào chưa có chương trình", ""),
    ("App CHƯA có", "Ngày giao thực tế · Ngày hoàn thành sản xuất · Trạng thái sản xuất từng bộ · Giờ công định mức · Tổ phụ trách · Người phụ trách · Lỗi/làm lại", "đây là những gì app cần thêm — xem mục 9", ""),
]
tbl(["Nhóm", "Trường dữ liệu trong app", "Xưởng dùng để làm gì", "Đủ / thiếu gì?"], rows0, [Cm(1.9), Cm(6.6), Cm(6.2), Cm(3.0)])

doc.add_page_break()

# =====================  1. TỔ MÁY  =====================
head("1. TỔ MÁY")
sub("1.1. Công đoạn THIẾT KẾ")
qs([
 ("TK1", ("1 bộ cửa cần những bản vẽ gì (bản vẽ cắt nhôm, bản vẽ cánh/panel, bản vẽ kính, bản vẽ lắp)?", "biết app cần in/lưu gì theo bộ"), "P1", ""),
 ("TK2", ("Ai làm thiết kế, mấy người? Mỗi bộ mất bao lâu?", "thời lượng công đoạn để đưa vào kế hoạch"), "P1", ""),
 ("TK3", ("Thiết kế được làm trước khi xếp kế hoạch tuần, hay là 1 công đoạn nằm trong kế hoạch?", "quyết định thiết kế có chiếm tải của tuần hay không"), "P1", ""),
 ("TK4", ("App đang có cao/rộng, khung bao, thông thủy, số cánh, ô thoáng, model — đủ để thiết kế chưa? Còn thiếu gì?", "bổ sung trường dữ liệu ngay trên đơn"), "P1", ""),
 ("TK5", ("Khách có duyệt thiết kế trước khi sản xuất không? Nếu phải sửa sau khi khách duyệt thì mất bao lâu?", "mốc “đủ điều kiện vào sản xuất”"), "P2", ""),
 ("TK6", ("Một bộ có phải thiết kế lại nếu khách đổi kích thước/màu giữa lúc đang sản xuất không?", "xử lý thay đổi giữa kế hoạch"), "P2", ""),
 ("TK7", ("Có mẫu/bộ cửa nào thiết kế sẵn dùng lại được không (theo mã hàng)?", "nếu có thì thời lượng thiết kế = 0 với mã quen"), "P2", ""),
])
sub("1.2. Công đoạn BỒI LARES — nạp chương trình cho MÁY CẮT CHUYÊN DỤNG (hậu thiết kế)")
qs([
 ("BL1", ("Chương trình làm theo MODEL NHÔM hay theo TỪNG BỘ / kích thước? Một chương trình dùng lại cho các đơn sau được không?", "nếu theo model thì 1 chương trình dùng cho nhiều bộ — tải tính theo model, không theo bộ"), "P1", ""),
 ("BL2", ("Ai làm chương trình (kỹ thuật / văn phòng, hay làm ngay tại máy cắt)? Mấy người?", "đây là nguồn lực riêng hay nằm trong tổ máy"), "P1", ""),
 ("BL3", ("Chương trình MỚI (model chưa từng làm) mất bao lâu? Chương trình ĐÃ CÓ thì nạp lại/sửa mất bao lâu?", "hai con số khác nhau — app cần cả hai để tính tải"), "P1", ""),
 ("BL4", ("Chưa có chương trình thì máy cắt có chạy được không? Đã bao giờ MÁY CẮT ĐỨNG CHỜ chương trình chưa?", "đây là ràng buộc bắt buộc (prerequisite) của công đoạn Cắt"), "P1", ""),
 ("BL5", ("Chương trình lưu ở đâu (phần mềm máy / máy tính / USB)? Đặt tên theo gì? Khách đổi thì tạo phiên bản mới thế nào?", "để dựng thư viện chương trình theo model trong app"), "P2", ""),
 ("BL6", ("Xưởng có mấy MÁY CẮT CHUYÊN DỤNG? Model máy gì, đọc định dạng file nào?", "năng lực cắt thật + chương trình phải khớp máy"), "P2", ""),
 ("BL7", ("Có CHẠY THỬ / cắt mẫu 1 bộ trước khi cắt hàng loạt không? Mất bao lâu?", "nếu có thì thêm một bước và một khoản thời gian trước khi cắt hàng loạt"), "P2", ""),
 ("BL8", ("Khách đổi kích thước/mẫu giữa lúc đang làm thì SỬA CHƯƠNG TRÌNH mất bao lâu? Có phải cắt lại từ đầu không?", "thời gian phát sinh khi đơn thay đổi giữa chừng"), "P2", ""),
])
sub("1.3. Công đoạn CẮT")
qs([
 ("C1", ("Cắt bằng máy gì (máy cắt nhôm CNC / cắt tay)? Mấy máy, mấy người đứng máy?", "năng lực thật của công đoạn cắt"), "P1", ""),
 ("C2", ("Cắt riêng từng bộ, hay gom các bộ cùng model nhôm cắt chung một lượt?", "quy tắc gom lô cắt theo model"), "P1", ""),
 ("C3", ("Đổi sang model nhôm khác mất bao lâu (đổi dao, cài đặt, lấy nhôm)?", "thời gian setup — quan trọng khi xếp nhiều model trong tuần"), "P1", ""),
 ("C4", ("Thời gian cắt tính theo gì: số bộ, số mét dài nhôm, hay kích thước cửa?", "công thức định mức thời gian"), "P1", ""),
 ("C5", ("Cắt khung / cánh / phào — 1 người làm tuần tự hay 3 người làm song song?", "biết là 3 luồng song song hay 1 luồng"), "P1", ""),
 ("C6", ("Nhôm có sẵn trong kho theo model không, hay phải đặt mua theo đơn? Chờ bao lâu?", "lead time mua nhôm — nếu chờ lâu thì kế hoạch phải chừa thời gian"), "P1", ""),
 ("C7", ("Cắt xong để chờ chấn được bao lâu? Có giới hạn chỗ để không?", "giới hạn hàng chờ giữa công đoạn"), "P2", ""),
 ("C8", ("Cắt sai/hụt kích thước xử lý sao? Có cắt lại từ nhôm mới không?", "tỷ lệ hao hụt và làm lại"), "P2", ""),
 ("C9", ("Có phải cắt nhôm theo cả tấm/cây để tối ưu không (1 cây nhôm ra mấy bộ)?", "ảnh hưởng việc gom lô cắt"), "P2", ""),
 ("C10", ("Một ngày tổ cắt được tối đa bao nhiêu bộ (model phổ biến nhất)?", "con số năng lực để cảnh báo quá tải"), "P1", ""),
])
sub("1.4. Công đoạn CHẤN")
qs([
 ("CH1", ("Có mấy máy chấn? Cần khuôn riêng theo từng model nhôm không?", "nút thắt theo khuôn"), "P1", ""),
 ("CH2", ("Đổi khuôn / đổi model mất bao lâu?", "thời gian setup"), "P1", ""),
 ("CH3", ("Chấn khung / cánh / phào trên cùng 1 máy hay máy khác nhau? Có phải xếp hàng chờ máy không?", "tranh chấp máy giữa 3 luồng"), "P1", ""),
 ("CH4", ("Thời gian chấn mỗi bộ bao lâu? Có phụ thuộc kích thước cửa không?", "định mức thời gian"), "P1", ""),
 ("CH5", ("Ghi chú “cần đầy đủ đơn để đẩy công đoạn kế tiếp” nghĩa là gì: phải đủ tất cả các bộ trong đơn mới chấn?", "quy tắc đẩy công đoạn — đang gây chờ"), "P1", ""),
 ("CH6", ("Sau chấn có kiểm tra kích thước/góc không? Ai kiểm và ghi ở đâu?", "điểm QC + trách nhiệm"), "P2", ""),
 ("CH7", ("Chấn lỗi (méo, lệch góc) sửa được không hay phải cắt lại từ đầu?", "xử lý lỗi"), "P2", ""),
 ("CH8", ("Một ngày tổ chấn được bao nhiêu bộ?", "năng lực"), "P1", ""),
])
sub("1.5. Câu hỏi chung cho TỔ MÁY")
qs([
 ("TM1", ("Tổ máy bao nhiêu người, chia thế nào giữa thiết kế / bồi / cắt / chấn?", "năng lực theo người"), "P1", ""),
 ("TM2", ("Tổ máy làm 1 ca hay 2 ca? Giờ bắt đầu – kết thúc? Nghỉ trưa?", "quy đổi ngày công ra giờ làm việc"), "P1", ""),
 ("TM3", ("Một ngày tổ máy ra được bao nhiêu bộ “sạch” (đã chấn xong, sẵn sàng chuyển hàn)?", "đầu ra của tổ để tính tải"), "P1", ""),
 ("TM4", ("Có bao nhiêu việc dở dang thường nằm chờ ở tổ máy? Bao nhiêu bộ là quá nhiều?", "giới hạn WIP"), "P2", ""),
 ("TM5", ("Việc nào ở tổ máy hay bị kẹt nhất: chờ nhôm, chờ thiết kế, hay chờ máy?", "nguyên nhân trễ để app cảnh báo"), "P2", ""),
 ("TM6", ("Tổ máy có phải chờ tổ khác trả hàng về (ví dụ sơn lại) không?", "luồng quay lại"), "P2", ""),
])

doc.add_page_break()
# =====================  2. TỔ HÀN  =====================
head("2. TỔ HÀN")
sub("2.1. Công đoạn HÀN")
qs([
 ("HAN1", ("Hàn bằng máy gì, mấy máy, mấy người?", "năng lực"), "P1", ""),
 ("HAN2", ("Hàn khung / cánh / phào: 3 người làm song song hay 1 người tuần tự?", "3 luồng song song hay tuần tự"), "P1", ""),
 ("HAN3", ("Thời gian hàn 1 bộ bao lâu? Tính theo số góc/mối hàn hay theo bộ?", "định mức"), "P1", ""),
 ("HAN4", ("Có phải gom lô theo model để đỡ đổi khuôn/gá không? Bao nhiêu bộ 1 lượt?", "quy tắc gom lô hàn"), "P1", ""),
 ("HAN5", ("Có phải chờ đủ cả 3 phần (khung, cánh, phào) mới hàn được không?", "điều kiện vào công đoạn"), "P1", ""),
 ("HAN6", ("Hàn xong kiểm tra thế nào? Mối hàn lỗi sửa được không, mất bao lâu?", "QC và xử lý lỗi"), "P2", ""),
 ("HAN7", ("Một ngày tổ hàn được bao nhiêu bộ?", "năng lực"), "P1", ""),
])
sub("2.2. Công đoạn ÉP CÁNH (chưa có thời gian trong bảng)")
qs([
 ("EP1", ("Ép cánh là ép cái gì vào cánh (tấm lõi, panel nhôm, kính)? Làm cho loại cửa nào?", "hiểu đúng công đoạn, phạm vi áp dụng"), "P1", ""),
 ("EP2", ("Mỗi bộ mất bao lâu? Có phải chờ keo khô không, bao lâu?", "định mức + thời gian chờ"), "P1", ""),
 ("EP3", ("Có máy ép không, mấy cái? Mỗi lượt ép được bao nhiêu cánh?", "gom lô ép cánh"), "P1", ""),
 ("EP4", ("Ép cánh trước hay sau khi hàn cánh? Trước hay sau Test cơ khí?", "đúng thứ tự công đoạn"), "P1", ""),
 ("EP5", ("Ép lỗi (bọt khí, lệch, bong) xử lý sao? Mất bao lâu?", "làm lại"), "P2", ""),
 ("EP6", ("Ép cánh có làm tăng thời gian chờ trước khi sơn không?", "thời gian chờ"), "P2", ""),
 ("EP7", ("Một ngày ép được bao nhiêu bộ?", "năng lực"), "P1", ""),
])
sub("2.3. Công đoạn TEST CƠ KHÍ")
qs([
 ("TC1", ("Test gồm những gì (đóng/mở, khe hở cánh, khoá, bản lề, gioăng, độ vuông)?", "nội dung bước QC — app có thể hiện checklist"), "P1", ""),
 ("TC2", ("Ai test, mất bao lâu 1 bộ? Có phải test từng bộ hay test mẫu?", "thời lượng + tần suất"), "P1", ""),
 ("TC3", ("Kết quả test ghi ở đâu (giấy/app)? Có cần lưu lịch sử theo bộ không?", "app có cần form nhập kết quả QC"), "P2", ""),
 ("TC4", ("Tỷ lệ phải sửa sau test khoảng bao nhiêu %? Lỗi thường là gì?", "để dự phòng thời gian làm lại trong kế hoạch"), "P1", ""),
 ("TC5", ("Lỗi phát hiện ở test thì quay lại công đoạn nào (hàn? chấn? ép cánh?)", "xác định luồng quay lại khi làm lại"), "P1", ""),
 ("TC6", ("Test đạt rồi có dán tem/đánh dấu gì trên bộ không?", "app có thể in tem theo bộ"), "P2", ""),
])
sub("2.4. Câu hỏi chung cho TỔ HÀN")
qs([
 ("TH1", ("Tổ hàn bao nhiêu người, mấy ca, giờ làm việc?", "năng lực theo người/giờ"), "P1", ""),
 ("TH2", ("Hàng sau khi test cơ khí chờ sơn bao lâu? Chỗ để có giới hạn không?", "giới hạn hàng chờ trước sơn — thường là nút thắt"), "P1", ""),
 ("TH3", ("Có tổ nào khác làm thay hàn khi cao điểm không?", "năng lực linh hoạt"), "P2", ""),
 ("TH4", ("Tổ hàn có bị ảnh hưởng khi tổ máy giao thiếu/không đúng model không?", "rủi ro phụ thuộc giữa tổ"), "P2", ""),
 ("TH5", ("Một ngày tổ hàn ra được bao nhiêu bộ hoàn chỉnh (đã test đạt)?", "năng lực thực tế"), "P1", ""),
])

doc.add_page_break()
# =====================  3. TỔ SƠN  =====================
head("3. TỔ SƠN  (theo bảng: 2 đơn vị thời gian — ước là nút thắt)")
qs([
 ("SON1", ("Sơn loại gì (sơn tĩnh điện / sơn nước / phun dầu)? Có lò sấy/nung không?", "công nghệ quyết định thời gian và cách gom lô"), "P1", ""),
 ("SON2", ("Mỗi lượt sơn (1 mẻ lò) được bao nhiêu bộ? Một mẻ mất bao lâu (tính cả sấy)?", "năng lực lò sơn — con số quan trọng nhất của module"), "P1", ""),
 ("SON3", ("Một ngày sơn được mấy mẻ? Tổ sơn mấy người?", "năng lực/ngày"), "P1", ""),
 ("SON4", ("Đang dùng bao nhiêu màu? Danh sách màu chuẩn ở đâu (bảng mã RAL / theo mã hàng)?", "app cần danh mục màu để gom lô"), "P1", ""),
 ("SON5", ("Đổi màu mất bao lâu (vệ sinh súng/buồng)? Có phải bắn màu nhạt trước màu đậm không?", "thời gian setup theo màu"), "P1", ""),
 ("SON6", ("Có phải gom lô theo màu không? Tối thiểu bao nhiêu bộ cho 1 lô màu?", "quy tắc gom lô sơn"), "P1", ""),
 ("SON7", ("Khách cần 1 bộ màu lạ hoặc số lượng ít thì xử lý thế nào (vẫn sơn riêng)?", "ngoại lệ của quy tắc gom lô"), "P1", ""),
 ("SON8", ("Sơn cho cả khung/cánh/phào cùng lúc hay sơn riêng từng phần?", "phạm vi theo khung/cánh/phào"), "P1", ""),
 ("SON9", ("Sau sơn bao lâu mới được vân? Bao lâu mới đóng gói được? Có sấy cưỡng bức không?", "thời gian chờ — chỗ kế hoạch hay trượt"), "P1", ""),
 ("SON10", ("Sơn có phải bảo trì/định kỳ không? Bao lâu bảo trì 1 lần, mất bao lâu?", "app phải chừa thời gian dừng máy"), "P2", ""),
 ("SON11", ("Có phải đặt màu/phối màu trước không? Lấy màu mất bao lâu?", "lead time chuẩn bị vật tư"), "P2", ""),
 ("SON12", ("Có sơn gia công ngoài không? Đơn vị nào, thời gian gửi/nhận?", "nếu có thì ghi như 1 tổ ảo trong kế hoạch"), "P2", ""),
 ("SON13", ("Lỗi sơn (chảy, bụi, lệch màu) xử lý thế nào? Sơn lại mất bao lâu?", "làm lại — ảnh hưởng lớn tới lead time"), "P1", ""),
 ("SON14", ("Kiểm tra màu/bề mặt ai duyệt? So với mẫu hay mã RAL?", "điểm QC"), "P2", ""),
 ("SON15", ("Một tuần tổ sơn làm được tối đa bao nhiêu bộ?", "năng lực/tuần để cảnh báo quá tải"), "P1", ""),
 ("SON16", ("Có phải gom đủ lô cả tuần mới sơn 1 lượt không, hay sơn hằng ngày?", "tần suất sơn quyết định cách xếp kế hoạch"), "P1", ""),
])

doc.add_page_break()
# =====================  4. TỔ VÂN  =====================
head("4. TỔ VÂN")
qs([
 ("VAN1", ("Vân là gì (dán film vân gỗ bằng máy dán / ép nhiệt)? Làm sau khi sơn đúng không?", "xác nhận công nghệ và vị trí"), "P1", ""),
 ("VAN2", ("Mã vân lấy từ đâu: khách chọn theo mẫu, theo mã hàng, hay theo model nhôm? App có lưu mã vân không?", "app cần trường “mã vân” để gom lô"), "P1", ""),
 ("VAN3", ("Đang dùng bao nhiêu mã vân? Danh sách mã vân ở đâu?", "danh mục để gom lô vân"), "P1", ""),
 ("VAN4", ("Vân cho khung / cánh / phào — có dùng cùng 1 mã vân không, có khi khác nhau không?", "phạm vi + khả năng chia nhiều mã vân trong 1 bộ"), "P1", ""),
 ("VAN5", ("Đổi mã vân mất bao lâu?", "setup theo mã vân"), "P1", ""),
 ("VAN6", ("Có phải gom lô theo mã vân không? Tối thiểu bao nhiêu bộ 1 lượt?", "quy tắc gom lô vân"), "P1", ""),
 ("VAN7", ("Thời gian vân 1 bộ bao lâu? Tính theo mét dài / m² / số bộ?", "định mức thời gian"), "P1", ""),
 ("VAN8", ("Sau vân bao lâu mới được lắp kính/đóng gói? Có phải chờ nguội/khô không?", "thời gian chờ"), "P1", ""),
 ("VAN9", ("Vân lỗi (bong, lệch, xước) xử lý sao? Phải bóc film rồi sơn lại không? Mất bao lâu?", "làm lại nhiều bước — rất ảnh hưởng lead time"), "P1", ""),
 ("VAN10", ("Máy vân mấy cái, mấy người? Một ngày được bao nhiêu bộ?", "năng lực"), "P1", ""),
 ("VAN11", ("Vân có làm trước/sau khi lắp kính? Có phải che kính khi vân không?", "thứ tự với công đoạn lắp kính"), "P1", ""),
 ("VAN12", ("Có kiểm tra màu/vân so với mẫu khách trước khi đóng gói không?", "điểm QC cuối"), "P2", ""),
])

# =====================  5. LẮP KÍNH + PHỤ KIỆN (chưa có trong bảng)  =====================
head("5. LẮP KÍNH + PHỤ KIỆN — công đoạn CHƯA có trong bảng công đoạn nhưng đơn hàng đang có")
note("Trong đơn hàng của app có: kính trên cánh + vách kính 8.38, khoá tay trúc (mã khoá), phụ kiện ở bảng chi tiết, ô thoáng… "
     "nhưng bảng công đoạn của xưởng đang nhảy từ Vân sang Vệ sinh + Đóng gói. Cần làm rõ mục này để không bỏ sót công đoạn.")
qs([
 ("LK1", ("Có bước lắp kính + phụ kiện không? Do tổ nào làm?", "xác nhận có/không và gán vào tổ — nếu thiếu, kế hoạch sẽ tính sai"), "P1", ""),
 ("LK2", ("Lắp kính gồm những việc gì (đặt gioăng, silicon, nêm, gắn nẹp)? Mất bao lâu/bộ?", "định mức thời gian"), "P1", ""),
 ("LK3", ("Lắp phụ kiện gồm những gì (khoá, bản lề, tay nắm, ray, bánh xe, chốt, phụ kiện ô thoáng)? Mất bao lâu?", "định mức thời gian"), "P1", ""),
 ("LK4", ("Lắp kính/phụ kiện làm sau Vân hay sau Sơn (nếu không có Vân)?", "vị trí trong chuỗi công đoạn"), "P1", ""),
 ("LK5", ("Kính có phải đặt ngoài/cắt ngoài không? Thời gian chờ kính bao lâu?", "lead time vật tư — có thể làm trễ cả bộ"), "P1", ""),
 ("LK6", ("Thiếu kính/phụ kiện thì có đẩy các bộ khác trước không, hay bộ đó đứng chờ?", "quy tắc đẩy từng bộ"), "P1", ""),
 ("LK7", ("App có đủ thông tin để mua/lắp phụ kiện chưa: mã khoá, số lượng phụ kiện, loại kính? Thiếu gì?", "bổ sung trường dữ liệu"), "P1", ""),
 ("LK8", ("Lắp xong có kiểm tra đóng/mở trơn, khoá khít, độ kín không? Ai kiểm?", "điểm QC trước đóng gói"), "P2", ""),
 ("LK9", ("Có phải lắp thử toàn bộ bộ cửa trước khi đóng gói không?", "thời gian thử lắp"), "P2", ""),
 ("LK10", ("Có lắp cả khoá/ray/ô thoáng tại xưởng rồi tháo ra để vận chuyển không?", "thời gian lắp/tháo 2 lần"), "P2", ""),
 ("LK11", ("Phụ kiện thiếu/không đúng mã thì ai phát hiện, báo cho ai, chờ bao lâu?", "luồng xử lý thiếu vật tư"), "P1", ""),
 ("LK12", ("Khi nhận đơn, xưởng có phải gọi sale hỏi lại thông tin gì không? Hỏi những gì, hay gặp nhất là gì?", "đây là danh sách trường dữ liệu app cần thêm/bắt buộc"), "P1", ""),
])

doc.add_page_break()
# =====================  6. TỔ KHO  =====================
head("6. TỔ KHO — Vệ sinh, Đóng gói, Kho & Giao hàng")
sub("6.1. Vệ sinh + Đóng gói")
qs([
 ("KHO1", ("Vệ sinh + đóng gói gồm những gì (lai chùi, dán băng dính bảo vệ, bọc xốp/màng co, đóng thùng)?", "nội dung công đoạn"), "P2", ""),
 ("KHO2", ("Mất bao lâu 1 bộ? Có phụ thuộc kích thước/số cánh không?", "định mức thời gian"), "P1", ""),
 ("KHO3", ("Đóng gói theo bộ hay theo kiện (nhiều bộ 1 kiện)? Mỗi kiện mấy bộ?", "đơn vị đóng gói để lập kế hoạch giao"), "P2", ""),
 ("KHO4", ("Có dán nhãn/tem gì trên kiện không (mã đơn, bộ số, tên khách, số kiện)?", "app có thể in tem tự động"), "P2", ""),
 ("KHO5", ("Sau khi đóng gói, bộ được coi là “hoàn thành sản xuất” đúng không?", "mốc dữ liệu Hoàn thành sản xuất"), "P1", ""),
 ("KHO6", ("Tổ kho mấy người? Một ngày đóng gói được bao nhiêu bộ?", "năng lực"), "P1", ""),
 ("KHO7", ("Hàng đóng gói xong để ở đâu, được bao lâu? Có giới hạn chỗ không?", "giới hạn hàng chờ giao"), "P2", ""),
 ("KHO8", ("Có đóng gói lại/kiểm lại trước khi giao không, hay giao luôn?", "bước kiểm tra cuối"), "P2", ""),
])
sub("6.2. Kho, giao hàng & lắp đặt tại công trình")
qs([
 ("GH1", ("Ai ghi ngày giao thực tế? Ghi ở đâu (app / phiếu giao hàng giấy)?", "app cần trường “ngày giao thực tế” — hiện chưa có"), "P1", ""),
 ("GH2", ("“Hạn giao” trên đơn là ngày xưởng xong hay ngày giao tới khách?", "mốc mà kế hoạch phải nhắm tới"), "P1", ""),
 ("GH3", ("Xưởng có xe riêng không, mấy chuyến/ngày, mỗi chuyến bao nhiêu bộ?", "năng lực giao hàng — cũng là 1 nguồn lực cần xếp"), "P1", ""),
 ("GH4", ("Có gom chuyến theo khu vực/đại lý không? App đang có khu vực và số km — có dùng để gom chuyến không?", "quy tắc gom chuyến giao"), "P2", ""),
 ("GH5", ("Có giao từng phần cho khách không (giao trước vài bộ)?", "chia nhỏ kế hoạch"), "P2", ""),
 ("GH6", ("Có lắp đặt tại công trình không? Ai đi lắp, bao lâu 1 bộ, có lấy ngày lắp làm mốc hoàn thành không?", "1 công đoạn có thể nằm ngoài xưởng nhưng vẫn cần trong kế hoạch"), "P1", ""),
 ("GH7", ("Khách có ký nhận/ghi biên bản khi giao không?", "nguồn dữ liệu ngày giao thực tế đáng tin"), "P2", ""),
 ("GH8", ("Hàng phải sửa/sai tại công trình: quay lại xưởng hay sửa tại chỗ? Mất bao lâu?", "xử lý làm lại sau giao"), "P1", ""),
 ("GH9", ("Có trường hợp khách chưa lấy hàng, hàng để kho lâu không? Bao lâu thì coi là tồn?", "app cần cảnh báo hàng tồn kho chờ giao"), "P2", ""),
 ("GH10", ("Giao hàng có phải chờ thanh toán không (thu tiền khi giao)?", "nếu có thì kế hoạch giao phụ thuộc kế toán"), "P2", ""),
 ("GH11", ("Một tuần xưởng giao được tối đa bao nhiêu bộ?", "năng lực giao hàng"), "P1", ""),
 ("GH12", ("Trễ hạn hiện nay thường do khâu giao hàng hay do sản xuất chưa xong?", "xác định đúng nút thắt của trễ hạn"), "P2", ""),
])

doc.add_page_break()
# =====================  7. VẤN ĐỀ XUYÊN SUỐT KHI LÊN KẾ HOẠCH  =====================
head("7. CÁC VẤN ĐỀ XUYÊN SUỐT KHI LÊN KẾ HOẠCH SẢN XUẤT")
note("Phần này hỏi quản đốc / người đang lên kế hoạch — đây là những điểm quyết định app có dùng được thật hay không.")
sub("7.1. Cách lên kế hoạch hiện nay")
qs([
 ("KH1", ("Hiện nay ai lên kế hoạch sản xuất? Bao lâu lên 1 lần (hằng ngày / hằng tuần)?", "biết nghiệp vụ gốc và tần suất cập nhật"), "P1", ""),
 ("KH2", ("Kế hoạch đang làm bằng gì (giấy, bảng trắng, Excel, Zalo)? Có thể xin bản mẫu được không?", "app phải thay đúng thứ đang dùng, xin mẫu để bám theo"), "P1", ""),
 ("KH3", ("Kế hoạch hiện chia theo gì: theo tuần, theo ngày, theo tổ, hay theo đơn?", "quyết định màn hình chính của module"), "P1", ""),
 ("KH4", ("Khi xếp lịch, xem những yếu tố nào trước: hạn giao, ngày nhận đơn, vật tư đã có, hay khách giục?", "thuật toán xếp lịch"), "P1", ""),
 ("KH5", ("Một bộ được coi là “đủ điều kiện đưa vào sản xuất” khi nào (đã có bản vẽ? đã có nhôm? đã có màu? khách đã xác nhận?)", "điều kiện đưa bộ vào kế hoạch — nếu bỏ qua sẽ xếp lịch ảo"), "P1", ""),
 ("KH6", ("Có bao nhiêu đơn/bộ đang làm dở thường xuyên? Bao nhiêu bộ là “quá nhiều” với xưởng?", "app cần cảnh báo WIP"), "P2", ""),
])
sub("7.2. Năng lực & thực tế sản xuất")
qs([
 ("KH7", ("Thực tế hiện nay xưởng làm ra bao nhiêu bộ/tuần (không phải con số lý thuyết)? Tối đa được bao nhiêu?", "con số nền để so tải kế hoạch"), "P1", ""),
 ("KH8", ("Có mùa cao điểm không? Tháng nào đông nhất? Chênh lệch bao nhiêu %?", "kế hoạch theo mùa, dự báo"), "P2", ""),
 ("KH9", ("Ngày thường làm mấy tiếng, mấy ca? Cao điểm có tăng ca? Tăng được bao nhiêu %?", "năng lực linh hoạt"), "P1", ""),
 ("KH10", ("Tỷ lệ trễ hạn hiện nay khoảng bao nhiêu %? Nguyên nhân chính (nhôm về chậm / sơn / khách đổi / thiếu người / giao hàng)?", "app cần danh mục lý do trễ + đo lường"), "P1", ""),
 ("KH11", ("Năng suất 1 người 1 ngày bao nhiêu bộ (hoặc m²)? Có chấm công/tính lương theo sản phẩm không?", "nếu có thì app có thể hỗ trợ tính năng suất"), "P2", ""),
 ("KH12", ("Tỷ lệ lỗi phải làm lại khoảng bao nhiêu %? Chi phí 1 lần làm lại mất thêm bao nhiêu thời gian?", "dự phòng thời gian làm lại trong kế hoạch"), "P2", ""),
 ("KH13", ("Có phải chờ vật tư (nhôm/kính/phụ kiện) làm dừng sản xuất không? Thường chờ bao lâu?", "app cần cảnh báo thiếu vật tư trước khi xếp lịch"), "P1", ""),
])
sub("7.3. Ngoại lệ & thay đổi")
qs([
 ("KH14", ("Ai được quyền chen đơn gấp lên trước? Sale có tự chen được không?", "phân quyền và quy tắc ưu tiên"), "P1", ""),
 ("KH15", ("Khách đổi kích thước/màu/số lượng sau khi đã vào sản xuất thì xử lý thế nào?", "app cần luồng xử lý thay đổi giữa chừng"), "P1", ""),
 ("KH16", ("Đơn bị hủy giữa lúc đang sản xuất thì xử lý thế nào? Hàng đã làm dở tính sao?", "xử lý đơn hủy — hiện app chỉ có trạng thái Đã hủy"), "P2", ""),
 ("KH17", ("Đơn làm lại (hàng lỗi khách trả) có chen trước đơn thường không? Quay lại công đoạn nào?", "quy tắc xử lý đơn làm lại"), "P1", ""),
 ("KH18", ("Đơn hàng mẫu (làm mẫu cho khách xem) có chiếm chỗ sản xuất không? Ưu tiên thế nào?", "phân biệt loại đơn khi lên kế hoạch"), "P1", ""),
 ("KH19", ("Có sản xuất trước để tồn kho/bán sẵn không? Bao nhiêu % sản lượng?", "nếu có thì kế hoạch phải gồm cả phần dự báo"), "P1", ""),
 ("KH20", ("Khi kế hoạch và thực tế lệch (máy hỏng, nghỉ người), ai cập nhật lại kế hoạch và cập nhật ở đâu?", "app cần màn hình cập nhật nhanh"), "P1", ""),
])
sub("7.4. Cập nhật & báo cáo trong ngày")
qs([
 ("KH21", ("Xưởng muốn cập nhật tiến độ ở đâu: máy tính ở xưởng, điện thoại, hay ghi giấy rồi văn phòng nhập?", "quyết định giao diện nhập — quan trọng nhất cho việc app có được dùng hay không"), "P1", ""),
 ("KH22", ("Cập nhật theo mức nào: theo bộ, hay theo từng công đoạn của từng bộ?", "mức chi tiết dữ liệu"), "P1", ""),
 ("KH23", ("Ai là người cập nhật (tổ trưởng tổ nào, hay 1 người văn phòng)?", "phân quyền và trách nhiệm"), "P1", ""),
 ("KH24", ("Mỗi ngày xưởng cần xem gì: việc hôm nay của tổ, việc chậm, việc xong, hay tải tuần sau?", "thiết kế màn hình kế hoạch"), "P1", ""),
 ("KH25", ("Có cần in phiếu lệnh sản xuất cho từng tổ không? In nội dung gì, khổ giấy nào?", "mẫu in (app có sẵn reportlab)"), "P2", ""),
 ("KH26", ("Có cần in danh sách việc theo ngày/tuần để dán ở xưởng không?", "mẫu in thứ hai"), "P2", ""),
 ("KH27", ("Có cần biết ai làm bộ nào (gắn tên thợ) để tính năng suất/lỗi không?", "nếu có thì app phải lưu người phụ trách"), "P2", ""),
 ("KH28", ("Khâu KỸ THUẬT (thiết kế + chương trình máy) có bị nghẽn không? Mỗi tuần có bao nhiêu model MỚI phải làm chương trình?", "nút thắt có thể nằm ở kỹ thuật chứ không ở xưởng"), "P1", ""),
])

doc.add_page_break()
# =====================  8. DỮ LIỆU ĐỀ XUẤT BỔ SUNG  =====================
head("8. DỮ LIỆU APP SẼ THÊM (chốt theo câu trả lời ở mục 1–7)")
note("Mỗi dòng: xưởng xác nhận có cần không, ai nhập, có bắt buộc nhập không. Cột “Trả lời” ghi: Cần / Không cần / Ghi chú.")
rows8 = [
 ("Trạng thái sản xuất từng BỘ (Chờ SX / Đang SX / Hoàn thành / Đã giao / Tạm dừng)", "biết bộ nào đã xong — hiện app không có", "", ""),
 ("Ngày bắt đầu & ngày xong từng công đoạn", "đo thời gian thực tế, biết chỗ nào trễ", "", ""),
 ("Trạng thái từng CÔNG ĐOẠN của từng bộ", "theo dõi chi tiết (chỉ nên bật nếu xưởng nhập được)", "", ""),
 ("Phạm vi công việc: KHUNG / CÁNH / PHAO / CẢ BỘ", "3 luồng song song — biết khung đã xong chưa", "", ""),
 ("Tổ phụ trách + Người phụ trách", "phân công và năng suất", "", ""),
 ("Giờ công định mức theo loại cửa / model", "tính tải kế hoạch chính xác", "", ""),
 ("Chương trình máy cắt theo model (tên file, phiên bản, máy, người làm, ngày)", "tái sử dụng chương trình cũ; cảnh báo model chưa có chương trình", "", ""),
 ("Năng lực từng tổ (số người, bộ/ngày, giờ/tuần)", "cảnh báo quá tải", "", ""),
 ("Thời gian setup: đổi màu sơn / đổi mã vân / đổi khuôn chấn", "giảm thời gian chết khi xếp chung tuần", "", ""),
 ("Thời gian chờ: chờ khô sau sơn, sau vân, sau bồi Lares", "không lên kế hoạch sát nhau khi hàng chưa khô", "", ""),
 ("Mã màu chuẩn & mã vân (danh mục)", "gom lô sơn / lô vân", "", ""),
 ("Ngày giao thực tế (đơn)", "tính tỷ lệ giao đúng hạn", "", ""),
 ("Ngày hoàn thành sản xuất (đơn/bộ)", "biết xưởng xong lúc nào so với hạn", "", ""),
 ("Lý do trễ (danh mục: chờ nhôm, chờ màu, khách đổi, thiếu người…)", "thống kê nguyên nhân trễ", "", ""),
 ("Lỗi & làm lại (bộ nào, công đoạn nào, mất bao lâu)", "tính tỷ lệ lỗi theo tổ", "", ""),
 ("Ghi chú sản xuất theo bộ (khác ghi chú của sale)", "yêu cầu kỹ thuật phát sinh khi làm", "", ""),
 ("Đính kèm bản vẽ / ảnh xưởng cho từng bộ", "thay cho việc gửi Zalo", "", ""),
]
tbl(["Trường đề xuất thêm", "Ý nghĩa", "Cần?", "Ghi chú"], rows8, [Cm(8.6), Cm(6.4), Cm(1.4), Cm(1.4)])

# =====================  9. KIỂM TRA CHÉO  =====================
head("9. KIỂM TRA CHÉO: thông tin app đang có — xưởng có dùng không?")
note("Đánh dấu vào cột cuối: “Có” (xưởng dùng), “Không” (không cần), hoặc ghi “thiếu …” nếu chưa đủ để sản xuất.")
rows9 = [
 ("Bộ số (set_no)", ""), ("Mã hàng / Tên sản phẩm", ""), ("Model nhôm", ""),
 ("Loại mở (opening_direction)", ""), ("Hướng phào / Loại phào / Số phào", ""),
 ("Số cánh (leaves_per_set)", ""), ("Ô thoáng (window_bars)", ""), ("Thông tin cánh/panel (panel_info)", ""),
 ("Màu sơn (paint_color)", ""), ("Cao × Rộng (height_mm, width_mm)", ""),
 ("Khung bao (frame_mm)", ""), ("Thông thủy cao/rộng (clear_*)", ""),
 ("Mã khoá (lock_model)", ""), ("Phụ kiện ở bảng chi tiết (tên/SL/ghi chú/ảnh)", ""),
 ("Ghi chú dòng hàng", ""), ("Ảnh sản phẩm / ảnh chi tiết", ""),
 ("Hạn giao (required_delivery_date)", ""), ("Ngày đặt hàng (order_date)", ""),
 ("Khách hàng / Đại lý / Khu vực / Số km", ""), ("KH/Lượng (pricing_quantity) & ĐVT", ""),
]
tbl(["Trường dữ liệu", "Xưởng có dùng không? (Có / Không / Thiếu gì?)"], rows9, [Cm(9.0), WT - Cm(9.0)])

doc.add_page_break()
# =====================  10. MẶC ĐỊNH  =====================
head("10. MẶC ĐỊNH nếu chưa trả lời được (app vẫn chạy, sửa lại sau)")
mac = [
 ("Đơn vị thời gian", "Ngày làm việc, thứ 2 – thứ 6, nghỉ chủ nhật"),
 ("Đơn vị kế hoạch", "1 bộ cửa (theo Bộ số)"),
 ("Bồi Lares", "Bước riêng, làm TRƯỚC Cắt (không trùng bước Vân)"),
 ("Ép cánh", "1 ngày công, làm sau Hàn"),
 ("Lắp kính + phụ kiện", "CÓ công đoạn này, sau Vân, 1 ngày"),
 ("Chờ khô", "Sau sơn 1 ngày; sau vân 1 ngày"),
 ("Thiết kế", "Nằm trong kế hoạch, 1 ngày, thời lượng giảm về 0 nếu mã hàng đã có mẫu"),
 ("Năng lực tổ", "Để trống — lập được kế hoạch nhưng chưa cảnh báo quá tải"),
 ("Gom lô sơn", "Không giới hạn lô; gợi ý gom theo màu — bật khi có số thật"),
 ("Gom lô vân", "Không giới hạn lô; gợi ý gom theo mã vân"),
 ("Ưu tiên xếp lịch", "Hạn giao gần nhất trước (EDD)"),
 ("Đẩy công đoạn", "Cho phép đẩy từng bộ khi bộ đó đã đủ"),
 ("Điều kiện vào sản xuất", "Đơn đã xác nhận + có Bộ số + có hạn giao"),
 ("Đơn làm lại", "Ưu tiên cao nhất, bắt đầu ở công đoạn bị lỗi (chọn tay)"),
 ("Đơn hàng mẫu", "Không vào kế hoạch sản xuất (chỉ vào khi bật cấu hình)"),
 ("Làm tồn kho", "Không có — chỉ làm theo đơn (đổi khi xưởng xác nhận khác)"),
 ("Trễ hạn tính cho", "Chỉ đơn đã xác nhận"),
 ("Cập nhật tiến độ", "1 người văn phòng/xưởng nhập hằng ngày, theo mức BỘ"),
 ("Ngày giao thực tế", "Nhập khi giao, sau đó mới tính được đúng hạn"),
 ("Đăng nhập & phân quyền", "1 tài khoản quản trị chung trước; phân quyền làm ngay sau"),
]
tbl(["Hạng mục", "Giá trị mặc định dùng tạm"], mac, [Cm(4.0), WT - Cm(4.0)], hdr_fill="EEEEEE")

head("11. XIN KÈM THEO (nếu có)")
for line in ["[   ] Mẫu kế hoạch sản xuất xưởng đang dùng (giấy / Excel / ảnh bảng trắng / ảnh Zalo)",
             "[   ] Bảng công đoạn bản gốc + mẫu phiếu tiến độ đang dùng",
             "[   ] Danh sách máy móc từng tổ (số máy, model máy, tình trạng)",
             "[   ] Số người từng tổ + ca làm việc",
             "[   ] Danh mục màu sơn + mã vân đang dùng",
             "[   ] Danh sách model nhôm đang làm + loại cửa bán chạy",
             "[   ] 1 bộ bản vẽ mẫu (bản vẽ cắt nhôm / bản vẽ cánh / bản vẽ kính)",
             "[   ] Mẫu phiếu giao hàng + cách ghi ngày giao thực tế",
             "[   ] Ảnh chụp từng tổ + chỗ để hàng chờ giữa các công đoạn (để đặt tên và giới hạn WIP đúng)",
             "[   ] Số liệu 1–2 tháng gần đây: bộ sản xuất / tuần, số đơn trễ hạn"]:
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(1)
    run(p, line, size=8.5)

p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(10)
run(p, "GOLDMAX · Phiếu câu hỏi chi tiết theo tổ & công đoạn — thiết kế module Lên kế hoạch sản xuất · V118 "
       "(bản ngắn V117 dùng khi trao đổi nhanh).", size=7.5, italic=True, color=XAM)

out = "/home/user/.workspace/artifacts/phieu-cau-hoi-chi-tiet-theo-to-v118.docx"
doc.save(out)
print("đã tạo:", out)
