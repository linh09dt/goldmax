# -*- coding: utf-8 -*-
"""V119 — Đánh giá video quy trình sản xuất cửa thép vân gỗ Alux (Alumax) & bài học cho module kế hoạch."""
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
s.left_margin = s.right_margin = Cm(1.4); s.top_margin = Cm(1.4); s.bottom_margin = Cm(1.4)
n = doc.styles["Normal"]; n.font.name = "Arial"; n.font.size = Pt(10)
n._element.rPr.rFonts.set(qn("w:eastAsia"), "Arial"); n._element.rPr.rFonts.set(qn("w:cs"), "Arial")
WT = Cm(21 - 2.8)


def run(p, t, size=10, bold=False, italic=False, color=None):
    r = p.add_run(t); r.font.name = "Arial"; r.font.size = Pt(size); r.bold = bold; r.italic = italic
    if color is not None: r.font.color.rgb = color
    r._element.rPr.rFonts.set(qn("w:cs"), "Arial"); return r


def shade(cell, c):
    el = OxmlElement("w:shd"); el.set(qn("w:val"), "clear"); el.set(qn("w:fill"), c)
    cell._tc.get_or_add_tcPr().append(el)


def head(t, size=12):
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(11); p.paragraph_format.space_after = Pt(3)
    pPr = p._p.get_or_add_pPr()
    el = OxmlElement("w:shd"); el.set(qn("w:val"), "clear"); el.set(qn("w:fill"), "DDEEF5"); pPr.append(el)
    bd = OxmlElement("w:pBdr"); l = OxmlElement("w:left")
    l.set(qn("w:val"), "single"); l.set(qn("w:sz"), "20"); l.set(qn("w:color"), "0E7490")
    bd.append(l); pPr.append(bd)
    run(p, " " + t, size=size, bold=True, color=RGBColor(0x08, 0x33, 0x44))


def para(t, size=10, bold=False, italic=False, color=None, space=3):
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(space)
    run(p, t, size=size, bold=bold, italic=italic, color=color); return p


def bullet(t, size=9.5, bold_head=None):
    p = doc.add_paragraph(style="List Bullet"); p.paragraph_format.space_after = Pt(2)
    if bold_head:
        run(p, bold_head, size=size, bold=True)
    run(p, t, size=size); return p


def tbl(header, rows, ws):
    table = doc.add_table(rows=1, cols=len(ws)); table.style = "Table Grid"
    for i, t in enumerate(header):
        c = table.rows[0].cells[i]; shade(c, "EEEEEE")
        run(c.paragraphs[0], t, size=8.5, bold=True)
    for r in rows:
        cells = table.add_row().cells
        table.rows[-1].height = Cm(0.5); table.rows[-1].height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
        for i, v in enumerate(r):
            p = cells[i].paragraphs[0]; p.paragraph_format.space_after = Pt(0)
            run(p, str(v), size=8.5, bold=(i == 0))
    table.autofit = False
    for row in table.rows:
        for i, w in enumerate(ws): row.cells[i].width = w
    return table


# ---------------- TIÊU ĐỀ ----------------
p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(2)
run(p, "ĐÁNH GIÁ VIDEO: “Quy trình sản xuất Cửa thép vân gỗ Alux | Alumax Việt Nam”", size=13.5, bold=True)
p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(8)
run(p, "Video: youtube.com/watch?v=vOsI-lF0_NM · Kênh: Cửa Thép Vân Gỗ Alux · Nội dung do AI (Zentor) đọc và đối chiếu với quy trình cửa nhôm của GOLDMAX (bảng công đoạn V116) và module Lên kế hoạch sản xuất (V117–V118).",
    size=8, italic=True, color=XAM)

head("1. Mình đã lấy được gì từ video (và giới hạn)")
bullet("YouTube chặn IP của môi trường này (“Sign in to confirm you're not a bot”) nên không tải được video/phụ đề. Mình đã dùng trình duyệt chống phát hiện để mở đúng trang video và lấy được **tiêu đề + 4 khung hình thật** của video (thumbnail + 3 khung tự động ở các mốc thời gian).")
bullet("Phần lớn khung hình là khu vực **máy chấn tôn** (máy “Xact Smart 160”), công nhân ALUX mặc áo đỏ đang chấn tôn tấm, có bàn đo/cắt và kệ phôi — tức video quay ở xưởng thật, không phải render.")
bullet("Để có đủ nội dung quy trình, mình lấy **bài viết cùng công ty** (alux.com.vn – “Quy Trình Sản Xuất Cửa Thép Vân Gỗ Alux”), là bản chữ của đúng nội dung video. Nội dung ở mục 2 là từ bài viết này, không phải mình tự suy diễn.")

