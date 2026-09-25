# -*- coding: utf-8 -*-
"""V124 — Đối chiếu câu hỏi ↔ thiết kế module + quyết định nội bộ + phụ lục câu hỏi bổ sung."""
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ROW_HEIGHT_RULE
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
import re as _re

DO = RGBColor(0x0E, 0x74, 0x90); XAM = RGBColor(0x55, 0x55, 0x55); RED = RGBColor(0xB9, 0x1C, 0x1C)
XANH = RGBColor(0x0B, 0x4A, 0x6F); XANH2 = RGBColor(0x1D, 0x4E, 0xD8)
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


def note(t):
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(2)
    rich(p, t, size=8, italic=True, color=XAM)


def tbl(header, rows, ws, tick=True, hdr="EEEEEE"):
    table = doc.add_table(rows=1, cols=len(ws)); table.style = "Table Grid"
    for i, t in enumerate(header):
        c = table.rows[0].cells[i]; shade(c, hdr)
        run(c.paragraphs[0], t, size=8, bold=True)
    trPr = table.rows[0]._tr.get_or_add_trPr(); trPr.append(OxmlElement("w:tblHeader"))
    for r in rows:
        cells = table.add_row().cells
        table.rows[-1].height = Cm(0.5); table.rows[-1].height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
        for i, v in enumerate(r):
            p = cells[i].paragraphs[0]; p.paragraph_format.space_after = Pt(0)
            rich(p, str(v), size=8.3, bold=(i == 0))
        if tick: shade(cells[len(r) - 1], "FFFDF2")
    table.autofit = False
    for row in table.rows:
        for i, w in enumerate(ws): row.cells[i].width = w
    return table


# ------------- TIÊU ĐỀ -------------
p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(2)
run(p, "CÂU HỎI ĐÃ ĐỦ ĐỂ PHÁT TRIỂN MODULE KẾ HOẠCH SẢN XUẤT CHƯA?", size=14, bold=True)
p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(6)
run(p, "Đối chiếu 153 câu hỏi (V123) với những gì module cần · các quyết định NHÀ MÁY KHÔNG THỂ trả lời (chủ doanh nghiệp quyết) · "
       "phụ lục 12 câu hỏi còn thiếu. Tài liệu nội bộ, không gửi nhà máy.", size=8, italic=True, color=XAM)

head("1. KẾT LUẬN NGẮN")
rich(doc.add_paragraph(), "Câu trả lời: <b>Đủ cho phần NGHIỆP VỤ</b> (nhà máy xác nhận), nhưng <b>chưa đủ nếu chỉ có vậy</b>. "
     "Còn đúng 3 nhóm việc phải xử lý trước khi lập trình:", size=9.5)
for t in ["① <b>Nhóm A</b> trong bảng dưới — 14 nhóm câu hỏi đã phủ hết các sự thật nghiệp vụ cần cho dữ liệu và thuật toán: "
          "quy tắc chuyển công đoạn · thời lượng · năng lực · gom lô · ưu tiên · cách cập nhật. Không cần hỏi thêm gì về mặt này.",
          "② <b>Nhóm B</b> — 11 quyết định <b>sản phẩm/kỹ thuật</b> mà nhà máy KHÔNG trả lời được (dùng màn hình nào, tính tải theo gì, "
          "có đăng nhập chưa, có lưu lịch sử sửa đổi không…). Cái này <b>bạn quyết</b>; mình đã ghi sẵn đề xuất cho từng cái.",
          "③ <b>Nhóm C</b> — 12 câu hỏi còn <b>lỗ hổng</b> (ai xác nhận hoàn thành, có khóa kế hoạch đã chốt không, có cần thông báo…). "
          "Đã soạn sẵn ở mục 4 để bạn bổ sung vào phiếu khi đi hỏi."]:
    p = doc.add_paragraph(style="List Bullet"); p.paragraph_format.space_after = Pt(2)
    rich(p, t, size=9)

