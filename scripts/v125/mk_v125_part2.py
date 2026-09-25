
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