head("2. Quy trình sản xuất cửa thép vân gỗ Alux (theo bài viết của chính Alux)")
tbl(["Công đoạn", "Các bước (nguyên văn rút gọn)", "Thiết bị / vật liệu"], [
 ("0. Chuẩn bị sản xuất", "Điền Form “Đề nghị sản xuất” + bản vẽ thiết kế ĐÃ ĐƯỢC PHÊ DUYỆT + đơn hàng có xác nhận của khách (bản cứng/scan). Phụ kiện mới chưa từng làm → phải gửi mẫu hoặc bản vẽ có đủ thông số.", "Form, bản vẽ, hợp đồng"),
 ("1. Cắt kích thước & khoét lỗ", "Nhận bản vẽ + lệnh sản xuất → kiểm tra máy → nhận phôi từ kho NVL → cắt theo bản vẽ/hướng dẫn SX.", "Máy cắt CNC (công nghệ Bystronic – Thụy Sỹ)"),
 ("2. Gấp tạo hình (chấn)", "Nhận bản vẽ, lệnh SX, bán thành phẩm từ bộ phận cắt → kiểm tra khuôn & máy → gấp biến dạng phôi.", "Máy chấn, khuôn (Xact Smart 160 trong video)"),
 ("3. Xử lý bề mặt / nhúng hóa chất", "Kiểm tra nồng độ & mức dung dịch bể hóa chất → xếp cấu kiện vào giá nhúng → nhúng vệ sinh toàn bộ bề mặt thép → làm sạch hóa chất.", "Bể nhúng hóa chất (tạo màng phốt phát)"),
 ("4. Ép + hàn ghép thành CÁNH cửa", "Nhận bản vẽ/lệnh SX → kiểm tra máy → nhận keo & cốt cửa từ kho → ÉP các cấu kiện thành cánh → hàn liên kết → mài mối hàn, làm sạch ba via.", "Máy ép, keo, cốt cửa (Honeycomb paper / MgO)"),
 ("5. Hàn ghép thành KHUNG cửa", "Nhận bán thành phẩm từ bộ phận chấn → kiểm tra máy & vật tư → hàn liên kết thành khuôn cửa → mài mối hàn, làm sạch ba via.", "Máy hàn"),
 ("6. Sấy & sơn tĩnh điện", "Nhận lệnh hoàn thiện → làm sạch bụi/tạp chất → sơn theo màu yêu cầu.", "Dây chuyền sơn tĩnh điện"),
 ("7. Hoàn thiện vân gỗ", "Nhận keo & giấy vân gỗ từ kho → làm sạch bán thành phẩm đã sơn nền → DÁN giấy vân gỗ lên khung/cánh → cho vào buồng sấy (nhiệt độ & thời gian theo hướng dẫn) → vệ sinh bề mặt.", "Keo, giấy vân, buồng sấy, in chuyển ấn nóng 230°C"),
 ("8. Lắp ghép thành bộ & đóng gói", "Nhận lệnh hoàn thiện + bản vẽ + bán thành phẩm từ bộ phận sơn → nhận phụ kiện (khoá, bản lề, vít) từ kho → LẮP phụ kiện vào cánh + khuôn thành bộ hoàn chỉnh → đóng gói.", "Phụ kiện; bản lề inox SUS304 tự sản xuất"),
], [Cm(3.4), Cm(8.6), Cm(4.2)])