head("2. ĐỐI CHIẾU: CÂU HỎI → QUYẾT ĐỊNH THIẾT KẾ → DÙNG VÀO ĐÂU TRONG APP")
tbl(["Nhóm câu hỏi", "Chốt được gì", "Dùng vào đâu trong app", "Chưa trả lời thì dùng mặc định"], [
 ("A1 · CH5 · F7", "Quy tắc “đầy đủ đơn”: đủ 3 phần của bộ hay đủ cả đơn; có cho đẩy lệch không",
  "Bảng quy tắc chuyển công đoạn + logic chặn và <b>lý do đang chờ</b> trên màn kế hoạch",
  "Cho đẩy <b>từng bộ</b> khi bộ đã đủ 3 phần"),
 ("A2 · D1 · KH9", "Đơn vị thời gian (giờ/ngày làm việc), làm T7-CN?, ca làm việc",
  "Hàm quy đổi ngày làm việc ↔ ngày lịch; cột ngày bắt đầu/kết thúc dự kiến",
  "Ngày làm việc, T2–T6, nghỉ chủ nhật"),
 ("A3 · EP1–EP7 · LK* · KHO2", "Thời lượng Ép cánh, Lắp kính + phụ kiện, Vệ sinh + Đóng gói, Mài mối hàn",
  "Danh mục công đoạn (cột thời lượng) → dùng để tính ngày xong dự kiến",
  "Ép cánh 1 ngày · Lắp kính+PK 1 ngày · Mài 0,5 ngày · Đóng gói 1 ngày"),
 ("A4 · E1–E7", "Năng lực từng tổ (người, bộ/tuần), máy & khuôn, nút thắt thật",
  "Bảng năng lực tổ → <b>cảnh báo quá tải</b> khi tải tuần vượt năng lực",
  "Để trống → app vẫn lập kế hoạch nhưng <b>không cảnh báo quá tải</b>"),
 ("A5 · BL1–BL9", "Bồi Lares = nạp chương trình máy cắt: theo model hay theo bộ, thời gian mới/đã có, có chặn Cắt",
  "Bảng chương trình máy cắt (tên file, phiên bản, máy) · loại công đoạn CHUẨN BỊ · ràng buộc bắt buộc trước Cắt",
  "Theo <b>model</b>, tái sử dụng, ≈ 0 nếu đã có, có chặn Cắt"),
 ("A6 · KH1–KH4", "Cách lên kế hoạch hiện nay + căn cứ ưu tiên",
  "<b>Màn hình chính</b> của module + thuật toán sắp xếp thứ tự",
  "Màn hình kế hoạch theo <b>tuần</b>; ưu tiên hạn giao gần nhất (EDD)"),
 ("B1–B8", "Đơn vị kế hoạch = 1 bộ cửa · đơn nào vào kế hoạch · <b>điều kiện đủ để vào sản xuất</b> · mốc hạn giao",
  "Bảng công việc (1 dòng = 1 bộ) · bộ lọc đơn · <b>cảnh báo vàng</b> khi bộ chưa đủ điều kiện",
  "Sản xuất + Đã xác nhận; đủ điều kiện = đã xác nhận + có Bộ số + có hạn giao"),
 ("C1–C10", "Danh mục công đoạn đầy đủ · công đoạn nào song song · điểm ghép bộ · QC · thuê ngoài · dòng sản phẩm khác",
  "Danh mục công đoạn (thứ tự, phạm vi khung/cánh/phào, loại gia công/chuẩn bị) · luồng làm lại · định tuyến theo loại sản phẩm",
  "Thêm 2 công đoạn còn thiếu (mài ba via, lắp kính+PK); 1 chuỗi công đoạn chung"),
 ("D2–D9", "Định mức thời gian từng công đoạn + thời gian chờ (sau sơn, sau vân, sau Bồi Lares)",
  "Tính ngày kết thúc dự kiến · <b>chặn xếp sát</b> khi hàng chưa khô · cột thời gian chờ",
  "Theo bảng gốc (cắt 1 · chấn 1 · hàn 2 · sơn 2 · vân 2) + chờ 1 ngày"),
 ("F1–F12", "Ưu tiên · chen gấp · quy tắc gom lô (màu sơn, mã vân, model nhôm) · ngoại lệ thiếu hàng · mùa cao điểm",
  "Thuật toán xếp lịch + <b>gợi ý/cảnh báo gom lô</b> + danh mục lý do trễ",
  "EDD · không giới hạn lô, chỉ gợi ý gom · lý do trễ có danh mục"),
 ("G1–G10", "Ai cập nhật ở đâu, mức nào · phiếu lệnh SX cần in gì · màn hình ngày · cảnh báo · báo cáo",
  "Màn hình cập nhật tiến độ · <b>mẫu in phiếu lệnh sản xuất</b> · bảng cảnh báo · báo cáo tuần",
  "1 người nhập, mức BỘ, in phiếu lệnh theo tổ, cảnh báo quá tải/trễ hạn"),
 ("H", "Danh sách trường dữ liệu cần thêm (17 trường)",
  "Chính là nội dung <b>file migration</b> tạo bảng mới",
  "Làm hết 17 trường ở mức cơ bản"),
 ("I", "Trường app đang có, xưởng có dùng không",
  "Giữ/bỏ trường trên phiếu lệnh SX + màn hình xưởng (đỡ rối)",
  "Giữ nguyên, hiện tất cả trên phiếu lệnh"),
 ("J", "Giá trị mặc định cho mọi thứ chưa trả lời",
  "Cấu hình trong app (sửa được, không cần lập trình lại)",
  "—"),
], [Cm(3.0), Cm(4.7), Cm(5.6), Cm(4.5)])