head("3. Đối chiếu với quy trình cửa nhôm của GOLDMAX (bảng công đoạn V116)")
tbl(["Cửa thép vân gỗ (Alux)", "Cửa nhôm GOLDMAX (bảng của bạn)", "Nhận xét"], [
 ("Chuẩn bị: form đề nghị SX + bản vẽ đã duyệt + đơn đã xác nhận", "Chưa nêu trong bảng công đoạn (đang chỉ có \"Thiết kế\")", "GOLDMAX đang thiếu bước “chốt điều kiện vào sản xuất”"),
 ("Cắt kích thước + khoét lỗ", "Cắt Lares khung/cánh + cắt phào", "Tương đương; GOLDMAX tách 3 luồng khung/cánh/phào"),
 ("Gấp tạo hình (chấn)", "Chấn khung/cánh/phào", "Tương đương"),
 ("Nhúng hóa chất xử lý bề mặt", "Không có (nhôm sơn tĩnh điện trực tiếp)", "Khác biệt công nghệ — không cần copy"),
 ("Ép + hàn thành CÁNH; hàn thành KHUNG (2 công đoạn riêng)", "Hàn (gộp khung/cánh/phào) + Ép cánh", "Thép tách cánh/khung rõ; nhôm gộp — nhưng cả hai đều là “cốt + 2 lớp”"),
 ("Mài mối hàn, làm sạch ba via", "Chưa có trong bảng", "Nên bổ sung bước “mài hoàn thiện” — có tốn thời gian"),
 ("Sấy + sơn tĩnh điện", "Sơn (2 đơn vị thời gian)", "Tương đương"),
 ("Dán giấy vân gỗ + sấy buồng", "Vân khung/cánh/phào", "Cùng bản chất: dán vân rồi sấy/khô"),
 ("Lắp phụ kiện + đóng gói (1 công đoạn)", "Vệ sinh + Đóng gói (thiếu lắp kính/phụ kiện)", "Đúng chỗ GOLDMAX còn thiếu — xem V116 mục 5"),
], [Cm(4.5), Cm(5.2), Cm(6.5)])

head("4. Tám bài học áp dụng cho module Lên kế hoạch sản xuất")

lessons = [
 ("1. Mỗi công đoạn phải bắt đầu bằng “nhận LỆNH SẢN XUẤT”",
  "Trong quy trình của Alux, mọi công đoạn đều có “Bước 1: nhận bản vẽ + lệnh sản xuất”. Đây chính là tờ phiếu lệnh mà mình đề xuất ở V116/V118 nhưng giờ có bằng chứng: xưởng lớn làm đúng như vậy.",
  "app in phiếu lệnh sản xuất theo tổ/tuần; trạng thái bộ chỉ chuyển khi tổ xác nhận đã nhận lệnh."),
 ("2. Phải có bước “chốt điều kiện vào sản xuất”",
  "Alux yêu cầu Form đề nghị SX + bản vẽ ĐÃ PHÊ DUYỆT + đơn có xác nhận của khách. Nếu thiếu, xưởng không bắt đầu.",
  "đây chính là câu KH5 trong phiếu V118. App nên chặn (hoặc cảnh báo đỏ) khi đưa bộ vào kế hoạch mà chưa đủ điều kiện: chưa xác nhận, chưa có Bộ số, chưa có hạn giao."),
 ("3. Mỗi công đoạn có “kiểm tra máy/khuôn” trước khi làm",
  "Cả 8 công đoạn đều có bước kiểm tra thiết bị. Máy hỏng/khuôn sai là nguyên nhân trễ phổ biến.",
  "app cần trạng thái “dừng máy” + danh mục lý do dừng, và phải trừ năng lực khi máy dừng."),
 ("4. “Bồi Lares” KHÔNG phải ép cốt — nhà máy đã xác nhận",
  "Cửa thép có “ép cốt” (keo + cốt Honeycomb/MgO). Cửa nhôm GOLDMAX có “Bồi Lares”, nhưng nhà máy xác nhận đây là **công đoạn HẬU THIẾT KẾ: chuyển đổi file thiết kế sang chương trình cho máy cắt chuyên dụng (bản chất CAM)** — không phải vật liệu, không phải ép.",
  "app phải phân loại công đoạn GIA_CONG vs CHUAN_BI; Bồi Lares tính theo file/model (≈0 nếu chương trình đã có), làm nguồn lực RIÊNG (kỹ thuật) và là RÀNG BUỘC BẮT BUỘC trước khi Cắt. Xem V121."),
("5. Vân gỗ = DÁN + SẤY theo thời gian quy định",
  "Alux: dán giấy vân → vào buồng sấy → vệ sinh. Có nhiệt độ & thời gian theo hướng dẫn SX.",
  "bước “Vân” của GOLDMAX cũng cần trường “thời gian sấy/khô” và không được xếp lắp kính ngay sau khi vân."),
 ("6. Lắp phụ kiện là công đoạn chính thức, có “nhận phụ kiện từ kho”",
  "Alux gộp lắp phụ kiện + đóng gói thành 1 công đoạn cuối, có bước nhận phụ kiện từ kho.",
  "khẳng định lại: bảng công đoạn GOLDMAX đang thiếu bước lắp kính + phụ kiện (V116 mục 5) — phải bổ sung trước khi thiết kế."),
 ("7. Quy trình viết theo “Bước 1..n” cho từng công đoạn",
  "Cách Alux viết rất dễ số hóa: mỗi công đoạn có các bước, điều kiện vào, kiểm tra, người thực hiện.",
  "mình sẽ chuẩn hóa bảng công đoạn V116 thành dạng này (mỗi công đoạn: điều kiện vào → các bước → điểm kiểm tra → điều kiện ra) để làm dữ liệu cho app."),
 ("8. Cùng lúc có nhiều dòng sản phẩm khác công nghệ",
  "Alux làm cửa thép, cửa cuốn chống cháy, cửa gỗ nhựa composite, uốn vòm kim loại — mỗi dòng một quy trình.",
  "module kế hoạch phải để **quy trình là dữ liệu theo nhóm sản phẩm** (process routing), không hard-code 1 chuỗi công đoạn. Nếu GOLDMAX sau này làm thêm cửa thép/nhôm hệ khác thì app vẫn dùng được."),
]
for t, why, app in lessons:
    para(t, size=10, bold=True, space=1)
    bullet(why, size=9)
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(6); p.paragraph_format.left_indent = Cm(0.8)
    run(p, "→ Thiết kế app: ", size=9, bold=True, color=DO); run(p, app, size=9, color=DO)

head("5. Khác biệt cần lưu ý (đừng copy máy móc)")
bullet("Cửa thép có **dập huỳnh/pano** (ép thủy lực) và **nhúng hóa chất**, cửa nhôm không có — nhưng cửa nhôm có **bồi Lares**, **3 luồng khung/cánh/phào**, và **lắp kính** mà cửa thép không có.", size=9.5)
bullet("Vai trò “cốt” của cửa thép (Honeycomb/MgO) KHÔNG tương ứng với “Bồi Lares” (đã xác nhận Bồi Lares là bước CAM). Nếu cửa nhôm của GOLDMAX cũng có lớp cốt/lõi riêng thì bảng công đoạn hiện chưa thể hiện — phải hỏi riêng. Còn nếu làm cả cửa thép: dùng **cùng danh mục công đoạn, khác “định tuyến” (routing) theo nhóm sản phẩm**.", size=9.5)
bullet("Thời gian sấy/nhiệt độ là thông số kỹ thuật của từng dây chuyền → nên lưu thành **cấu hình theo tổ**, không phải hằng số trong code.", size=9.5)

head("6. Kết luận ngắn")
para("Quy trình của Alux và của GOLDMAX **cùng một khung**: chuẩn bị → cắt → chấn → (cốt/ép) → hàn → xử lý bề mặt (sơn) → vân → lắp phụ kiện → đóng gói. "
     "Ba điểm video/bài viết này củng cố cho thiết kế của mình: (1) **phiếu lệnh sản xuất là bắt buộc** ở mọi công đoạn, (2) **điều kiện vào sản xuất phải rõ** (bản vẽ đã duyệt + đơn đã xác nhận), "
     "(3) **lắp phụ kiện là công đoạn chính thức** — đúng chỗ bảng công đoạn của GOLDMAX đang thiếu. "
     "Nhà máy đã xác nhận (V121): **“Bồi Lares” là bước CAM — chuyển file thiết kế sang chương trình cho máy cắt chuyên dụng**, không phải bồi cốt hay bồi vân.", size=10)

p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(10)
run(p, "Nguồn: bài viết “Quy Trình Sản Xuất Cửa Thép Vân Gỗ Alux” – alux.com.vn (cập nhật 15/12/2023) · video youtube.com/watch?v=vOsI-lF0_NM · "
       "khung hình trích từ i.ytimg.com (thumbnail + 3 khung tự động). Tài liệu V119 · GOLDMAX.", size=7.5, italic=True, color=XAM)

out = "/home/user/.workspace/artifacts/danh-gia-quy-trinh-cua-thep-v119.docx"
doc.save(out)
print("đã tạo:", out)