doc.add_page_break()
head("3. NHÓM B — 11 QUYẾT ĐỊNH NHÀ MÁY KHÔNG TRẢ LỜI ĐƯỢC (bạn quyết)")
note("Đây là lựa chọn <b>sản phẩm/kỹ thuật</b>, hỏi nhà máy cũng không có câu trả lời đúng. Bảng ghi rõ ảnh hưởng và đề xuất của mình.")
tbl(["#", "Quyết định", "Ảnh hưởng", "Đề xuất của mình", "Bạn chọn"], [
 ("B1", "Đợt 1 làm tới đâu: chỉ <b>trạng thái từng BỘ</b>, hay theo dõi <b>từng công đoạn</b> của từng bộ?",
  "Khối lượng lập trình và khối lượng nhập liệu hằng ngày", "Đợt 1 = trạng thái <b>bộ</b> + tổ + ngày; đợt 2 mở chi tiết công đoạn", ""),
 ("B2", "Màn hình chính: bảng <b>kéo–thả</b> hay bảng <b>danh sách</b> theo ngày/tổ?",
  "Kéo–thả đẹp nhưng tốn thời gian làm và dễ lỗi trên điện thoại", "<b>Bảng danh sách</b> theo ngày/tổ + nút đổi ngày; kéo–thả để đợt 2", ""),
 ("B3", "Tính tải theo <b>số bộ/tuần</b> hay theo <b>giờ công</b>?",
  "Giờ công chính xác hơn nhưng cần định mức giờ từng công đoạn (nhà máy chưa có)", "Theo <b>số bộ/tuần</b> trước; nâng lên giờ công khi có định mức", ""),
 ("B4", "Gom lô: app <b>tự xếp</b> theo lô màu/mã vân, hay chỉ <b>gợi ý + cảnh báo</b>?",
  "Tự xếp có thể ra kế hoạch máy không hiểu; tự xếp sai thì mất niềm tin", "<b>Gợi ý + cảnh báo</b> trước, người lên kế hoạch vẫn là người quyết", ""),
 ("B5", "Đăng nhập &amp; phân quyền: làm ngay hay dùng chung 1 tài khoản?",
  "<b>Hiện app chưa có đăng nhập</b> — ai có link cũng sửa được kế hoạch", "1 tài khoản quản trị chung cho đợt 1; làm đăng nhập ngay sau (vì kế hoạch sẽ do nhiều người xem)", ""),
 ("B6", "Có lưu <b>lịch sử sửa đổi</b> kế hoạch (ai đổi gì, lúc nào) không?",
  "Khi có tranh cãi “ai đổi lịch” thì không có bằng chứng", "<b>Có</b> — ghi log đơn giản ngay đợt 1, chi phí thấp", ""),
 ("B7", "Có nhập <b>các đơn đang sản xuất dở</b> vào app lúc bắt đầu không?",
  "Không nhập thì tuần đầu kế hoạch sẽ thiếu hàng thật đang làm", "<b>Có</b> — nhập danh sách đơn đang mở", ""),
 ("B8", "Kế hoạch <b>đã chốt</b> có bị khóa không?",
  "Khóa thì cứng nhắc; không khóa thì kế hoạch bị sửa liên tục", "Không khóa, nhưng <b>cảnh báo “đã chốt”</b> + ghi log khi sửa", ""),
 ("B9", "Có cần app dùng trên <b>điện thoại</b> (xem và cập nhật nhanh) không?",
  "Nếu xưởng nhập bằng điện thoại thì giao diện phải khác máy tính", "Có — tối thiểu xem kế hoạch + cập nhật 1 chạm", ""),
 ("B10", "Phiếu lệnh sản xuất in ra có cần <b>mã vạch/QR</b> không?",
  "Có QR thì sau này quét bằng điện thoại; in QR cần thêm bước", "Chưa cần — in chữ + <b>mã bộ cỡ lớn</b> để đọc nhanh", ""),
 ("B11", "Đo <b>thành công của module</b> sau 1 tháng bằng gì?",
  "Không đo thì không biết module có ích hay không", "% bộ trễ hạn · số bộ ra/tuần · thời gian chờ đủ đơn · số lần máy chờ chương trình", ""),
], [Cm(0.9), Cm(4.6), Cm(4.2), Cm(5.3), Cm(2.8)])

head("4. NHÓM C — 12 CÂU HỎI CÒN LỖ HỔNG (bổ sung khi đi hỏi)")
note("Đây là những chỗ mình rà lại thấy <b>phiếu V123 chưa hỏi</b> nhưng module sẽ cần. Bạn có thể hỏi kèm luôn.")
tbl(["#", "Câu hỏi bổ sung", "Vì sao cần", "Trả lời"], [
 ("P1", "Ai có quyền <b>sửa/xóa</b> kế hoạch đã chốt? Có cần lưu lại ai đổi gì không?", "phân quyền + lịch sử sửa đổi", ""),
 ("P2", "Khi một bộ <b>hoàn thành</b>, ai là người xác nhận — tổ trưởng hay quản đốc? Xác nhận ở đâu?", "mốc dữ liệu “hoàn thành” phải do 1 người chịu trách nhiệm", ""),
 ("P3", "Có cần <b>xem lại kế hoạch các tuần trước</b> để đối chiếu làm được hay không không?", "lưu lịch sử kế hoạch để đánh giá năng lực", ""),
 ("P4", "Kế hoạch tuần được <b>chốt vào ngày nào</b> (ví dụ chiều thứ 6 cho tuần sau)? Ai chốt?", "thời điểm chốt quyết định luồng làm việc của app", ""),
 ("P5", "Hiện có bao nhiêu <b>đơn/bộ đang sản xuất dở</b>? Danh sách đó lấy ở đâu?", "cần nhập vào app lúc bắt đầu để kế hoạch đúng", ""),
 ("P6", "Có cần theo dõi <b>% tiến độ</b> từng bộ, hay chỉ cần <b>trạng thái</b> (chờ/đang/hoàn thành/đã giao)?", "chọn % là phải nhập số liệu liên tục, dễ bỏ", ""),
 ("P7", "Mỗi tổ có cần <b>xem kế hoạch của tổ khác</b> không (để chủ động chuẩn bị)?", "quyết định nội dung màn hình xưởng + phân quyền", ""),
 ("P8", "Khi một bộ bị <b>tạm dừng</b> (chờ vật tư, khách đổi, lỗi), có cần trạng thái riêng + lý do không?", "trạng thái tạm dừng + danh mục lý do", ""),
 ("P9", "Nếu hàng trễ hạn, app có cần <b>tự đề xuất lại lịch</b> không, hay chỉ báo đỏ để người xử lý?", "mức độ “tự động” của module", ""),
 ("P10", "Có cần <b>thông báo</b> (chuông trong app / Zalo) khi bộ sắp trễ hoặc có việc mới không? Ai nhận?", "cảnh báo chỉ có giá trị nếu đến đúng người", ""),
 ("P11", "Báo cáo nên tính theo <b>bộ · m² · hay giá trị</b>?", "đơn vị báo cáo — ảnh hưởng cách nhập KH/Lượng", ""),
 ("P12", "Có cần <b>in kế hoạch ra giấy dán ở xưởng</b> (theo bảng công đoạn giấy hiện nay) không?", "mẫu in thứ ba, thay bảng giấy đang dùng", ""),
], [Cm(0.9), Cm(6.6), Cm(5.5), Cm(4.8)])

head("5. TÓM LẠI — VIỆC CẦN LÀM TRƯỚC KHI LẬP TRÌNH")
for i, t in enumerate([
 "Bạn chọn phương án cho <b>11 quyết định ở mục 3</b> (đọc cột “Đề xuất của mình” — nếu không phản hồi mình dùng đúng đề xuất đó).",
 "Bổ sung <b>12 câu ở mục 4</b> vào phiếu khi đi hỏi nhà máy (P1, P2, P4 là quan trọng nhất).",
 "Nhà máy trả lời <b>6 câu chặn (Phần A của V122)</b>: quy tắc đủ đơn · đơn vị thời gian · thời gian ép cánh/lắp kính · năng lực tổ/tuần · Bồi Lares theo model hay bộ · ai lên kế hoạch + xin mẫu.",
 "Có 3 con số là <b>bắt buộc phải có</b>, không dùng mặc định được: <b>năng lực mỗi tổ (bộ/tuần)</b>, <b>đơn vị thời gian</b>, và <b>quy tắc đủ đơn</b>. "
 "Thiếu 3 con số này thì module vẫn lập được kế hoạch nhưng <b>không cảnh báo được</b> — giá trị giảm một nửa.",
], 1):
    p = doc.add_paragraph(style="List Number"); p.paragraph_format.space_after = Pt(3)
    rich(p, t, size=9)

p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(10)
run(p, "GOLDMAX · Tài liệu nội bộ V124 — đối chiếu câu hỏi ↔ thiết kế module Lên kế hoạch sản xuất. "
       "Dùng kèm: V122 (bộ câu hỏi theo quyết định) · V123 (bản đầy đủ theo tổ & công đoạn).", size=7.5, italic=True, color=XAM)

out = "/home/user/.workspace/artifacts/doi-chieu-cau-hoi-va-thiet-ke-v124.docx"
doc.save(out)
print("đã tạo:", out)
