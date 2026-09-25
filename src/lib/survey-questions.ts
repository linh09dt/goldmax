// Danh mục câu hỏi khảo sát — sinh tự động từ dp/scripts/v125 (bộ câu hỏi V125).
// Muốn sửa câu hỏi: sửa file này trực tiếp (app đọc từ đây).

export type SurveyItemKind = "text" | "choice";
export type SurveyItem = {
  code: string;
  text: string;
  why?: string;
  level?: "P1" | "P2";
  kind: SurveyItemKind;
  options?: string[];
  hint?: string;
  note?: boolean;
};
export type SurveyGroup = { title: string; items: SurveyItem[] };
export type SurveySection = { id: string; title: string; team: string; groups: SurveyGroup[] };

export const SURVEY_SECTIONS: SurveySection[] = [
  {
    id: "A", title: "7 CÂU CHẶN — trả lời được là bắt đầu lập trình được", team: "Quản đốc",
    groups: [
      { title: "7 CÂU CHẶN — trả lời được là bắt đầu lập trình được", items: [
        { code: "A1", text: "Quy tắc “cần đầy đủ đơn để đẩy công đoạn kế tiếp”: đủ 3 phần của 1 bộ (khung+cánh+phào) hay đủ tất cả các bộ trong đơn hàng?", why: "chi tiết ở CH5 · F7", level: "P1", kind: "text" },
        { code: "A2", text: "Đơn vị thời gian trong bảng công đoạn là giờ hay ngày làm việc? Có làm thứ 7 / chủ nhật không? Ngày lễ tính thế nào?", why: "chi tiết ở trả lời ngay ở đây", level: "P1", kind: "text" },
        { code: "A3", text: "Ép cánh mất bao lâu? Lắp kính + phụ kiện có phải công đoạn không, do ai làm, mất bao lâu?", why: "chi tiết ở EP3 · LK1 · LK4", level: "P1", kind: "text" },
        { code: "A4", text: "Mỗi tổ bao nhiêu người và một tuần làm được bao nhiêu bộ (số thực tế, không phải lý thuyết)?", why: "chi tiết ở E1", level: "P1", kind: "text" },
        { code: "A5", text: "Chương trình Bồi Lares làm theo model nhôm hay theo từng bộ? Chương trình đã có thì nạp lại mất bao lâu?", why: "chi tiết ở BL1 · BL3", level: "P1", kind: "text" },
        { code: "A6", text: "Hiện nay ai lên kế hoạch, bao lâu một lần, làm bằng gì? Xin 1 bản mẫu kế hoạch.", why: "chi tiết ở KH1 · KH2", level: "P1", kind: "text" },
        { code: "A7", text: "Khi xếp lịch, ưu tiên theo hạn giao / đơn đến trước / khách giục / vật tư đã có?", why: "chi tiết ở F2", level: "P1", kind: "text" },
      ] },
    ],
  },
  {
    id: "B", title: "PHẠM VI & ĐIỀU KIỆN VÀO KẾ HOẠCH", team: "Quản đốc",
    groups: [
      { title: "PHẠM VI & ĐIỀU KIỆN VÀO KẾ HOẠCH", items: [
        { code: "B1", text: "Đơn vị lên kế hoạch là 1 bộ cửa (theo Bộ số) — đúng chứ? Có trường hợp nửa bộ / lẻ bộ không?", why: "khóa chính của bảng kế hoạch", level: "P1", kind: "text" },
        { code: "B2", text: "Đơn nào được đưa vào kế hoạch: chỉ Sản xuất + Đã xác nhận, hay cả đơn làm lại / đơn hàng mẫu?", why: "bộ lọc đầu vào — chi tiết ở KH17 · KH18", level: "P1", kind: "text" },
        { code: "B3", text: "Một bộ được coi là đủ điều kiện vào sản xuất khi nào (bản vẽ đã duyệt · chương trình đã có · nhôm/màu đã có · khách đã xác nhận)?", why: "tránh xếp lịch ảo rồi máy phải chờ", level: "P1", kind: "text" },
        { code: "B4", text: "Hiện có mẫu “đề nghị sản xuất” / “lệnh sản xuất” không? Ai phát lệnh cho xưởng? Gồm những nội dung gì? Xin 1 bản mẫu.", why: "app sẽ in phiếu lệnh theo mẫu này", level: "P1", kind: "text" },
        { code: "B5", text: "Bộ số do ai đánh, lúc nào? Trước khi vào kế hoạch đã có Bộ số chưa? Trùng số thì xử lý sao?", why: "Bộ số là định danh khi xếp lịch", level: "P2", kind: "text" },
        { code: "B6", text: "“Hạn giao” ghi trên đơn là ngày xưởng làm xong hay ngày giao tới khách?", why: "mốc mà kế hoạch phải nhắm tới", level: "P1", kind: "text" },
        { code: "B7", text: "Có được giao từng phần (giao trước vài bộ) không?", why: "chia nhỏ kế hoạch giao hàng", level: "P2", kind: "text" },
        { code: "B8", text: "Có cần nhập các đơn đang sản xuất dở vào app lúc bắt đầu không? Hiện có bao nhiêu đơn/bộ đang dở?", why: "không nhập thì tuần đầu kế hoạch thiếu hàng thật", level: "P1", kind: "text" },
      ] },
    ],
  },
  {
    id: "C", title: "TỔ MÁY — Thiết kế · Bồi Lares · Cắt · Chấn", team: "Tổ máy + Kỹ thuật",
    groups: [
      { title: "C.1. Công đoạn THIẾT KẾ", items: [
        { code: "TK1", text: "① 1 bộ cửa cần những bản vẽ gì (cắt nhôm, cánh/panel, kính, lắp ráp)? Có bản vẽ khung bao / ô thoáng riêng không?", why: "app cần biết phải lưu/ in gì theo bộ", level: "P1", kind: "text" },
        { code: "TK2", text: "② Một bộ (hoặc một model) thiết kế mất bao lâu? Có phụ thuộc loại cửa / kích thước không?", why: "định mức thời gian của bước chuẩn bị", level: "P1", kind: "text" },
        { code: "TK3", text: "③ Ai làm, mấy người? Dùng phần mềm gì? Làm ở văn phòng hay tại xưởng?", why: "đây là nguồn lực riêng, không cộng vào năng lực tổ thợ", level: "P1", kind: "text" },
        { code: "TK4", text: "④ Model/mã hàng đã từng làm thì có dùng lại bản vẽ cũ không? Khách đổi thì sửa mất bao lâu?", why: "nếu tái sử dụng được thì thời lượng = 0 với mã quen", level: "P1", kind: "text" },
        { code: "TK5", text: "⑤ Thiết kế cần những thông tin gì từ đơn (cao/rộng · khung bao · thông thủy · số cánh · ô thoáng · màu · loại kính · hướng mở)? App đang có đủ chưa, còn thiếu gì?", why: "đây là danh sách trường app phải bổ sung/bắt buộc", level: "P1", kind: "text" },
        { code: "TK6", text: "⑥ Ai duyệt bản vẽ? Khách có phải duyệt trước khi sản xuất không? Duyệt xong mới được cắt đúng không?", why: "mốc “đủ điều kiện vào sản xuất”", level: "P1", kind: "text" },
        { code: "TK7", text: "⑦ Có cần lưu bản vẽ lên app theo từng bộ để tổ xem tại xưởng không?", why: "thay việc gửi Zalo thủ công", level: "P2", kind: "text" },
      ] },
      { title: "C.2. Công đoạn BỒI LARES — nạp chương trình cho MÁY CẮT CHUYÊN DỤNG (hậu thiết kế)", items: [
        { code: "BL1", text: "① Chương trình làm theo MODEL NHÔM hay theo TỪNG BỘ / kích thước? Một chương trình dùng lại được cho các đơn sau không?", why: "nếu theo model thì 1 chương trình dùng cho nhiều bộ — tải tính theo model", level: "P1", kind: "text" },
        { code: "BL2", text: "③ Ai làm chương trình (kỹ thuật / văn phòng hay tại máy cắt)? Mấy người? Dùng phần mềm gì?", why: "xác định đây là nguồn lực riêng (nhóm KỸ THUẬT/CAM)", level: "P1", kind: "text" },
        { code: "BL3", text: "② Chương trình MỚI (model chưa từng làm) mất bao lâu? Chương trình ĐÃ CÓ thì nạp lại/sửa mất bao lâu?", why: "hai con số khác nhau — app cần cả hai để tính tải", level: "P1", kind: "text" },
        { code: "BL4", text: "⑤ Chưa có chương trình thì máy cắt có chạy được không? Đã bao giờ máy cắt đứng chờ chương trình chưa?", why: "đây là ràng buộc bắt buộc (prerequisite) của công đoạn Cắt", level: "P1", kind: "text" },
        { code: "BL5", text: "① Một chương trình gồm những phần nào (khung / cánh / phào)? Là 1 file cho cả bộ hay mỗi phần 1 file?", why: "biết đơn vị theo dõi: theo bộ hay theo bộ phận", level: "P2", kind: "text" },
        { code: "BL6", text: "④ Chương trình lưu ở đâu (phần mềm máy / máy tính / USB)? Đặt tên theo gì? Khách đổi thì tạo phiên bản mới thế nào?", why: "để dựng thư viện chương trình theo model trong app", level: "P2", kind: "text" },
        { code: "BL7", text: "③ Xưởng có mấy máy cắt chuyên dụng? Model máy gì, đọc định dạng file nào, có phải chuyển file bằng tay (USB) không?", why: "năng lực cắt thật + chương trình phải khớp máy", level: "P2", kind: "text" },
        { code: "BL8", text: "⑥ Có chạy thử / cắt mẫu 1 bộ trước khi cắt hàng loạt không? Mất bao lâu? Có phải kiểm mẫu rồi mới chạy tiếp không?", why: "nếu có thì thêm một bước và một khoản thời gian trước khi cắt", level: "P2", kind: "text" },
        { code: "BL9", text: "⑤ Khách đổi kích thước/mẫu giữa lúc đang làm thì sửa chương trình mất bao lâu? Có phải cắt lại từ đầu không?", why: "thời gian phát sinh khi đơn thay đổi giữa chừng", level: "P1", kind: "text" },
      ] },
      { title: "C.3. Công đoạn CẮT", items: [
        { code: "C1", text: "③ Cắt bằng máy gì (máy chuyên dụng / CNC / cắt tay)? Mấy máy, mấy người đứng máy?", why: "năng lực thật của công đoạn cắt", level: "P1", kind: "text" },
        { code: "C2", text: "① Cắt cho những phần nào: khung · cánh · phào? Là 3 việc làm song song hay 1 người làm lần lượt?", why: "3 luồng song song — ảnh hưởng cách xếp tải", level: "P1", kind: "text" },
        { code: "C3", text: "② Thời gian cắt tính theo gì: số bộ · số mét dài nhôm · số thanh? Một bộ mất bao lâu?", why: "công thức định mức thời gian", level: "P1", kind: "text" },
        { code: "C4", text: "④ Đổi sang model nhôm khác mất bao lâu (đổi dao, cài đặt, lấy nhôm)? Có gom các bộ cùng model để cắt chung không?", why: "thời gian setup — quyết định có nên gom lô cắt", level: "P1", kind: "text" },
        { code: "C5", text: "⑤ Nhôm có sẵn kho theo model hay phải đặt theo đơn? Chờ bao lâu? App có cần cảnh báo “thiếu nhôm” trước khi xếp lịch?", why: "nếu chờ lâu thì kế hoạch phải chừa thời gian vật tư", level: "P1", kind: "text" },
        { code: "C6", text: "⑤ Cắt có phải chờ chương trình Bồi Lares không? Thường chờ bao lâu?", why: "đo mức độ rủi ro của ràng buộc bắt buộc", level: "P1", kind: "text" },
        { code: "C7", text: "⑥ Sau cắt có kiểm tra kích thước / số lượng không? Ai kiểm? Cắt sai/hụt xử lý thế nào, mất bao lâu?", why: "điểm QC + xử lý lỗi", level: "P2", kind: "text" },
        { code: "C8", text: "③② Một ngày cắt được bao nhiêu bộ? Nhôm cắt xong để chờ chấn được bao lâu, có giới hạn chỗ không?", why: "năng lực + giới hạn hàng chờ", level: "P1", kind: "text" },
      ] },
      { title: "C.4. Công đoạn CHẤN", items: [
        { code: "CH1", text: "③ Có mấy máy chấn? Cần khuôn riêng theo model nhôm không? Hiện có mấy khuôn?", why: "nút thắt theo khuôn, không chỉ theo người", level: "P1", kind: "text" },
        { code: "CH2", text: "① Chấn khung / cánh / phào trên cùng 1 máy hay máy khác nhau? Có bị tranh máy giữa 3 luồng không?", why: "tranh chấp máy giữa 3 luồng khung/cánh/phào", level: "P1", kind: "text" },
        { code: "CH3", text: "② Một bộ chấn mất bao lâu? Có phụ thuộc kích thước cửa / độ dài thanh không?", why: "định mức thời gian", level: "P1", kind: "text" },
        { code: "CH4", text: "④ Đổi khuôn / đổi model mất bao lâu? Có gom lô theo model để đỡ đổi khuôn không? Tối thiểu bao nhiêu bộ 1 lượt?", why: "thời gian setup + quy tắc gom lô", level: "P1", kind: "text" },
        { code: "CH5", text: "⑤ Ghi chú trong bảng: “cần đầy đủ đơn để đẩy công đoạn kế tiếp” — nghĩa là đủ 3 phần của 1 bộ (khung+cánh+phào), hay đủ tất cả các bộ trong đơn?", why: "quyết định app cho đẩy từng bộ hay bắt buộc theo đơn — câu chặn quan trọng nhất", level: "P1", kind: "text" },
        { code: "CH6", text: "⑥ Sau chấn có kiểm tra góc / kích thước không? Ai kiểm? Chấn lỗi (méo, lệch góc) sửa được không hay phải cắt lại?", why: "điểm QC + xử lý lỗi", level: "P2", kind: "text" },
        { code: "CH7", text: "③② Một ngày chấn được bao nhiêu bộ? Hàng đã chấn để chờ hàn ở đâu, được bao lâu?", why: "năng lực + chỗ để hàng chờ", level: "P1", kind: "text" },
      ] },
      { title: "C.5. TỔ MÁY — câu hỏi chung", items: [
        { code: "TM1", text: "③ Tổ máy bao nhiêu người? Chia thế nào cho 4 việc: thiết kế · Bồi Lares · cắt · chấn?", why: "năng lực theo người", level: "P1", kind: "text" },
        { code: "TM2", text: "③ Làm mấy ca? Giờ bắt đầu – kết thúc? Nghỉ trưa bao lâu?", why: "quy đổi ngày công ra giờ làm việc", level: "P1", kind: "text" },
        { code: "TM3", text: "② Một ngày tổ máy ra được bao nhiêu bộ “sạch” (đã chấn xong, sẵn sàng chuyển hàn)?", why: "đầu ra của tổ để tính tải", level: "P1", kind: "text" },
        { code: "TM4", text: "⑥ Máy nào hay hỏng / phải bảo trì? Bao lâu bảo trì 1 lần, mất bao lâu?", why: "app phải chừa thời gian dừng máy, không xếp kín", level: "P2", kind: "text" },
        { code: "TM5", text: "⑤ Việc nào ở tổ máy hay bị kẹt nhất: chờ nhôm · chờ chương trình · chờ thiết kế · chờ máy?", why: "nguyên nhân trễ để app cảnh báo đúng chỗ", level: "P1", kind: "text" },
        { code: "TM6", text: "⑦ Tổ máy cập nhật tiến độ ở đâu? Ai cập nhật (tổ trưởng hay văn phòng)?", why: "quyết định giao diện nhập liệu", level: "P1", kind: "text" },
      ] },
    ],
  },
  {
    id: "D", title: "TỔ HÀN — Hàn · Ép cánh · Test cơ khí", team: "Tổ hàn",
    groups: [
      { title: "D.1. Công đoạn HÀN", items: [
        { code: "HAN1", text: "③ Hàn bằng máy gì, mấy máy, mấy người?", why: "năng lực", level: "P1", kind: "text" },
        { code: "HAN2", text: "① Hàn những phần nào: khung · cánh · phào? 3 người làm song song hay 1 người tuần tự?", why: "3 luồng song song hay tuần tự", level: "P1", kind: "text" },
        { code: "HAN3", text: "② Một bộ hàn mất bao lâu? Tính theo số góc / mối hàn hay theo bộ?", why: "định mức thời gian", level: "P1", kind: "text" },
        { code: "HAN4", text: "④ Có phải gom lô theo model để đỡ đổi khuôn/gá không? Tối thiểu bao nhiêu bộ 1 lượt?", why: "quy tắc gom lô hàn", level: "P1", kind: "text" },
        { code: "HAN5", text: "⑤ Có phải chờ đủ 3 phần (khung, cánh, phào) mới hàn được không? Hàng chờ ở đâu, tối đa bao nhiêu bộ?", why: "điều kiện vào công đoạn + giới hạn hàng chờ", level: "P1", kind: "text" },
        { code: "HAN6", text: "⑥ Sau hàn có mài mối hàn / làm sạch ba via không? Ai làm, mất bao lâu? Có kiểm mối hàn không?", why: "bước hoàn thiện thường bị bỏ sót khi định mức", level: "P1", kind: "text" },
        { code: "HAN7", text: "⑥⑦ Mối hàn lỗi xử lý thế nào, mất bao lâu? Một ngày tổ hàn được bao nhiêu bộ?", why: "xử lý lỗi + năng lực", level: "P1", kind: "text" },
      ] },
      { title: "D.2. Công đoạn ÉP CÁNH  (bảng công đoạn đang để trống thời gian)", items: [
        { code: "EP1", text: "① Ép cánh là ép cái gì vào cánh (tấm cốt / panel nhôm / kính)? Làm cho loại cửa nào?", why: "xác định đúng công đoạn và phạm vi áp dụng", level: "P1", kind: "text" },
        { code: "EP2", text: "③ Có máy ép không, mấy cái? Mỗi lượt ép được bao nhiêu cánh?", why: "năng lực + gom lô ép", level: "P1", kind: "text" },
        { code: "EP3", text: "② Một bộ (hoặc 1 cánh) ép mất bao lâu? Có phải chờ keo khô không, bao lâu?", why: "định mức + thời gian chờ", level: "P1", kind: "text" },
        { code: "EP4", text: "⑤ Ép cánh nằm ở đâu trong chuỗi: trước hay sau khi hàn cánh? Trước hay sau Test cơ khí?", why: "thứ tự công đoạn trong kế hoạch", level: "P1", kind: "text" },
        { code: "EP5", text: "④⑤ Vật tư (keo, cốt) lấy từ kho hay đặt ngoài? Có bị thiếu làm dừng việc không?", why: "ảnh hưởng lead time và cảnh báo vật tư", level: "P2", kind: "text" },
        { code: "EP6", text: "⑥ Ép lỗi (bọt khí, lệch, bong) xử lý thế nào? Có phải làm lại từ đầu không? Mất bao lâu?", why: "làm lại — ảnh hưởng lớn tới lead time", level: "P2", kind: "text" },
        { code: "EP7", text: "②③ Một ngày ép được bao nhiêu bộ?", why: "năng lực", level: "P1", kind: "text" },
      ] },
      { title: "D.3. Công đoạn TEST CƠ KHÍ", items: [
        { code: "TC1", text: "① Test gồm những gì (đóng/mở, khe hở cánh, khoá, bản lề, gioăng, độ vuông, kín nước)?", why: "app có thể hiện checklist QC — cần biết nội dung", level: "P1", kind: "text" },
        { code: "TC2", text: "②③ Ai test, mất bao lâu 1 bộ? Test từng bộ hay chỉ test mẫu?", why: "thời lượng + tần suất", level: "P1", kind: "text" },
        { code: "TC3", text: "⑥⑦ Kết quả test ghi ở đâu (giấy/app)? Có cần lưu lịch sử theo bộ trong app không? Đạt thì có dán tem/đánh dấu không?", why: "app có cần form nhập kết quả QC", level: "P2", kind: "text" },
        { code: "TC4", text: "⑥ Tỷ lệ phải sửa sau test khoảng bao nhiêu %? Lỗi thường gặp là gì?", why: "để dự phòng thời gian làm lại trong kế hoạch", level: "P1", kind: "text" },
        { code: "TC5", text: "⑤⑥ Phát hiện lỗi ở test thì quay lại công đoạn nào (hàn? chấn? ép cánh?)? Việc làm lại có chen trước đơn thường không?", why: "xác định luồng quay lại khi làm lại", level: "P1", kind: "text" },
        { code: "TC6", text: "②③ Một ngày test được bao nhiêu bộ?", why: "năng lực", level: "P2", kind: "text" },
      ] },
      { title: "D.4. TỔ HÀN — câu hỏi chung", items: [
        { code: "TH1", text: "③ Tổ hàn bao nhiêu người, mấy ca, giờ làm?", why: "năng lực theo người/giờ", level: "P1", kind: "text" },
        { code: "TH2", text: "⑤ Hàng sau khi test cơ khí chờ sơn bao lâu? Chỗ để có giới hạn không (tối đa bao nhiêu bộ)?", why: "giới hạn hàng chờ trước sơn — thường là nút thắt", level: "P1", kind: "text" },
        { code: "TH3", text: "② Một ngày tổ hàn ra được bao nhiêu bộ hoàn chỉnh (đã test đạt)?", why: "năng lực thực tế", level: "P1", kind: "text" },
        { code: "TH4", text: "⑥ Máy hàn/máy ép hay hỏng không? Bảo trì bao lâu 1 lần?", why: "thời gian dừng máy", level: "P2", kind: "text" },
        { code: "TH5", text: "⑤ Tổ hàn có bị ảnh hưởng khi tổ máy giao thiếu hoặc không đúng model không? Có phải chờ không?", why: "rủi ro phụ thuộc giữa các tổ", level: "P1", kind: "text" },
      ] },
    ],
  },
  {
    id: "E", title: "TỔ SƠN — nút thắt theo bảng công đoạn — 2 đơn vị thời gian", team: "Tổ sơn",
    groups: [
      { title: "TỔ SƠN — nút thắt theo bảng công đoạn — 2 đơn vị thời gian", items: [
        { code: "SON1", text: "③ Công nghệ sơn gì (sơn tĩnh điện / sơn nước / phun dầu)? Có lò sấy/nung không? Mấy lò?", why: "công nghệ quyết định thời gian và cách gom lô", level: "P1", kind: "text" },
        { code: "SON2", text: "② Mỗi mẻ lò sơn được bao nhiêu bộ? Một mẻ mất bao lâu (tính cả sấy)?", why: "con số quan trọng nhất của module", level: "P1", kind: "text" },
        { code: "SON3", text: "③ Một ngày sơn được mấy mẻ? Tổ sơn mấy người?", why: "năng lực/ngày", level: "P1", kind: "text" },
        { code: "SON4", text: "① Sơn những phần nào (khung · cánh · phào)? Cả bộ sơn 1 lượt hay sơn riêng từng phần?", why: "phạm vi theo khung/cánh/phào", level: "P1", kind: "text" },
        { code: "SON5", text: "④ Danh sách màu đang dùng ở đâu (bảng mã RAL / theo mã hàng)? Màu do khách chọn hay sale chọn?", why: "app cần danh mục màu để gom lô", level: "P1", kind: "text" },
        { code: "SON6", text: "④ Đổi màu mất bao lâu (vệ sinh súng/buồng)? Có phải bắn màu nhạt trước màu đậm không?", why: "thời gian setup theo màu", level: "P1", kind: "text" },
        { code: "SON7", text: "④ Có phải gom lô theo màu không? Tối thiểu bao nhiêu bộ cho 1 lô màu?", why: "quy tắc gom lô sơn — ảnh hưởng trực tiếp lead time", level: "P1", kind: "text" },
        { code: "SON8", text: "④ Khách cần 1 bộ màu lạ / số lượng ít thì xử lý thế nào (vẫn sơn riêng, hay chờ ghép lô)?", why: "ngoại lệ của quy tắc gom lô", level: "P1", kind: "text" },
        { code: "SON9", text: "④ Gom đủ lô cả tuần mới sơn 1 lượt, hay sơn hằng ngày?", why: "tần suất sơn quyết định cách xếp kế hoạch", level: "P1", kind: "text" },
        { code: "SON10", text: "⑤ Hàng trước khi sơn cần gì (sạch, sấy, che chắn)? Chờ gì trước khi sơn?", why: "điều kiện vào công đoạn", level: "P2", kind: "text" },
        { code: "SON11", text: "⑤ Sau sơn bao lâu mới được vân? Bao lâu mới đóng gói được? Có sấy cưỡng bức không?", why: "thời gian chờ — chỗ kế hoạch hay bị trượt", level: "P1", kind: "text" },
        { code: "SON12", text: "⑥ Kiểm tra màu/bề mặt: ai duyệt, so với gì (mẫu khách / mã RAL)?", why: "điểm QC", level: "P2", kind: "text" },
        { code: "SON13", text: "⑥ Lỗi sơn (chảy, bụi, lệch màu) xử lý thế nào? Sơn lại mất bao lâu? Tỷ lệ lỗi khoảng bao nhiêu %?", why: "làm lại — ảnh hưởng lớn tới lead time", level: "P1", kind: "text" },
        { code: "SON14", text: "②③ Một tuần tổ sơn làm được tối đa bao nhiêu bộ?", why: "năng lực/tuần để cảnh báo quá tải", level: "P1", kind: "text" },
        { code: "SON15", text: "③ Lò/súng sơn có bảo trì định kỳ không? Bao lâu 1 lần, mất bao lâu?", why: "app phải chừa thời gian dừng", level: "P2", kind: "text" },
        { code: "SON16", text: "⑤ Có thuê ngoài khâu sơn không? Đơn vị nào, thời gian gửi/nhận bao lâu?", why: "nếu có thì ghi như một công đoạn riêng trong kế hoạch", level: "P2", kind: "text" },
        { code: "SON17", text: "⑤⑦ Hàng sơn xong để ở đâu, bao lâu, có giới hạn chỗ không? Ai cập nhật tiến độ sơn, ở đâu?", why: "giới hạn hàng chờ + cách ghi nhận", level: "P1", kind: "text" },
        { code: "SON18", text: "④ Màu/dung môi đặc biệt có phải đặt trước không? Đặt mất bao lâu?", why: "lead time vật tư sơn", level: "P2", kind: "text" },
        { code: "SON19", text: "⑥ Có phải sơn lại khi hàng đã vân mà bị lỗi không (bóc vân → sơn lại)? Mất bao lâu?", why: "làm lại nhiều bước — rất ảnh hưởng lead time", level: "P1", kind: "text" },
      ] },
    ],
  },
  {
    id: "F", title: "TỔ VÂN", team: "Tổ vân",
    groups: [
      { title: "TỔ VÂN", items: [
        { code: "VAN1", text: "③ Công nghệ vân là gì (dán film vân / ép nhiệt / in chuyển ấn nóng)? Có buồng sấy không?", why: "xác nhận công nghệ và thiết bị", level: "P1", kind: "text" },
        { code: "VAN2", text: "① Vân cho những phần nào (khung · cánh · phào)? Có khi nào 1 bộ dùng 2 mã vân khác nhau không?", why: "phạm vi + khả năng chia nhiều mã vân trong 1 bộ", level: "P1", kind: "text" },
        { code: "VAN3", text: "④ Mã vân lấy từ đâu (mẫu khách chọn / theo mã hàng / theo model)? Hiện có bao nhiêu mã vân? App có cần thêm trường “mã vân” trên đơn không?", why: "app cần trường mã vân để gom lô", level: "P1", kind: "text" },
        { code: "VAN4", text: "② Một bộ vân mất bao lâu? Tính theo mét dài / m² / số bộ?", why: "định mức thời gian", level: "P1", kind: "text" },
        { code: "VAN5", text: "③ Mấy máy vân, mấy người, một ngày được bao nhiêu bộ?", why: "năng lực", level: "P1", kind: "text" },
        { code: "VAN6", text: "④ Đổi mã vân mất bao lâu? Có phải gom lô theo mã vân không? Tối thiểu bao nhiêu bộ 1 lượt?", why: "thời gian setup + quy tắc gom lô vân", level: "P1", kind: "text" },
        { code: "VAN7", text: "⑤ Hàng trước khi vân phải khô/sạch thế nào? Có phải che kính khi vân không?", why: "điều kiện vào công đoạn", level: "P2", kind: "text" },
        { code: "VAN8", text: "⑤ Sau vân bao lâu mới lắp kính / đóng gói được? Có phải chờ nguội/khô không?", why: "thời gian chờ", level: "P1", kind: "text" },
        { code: "VAN9", text: "⑥ Ai kiểm màu/vân so với mẫu? Kiểm trước hay sau khi đóng gói?", why: "điểm QC cuối", level: "P2", kind: "text" },
        { code: "VAN10", text: "⑥ Vân lỗi (bong, lệch, xước) xử lý thế nào? Có phải bóc ra sơn lại không? Mất bao lâu?", why: "làm lại nhiều bước", level: "P1", kind: "text" },
        { code: "VAN11", text: "⑤⑦ Hàng vân xong để ở đâu, có giới hạn chỗ không? Ai cập nhật tiến độ vân?", why: "giới hạn hàng chờ + ghi nhận", level: "P2", kind: "text" },
        { code: "VAN12", text: "②③ Một tuần tổ vân làm được tối đa bao nhiêu bộ?", why: "năng lực/tuần", level: "P1", kind: "text" },
      ] },
    ],
  },
  {
    id: "G", title: "LẮP KÍNH + PHỤ KIỆN — công đoạn CHƯA có trong bảng công đoạn nhưng đơn hàng đang có", team: "Tổ lắp kính / Kho",
    groups: [
      { title: "LẮP KÍNH + PHỤ KIỆN — công đoạn CHƯA có trong bảng công đoạn nhưng đơn hàng đang có", items: [
        { code: "LK1", text: "① Có bước lắp kính + phụ kiện không? Do tổ nào làm (tổ vân / tổ hàn / tổ riêng / tổ kho)?", why: "xác nhận có/không và gán về tổ — nếu thiếu, kế hoạch sẽ tính sai", level: "P1", kind: "text" },
        { code: "LK2", text: "① Lắp kính gồm những việc gì (gioăng, silicon, nêm, nẹp, kính cường lực, kính dán 8.38)?", why: "nội dung công đoạn", level: "P1", kind: "text" },
        { code: "LK3", text: "① Lắp phụ kiện gồm những gì (khoá, bản lề, tay nắm, ray, bánh xe, chốt, phụ kiện ô thoáng)?", why: "nội dung công đoạn", level: "P1", kind: "text" },
        { code: "LK4", text: "② Một bộ lắp kính + phụ kiện mất bao lâu? Có phụ thuộc số cánh / kích thước / loại cửa không?", why: "định mức thời gian", level: "P1", kind: "text" },
        { code: "LK5", text: "⑤⑤ Vị trí trong chuỗi: sau Vân hay sau Sơn (nếu không vân)? Trước Vệ sinh + Đóng gói đúng không?", why: "vị trí trong chuỗi công đoạn", level: "P1", kind: "text" },
        { code: "LK6", text: "⑤ Kính tự cắt hay đặt ngoài? Thời gian chờ kính bao lâu? Có bao giờ chờ kính làm đứng cả bộ không?", why: "lead time vật tư — có thể làm trễ cả bộ", level: "P1", kind: "text" },
        { code: "LK7", text: "⑤ Thiếu kính / thiếu phụ kiện thì các bộ khác có được đẩy trước không, hay bộ đó đứng chờ?", why: "quy tắc đẩy từng bộ (ngoại lệ của “đủ đơn”)", level: "P1", kind: "text" },
        { code: "LK8", text: "⑥ Sau khi lắp có kiểm tra đóng/mở trơn, khoá khít, kín nước không? Ai kiểm?", why: "điểm QC trước đóng gói", level: "P2", kind: "text" },
        { code: "LK9", text: "①⑥ Có phải lắp thử toàn bộ bộ cửa rồi tháo ra để vận chuyển không? Mất thêm bao lâu?", why: "thời gian lắp/tháo 2 lần", level: "P2", kind: "text" },
        { code: "LK10", text: "③ Mấy người làm, một ngày lắp được bao nhiêu bộ?", why: "năng lực", level: "P1", kind: "text" },
        { code: "LK11", text: "⑦ App đang có đủ thông tin để mua/lắp phụ kiện chưa (mã khoá, số lượng phụ kiện, loại/dày kính)? Còn thiếu gì?", why: "đây là danh sách trường dữ liệu app cần bổ sung", level: "P1", kind: "text" },
        { code: "LK12", text: "⑦ Khi nhận đơn, xưởng có phải gọi sale hỏi lại thông tin gì không? Hỏi những gì, hay gặp nhất là gì?", why: "danh sách trường app cần thêm hoặc bắt buộc nhập", level: "P1", kind: "text" },
      ] },
    ],
  },
  {
    id: "H", title: "TỔ KHO — Vệ sinh · Đóng gói · Kho · Giao hàng · Lắp đặt", team: "Tổ kho",
    groups: [
      { title: "H.1. Công đoạn VỆ SINH + ĐÓNG GÓI", items: [
        { code: "KHO1", text: "① Vệ sinh + đóng gói gồm những gì (lai chùi, dán băng dính bảo vệ, bọc xốp/màng co, đóng thùng, chèn chống xước)?", why: "nội dung công đoạn", level: "P2", kind: "text" },
        { code: "KHO2", text: "② Một bộ mất bao lâu? Có phụ thuộc kích thước / số cánh không?", why: "định mức thời gian", level: "P1", kind: "text" },
        { code: "KHO3", text: "① Đóng gói theo bộ hay theo kiện (nhiều bộ 1 kiện)? Mỗi kiện mấy bộ?", why: "đơn vị đóng gói để lập kế hoạch giao", level: "P2", kind: "text" },
        { code: "KHO4", text: "⑦ Có dán nhãn/tem gì trên kiện không (mã đơn · bộ số · tên khách · số kiện)?", why: "app có thể in tem tự động thay vì ghi tay", level: "P2", kind: "text" },
        { code: "KHO5", text: "⑤ Sau khi đóng gói, bộ được coi là “hoàn thành sản xuất” đúng không?", why: "mốc dữ liệu Hoàn thành sản xuất", level: "P1", kind: "text" },
        { code: "KHO6", text: "③ Mấy người? Một ngày đóng gói được bao nhiêu bộ?", why: "năng lực", level: "P1", kind: "text" },
        { code: "KHO7", text: "⑤ Hàng đóng gói xong để ở đâu, được bao lâu? Có giới hạn chỗ không?", why: "giới hạn hàng chờ giao", level: "P2", kind: "text" },
        { code: "KHO8", text: "⑥ Có kiểm lại / lau lại lần cuối trước khi giao không, hay giao luôn?", why: "bước kiểm tra cuối", level: "P2", kind: "text" },
      ] },
      { title: "H.2. KHO, GIAO HÀNG & LẮP ĐẶT TẠI CÔNG TRÌNH", items: [
        { code: "GH1", text: "⑦ Ai ghi ngày giao thực tế? Ghi ở đâu (app / phiếu giao hàng giấy)?", why: "app chưa có trường này — cần để tính đúng hạn", level: "P1", kind: "text" },
        { code: "GH2", text: "⑤ “Hạn giao” trên đơn là ngày xưởng làm xong hay ngày giao tới khách?", why: "mốc mà kế hoạch phải nhắm tới", level: "P1", kind: "text" },
        { code: "GH3", text: "③ Xưởng có xe riêng không? Mấy chuyến/ngày? Mỗi chuyến bao nhiêu bộ?", why: "đội giao hàng cũng là nguồn lực phải xếp", level: "P1", kind: "text" },
        { code: "GH4", text: "④ Có gom chuyến theo khu vực / đại lý không? App đang có Khu vực và Số km — có dùng để gom chuyến không?", why: "quy tắc gom chuyến giao", level: "P2", kind: "text" },
        { code: "GH5", text: "① Có giao từng phần cho khách không (giao trước vài bộ)?", why: "chia nhỏ kế hoạch giao hàng", level: "P2", kind: "text" },
        { code: "GH6", text: "①③ Có lắp đặt tại công trình không? Ai đi lắp, mất bao lâu 1 bộ? Có lấy ngày lắp làm mốc hoàn thành không?", why: "công việc ngoài xưởng nhưng vẫn phải nằm trong kế hoạch", level: "P1", kind: "text" },
        { code: "GH7", text: "⑥ Khách có ký nhận / ghi biên bản khi giao không?", why: "nguồn dữ liệu ngày giao thực tế đáng tin", level: "P2", kind: "text" },
        { code: "GH8", text: "⑥ Hàng sai/lỗi phát hiện tại công trình: quay lại xưởng hay sửa tại chỗ? Mất bao lâu?", why: "xử lý làm lại sau giao", level: "P1", kind: "text" },
        { code: "GH9", text: "⑤ Có trường hợp khách chưa lấy hàng, hàng để kho lâu không? Bao lâu thì coi là tồn?", why: "app cần cảnh báo hàng đã xong nhưng chưa giao", level: "P2", kind: "text" },
        { code: "GH10", text: "⑤ Giao hàng có phải chờ thanh toán không (thu tiền khi giao)?", why: "nếu có thì kế hoạch giao phụ thuộc kế toán", level: "P2", kind: "text" },
        { code: "GH11", text: "③ Một tuần giao được tối đa bao nhiêu bộ?", why: "năng lực giao hàng", level: "P1", kind: "text" },
        { code: "GH12", text: "⑥ Trễ hạn hiện nay thường do khâu giao hàng hay do sản xuất chưa xong?", why: "xác định đúng nút thắt của trễ hạn", level: "P1", kind: "text" },
      ] },
    ],
  },
  {
    id: "I", title: "CÁC VẤN ĐỀ XUYÊN SUỐT KHI LÊN KẾ HOẠCH — dành cho người lên kế hoạch / quản đốc", team: "Người lên kế hoạch",
    groups: [
      { title: "I.1. Cách lên kế hoạch hiện nay", items: [
        { code: "KH1", text: "Hiện nay ai lên kế hoạch sản xuất? Bao lâu lên 1 lần (hằng ngày / hằng tuần)?", why: "biết nghiệp vụ gốc và tần suất cập nhật", level: "P1", kind: "text" },
        { code: "KH2", text: "Kế hoạch đang làm bằng gì (giấy / bảng trắng / Excel / Zalo)? Xin 1 bản mẫu.", why: "app phải thay đúng thứ đang dùng", level: "P1", kind: "text" },
        { code: "KH3", text: "Kế hoạch hiện chia theo gì: theo tuần · theo ngày · theo tổ · theo đơn?", why: "quyết định màn hình chính của module", level: "P1", kind: "text" },
        { code: "KH4", text: "Khi xếp lịch, xem yếu tố nào trước: hạn giao · ngày nhận đơn · khách giục · vật tư đã có?", why: "thuật toán xếp lịch", level: "P1", kind: "text" },
        { code: "KH5", text: "Một bộ được coi là đủ điều kiện vào sản xuất khi nào (bản vẽ đã duyệt? chương trình đã có? nhôm/màu đã có? khách đã xác nhận?)", why: "tránh xếp lịch ảo rồi máy phải chờ", level: "P1", kind: "text" },
        { code: "KH6", text: "Có bao nhiêu đơn/bộ đang làm dở thường xuyên? Bao nhiêu bộ là “quá nhiều” với xưởng?", why: "app cần cảnh báo WIP", level: "P2", kind: "text" },
      ] },
      { title: "I.2. Năng lực & thực tế sản xuất", items: [
        { code: "KH7", text: "Thực tế hiện nay xưởng làm ra bao nhiêu bộ/tuần (không phải con số lý thuyết)? Tối đa được bao nhiêu?", why: "con số nền để so tải kế hoạch", level: "P1", kind: "text" },
        { code: "KH8", text: "Có mùa cao điểm không? Tháng nào đông nhất? Chênh lệch bao nhiêu %?", why: "kế hoạch theo mùa, dự báo", level: "P2", kind: "text" },
        { code: "KH9", text: "Ngày thường làm mấy tiếng, mấy ca? Cao điểm tăng ca được bao nhiêu %?", why: "năng lực linh hoạt", level: "P1", kind: "text" },
        { code: "KH10", text: "Tỷ lệ trễ hạn hiện nay khoảng bao nhiêu %? Nguyên nhân chính: chờ nhôm · chờ chương trình · chờ lô sơn · khách đổi · thiếu người · máy hỏng · giao hàng?", why: "app cần danh mục lý do trễ + đo lường được", level: "P1", kind: "text" },
        { code: "KH11", text: "Năng suất 1 người 1 ngày bao nhiêu bộ (hoặc m²)? Có chấm công / tính lương theo sản phẩm không?", why: "nếu có thì app có thể hỗ trợ tính năng suất", level: "P2", kind: "text" },
        { code: "KH12", text: "Tỷ lệ phải làm lại khoảng bao nhiêu %? Một lần làm lại mất thêm bao nhiêu thời gian?", why: "dự phòng thời gian làm lại trong kế hoạch", level: "P2", kind: "text" },
        { code: "KH13", text: "Có phải chờ vật tư (nhôm · kính · phụ kiện · keo · màu) làm dừng sản xuất không? Thường chờ bao lâu?", why: "app cần cảnh báo thiếu vật tư trước khi xếp lịch", level: "P1", kind: "text" },
      ] },
      { title: "I.3. Ngoại lệ & thay đổi", items: [
        { code: "KH14", text: "Ai được quyền chen đơn gấp lên trước? Sale có tự chen được không?", why: "phân quyền và quy tắc ưu tiên", level: "P1", kind: "text" },
        { code: "KH15", text: "Khách đổi kích thước / màu / số lượng sau khi đã vào sản xuất thì xử lý thế nào?", why: "app cần luồng xử lý thay đổi giữa chừng", level: "P1", kind: "text" },
        { code: "KH16", text: "Đơn bị hủy giữa lúc đang sản xuất thì xử lý thế nào? Hàng đã làm dở tính sao?", why: "xử lý đơn hủy — app mới chỉ có trạng thái Đã hủy", level: "P2", kind: "text" },
        { code: "KH17", text: "Đơn làm lại (hàng lỗi khách trả) có chen trước đơn thường không? Quay lại công đoạn nào?", why: "quy tắc xử lý đơn làm lại", level: "P1", kind: "text" },
        { code: "KH18", text: "Đơn hàng mẫu có chiếm chỗ sản xuất không? Ưu tiên thế nào?", why: "loại đơn nào được vào kế hoạch", level: "P1", kind: "text" },
        { code: "KH19", text: "Có sản xuất trước / làm tồn kho không? Bao nhiêu % sản lượng?", why: "nếu có thì kế hoạch phải gồm cả phần dự báo", level: "P1", kind: "text" },
        { code: "KH20", text: "Khi kế hoạch và thực tế lệch (máy hỏng, nghỉ người, khách đổi), ai cập nhật lại và cập nhật ở đâu?", why: "app cần màn hình cập nhật nhanh", level: "P1", kind: "text" },
      ] },
      { title: "I.4. Cập nhật tiến độ & báo cáo", items: [
        { code: "KH21", text: "Xưởng muốn cập nhật tiến độ ở đâu: máy tính ở xưởng · điện thoại · ghi giấy rồi văn phòng nhập?", why: "quyết định app có được dùng thật hay không", level: "P1", kind: "text" },
        { code: "KH22", text: "Cập nhật theo mức bộ hay mức từng công đoạn của từng bộ?", why: "mức chi tiết dữ liệu — chi tiết quá thì không ai nhập", level: "P1", kind: "text" },
        { code: "KH23", text: "Ai là người cập nhật (tổ trưởng tổ nào, hay 1 người văn phòng)?", why: "phân quyền và trách nhiệm", level: "P1", kind: "text" },
        { code: "KH24", text: "Mỗi ngày xưởng cần xem gì: việc hôm nay của tổ · việc đang chậm · việc đã xong · tải tuần sau?", why: "thiết kế màn hình kế hoạch", level: "P1", kind: "text" },
        { code: "KH25", text: "Có cần in phiếu lệnh sản xuất cho từng tổ không? In nội dung gì, khổ giấy nào?", why: "mẫu in (app đã có sẵn công cụ in)", level: "P2", kind: "text" },
        { code: "KH26", text: "Có cần in danh sách việc theo ngày/tuần để dán ở xưởng không?", why: "mẫu in thứ hai", level: "P2", kind: "text" },
        { code: "KH27", text: "Có cần gắn tên thợ vào từng bộ để tính năng suất / lỗi theo người không?", why: "nếu có thì app phải lưu người phụ trách", level: "P2", kind: "text" },
        { code: "KH28", text: "Có cần theo dõi máy đang dừng và lý do dừng (bảo trì · hỏng · chờ chương trình · chờ vật tư · thiếu người)?", why: "dừng máy làm giảm năng lực thật", level: "P2", kind: "text" },
        { code: "KH29", text: "Xưởng muốn app cảnh báo những gì: quá tải tổ · chờ đủ đơn · chờ chương trình máy cắt · bộ sắp trễ hạn · máy đang dừng · thiếu vật tư?", why: "cảnh báo là giá trị chính của module — phải đúng thứ xưởng cần", level: "P1", kind: "text" },
        { code: "KH30", text: "Có khâu nào khác phải thuê ngoài ngoài sơn không (kính · phào · phụ kiện · mạ · uốn)? Thời gian gửi/nhận bao lâu?", why: "thời gian ngoài vẫn phải nằm trong kế hoạch", level: "P2", kind: "text" },
      ] },
    ],
  },
  {
    id: "J", title: "12 CÂU BỔ SUNG (các lỗ hổng đã rà lại", team: "Quản đốc + Kỹ thuật",
    groups: [
      { title: "12 CÂU BỔ SUNG (các lỗ hổng đã rà lại", items: [
        { code: "J1", text: "Ai có quyền sửa / xóa kế hoạch đã chốt? Có cần lưu lại ai đổi gì, lúc nào không?", why: "phân quyền + lịch sử sửa đổi — hiện app chưa có đăng nhập", level: "P1", kind: "text" },
        { code: "J2", text: "Khi một bộ hoàn thành, ai là người xác nhận — tổ trưởng hay quản đốc? Xác nhận ở đâu?", why: "mốc “hoàn thành” phải do một người chịu trách nhiệm", level: "P1", kind: "text" },
        { code: "J3", text: "Kế hoạch tuần được chốt vào ngày nào (ví dụ chiều thứ 6 cho tuần sau)? Ai chốt? Có khóa lại không?", why: "thời điểm chốt quyết định luồng làm việc hằng tuần", level: "P1", kind: "text" },
        { code: "J4", text: "Có cần xem lại kế hoạch các tuần trước để đối chiếu làm được / không không?", why: "lưu lịch sử kế hoạch để đánh giá năng lực thật", level: "P2", kind: "text" },
        { code: "J5", text: "Có cần theo dõi % tiến độ từng bộ, hay chỉ cần trạng thái (chờ / đang / hoàn thành / đã giao)?", why: "chọn % là phải nhập số liệu liên tục, dễ bỏ", level: "P1", kind: "text" },
        { code: "J6", text: "Mỗi tổ có cần xem kế hoạch của tổ khác không (để chủ động chuẩn bị)?", why: "quyết định nội dung màn hình xưởng + phân quyền", level: "P2", kind: "text" },
        { code: "J7", text: "Khi một bộ bị tạm dừng (chờ vật tư, khách đổi, lỗi), có cần trạng thái riêng + lý do không?", why: "trạng thái tạm dừng + danh mục lý do", level: "P1", kind: "text" },
        { code: "J8", text: "Nếu hàng trễ hạn, app có cần tự đề xuất lại lịch không, hay chỉ báo đỏ để người xử lý?", why: "mức độ “tự động” của module", level: "P2", kind: "text" },
        { code: "J9", text: "Có cần thông báo (chuông trong app / Zalo) khi bộ sắp trễ hoặc có việc mới không? Ai nhận?", why: "cảnh báo chỉ có giá trị nếu đến đúng người", level: "P2", kind: "text" },
        { code: "J10", text: "Báo cáo nên tính theo bộ · m² · hay giá trị?", why: "đơn vị báo cáo — ảnh hưởng cách nhập KH/Lượng", level: "P2", kind: "text" },
        { code: "J11", text: "Có cần in kế hoạch ra giấy dán ở xưởng (thay bảng công đoạn giấy hiện nay) không?", why: "mẫu in thứ ba", level: "P2", kind: "text" },
        { code: "J12", text: "Có khâu nào khác phải thuê ngoài ngoài sơn (kính, phào, phụ kiện, mạ, uốn)? Thời gian gửi/nhận bao lâu?", why: "thời gian ngoài vẫn phải nằm trong kế hoạch", level: "P2", kind: "text" },
      ] },
    ],
  },
  {
    id: "K", title: "BẢNG ĐIỀN THỜI LƯỢNG CÔNG ĐOẠN (đơn vị thời gian: .....................", team: "Tất cả các tổ",
    groups: [
      { title: "BẢNG ĐIỀN THỜI LƯỢNG CÔNG ĐOẠN (đơn vị thời gian: .....................", items: [
        { code: "K1", text: "Thiết kế · loại C · số trong bảng gốc: 1", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K2", text: "Bồi Lares (nạp chương trình máy cắt) · loại C · số trong bảng gốc: 1", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K3", text: "Cắt (khung/cánh/phào) · loại G · số trong bảng gốc: 1", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K4", text: "Chấn (khung/cánh/phào) · loại G · số trong bảng gốc: 1", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K5", text: "Hàn (khung/cánh/phào) · loại G · số trong bảng gốc: 2", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K6", text: "Ép cánh · loại G · số trong bảng gốc: (trống)", why: "chưa có số", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K7", text: "Mài mối hàn / làm sạch ba via · loại G · số trong bảng gốc: (trống)", why: "chưa có công đoạn này", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K8", text: "Test cơ khí · loại G · số trong bảng gốc: 1", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K9", text: "Sơn · loại G · số trong bảng gốc: 2", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K10", text: "Vân (khung/cánh/phào) · loại G · số trong bảng gốc: 2", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K11", text: "Lắp kính + phụ kiện · loại G · số trong bảng gốc: (trống)", why: "chưa có công đoạn này", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K12", text: "Vệ sinh + Đóng gói · loại G · số trong bảng gốc: 1", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K13", text: "Kho / giao hàng · loại G · số trong bảng gốc: 0", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K14", text: "Chờ khô sau sơn · loại - · số trong bảng gốc: (trống)", why: "chưa có số", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K15", text: "Chờ sau vân trước khi đóng gói · loại - · số trong bảng gốc: (trống)", why: "chưa có số", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
        { code: "K16", text: "Chờ sau Bồi Lares mới cắt được · loại - · số trong bảng gốc: (trống)", why: "chưa có số", level: "P1", kind: "text", hint: "số (giờ/ngày) + ghi chú nếu khác" },
      ] },
    ],
  },
  {
    id: "L", title: "DỮ LIỆU APP CẦN THÊM (đánh dấu: Cần / Không cần", team: "Quản đốc + Kỹ thuật",
    groups: [
      { title: "DỮ LIỆU APP CẦN THÊM (đánh dấu: Cần / Không cần", items: [
        { code: "L1", text: "Trạng thái sản xuất từng BỘ (Chờ SX / Đang SX / Hoàn thành / Đã giao / Tạm dừng) — biết bộ nào đã xong", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L2", text: "Trạng thái từng CÔNG ĐOẠN của từng bộ — theo dõi chi tiết nếu xưởng nhập được", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L3", text: "Loại công đoạn: GIA_CONG / CHUAN_BI — công đoạn chuẩn bị không nhân theo số bộ", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L4", text: "Phạm vi công việc: KHUNG / CÁNH / PHAO / CẢ BỘ — biết khung đã xong chưa", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L5", text: "Chương trình máy cắt theo model (tên file, phiên bản, máy, người làm, ngày, thời gian) — tái sử dụng; cảnh báo model chưa có chương trình", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L6", text: "Giờ công định mức theo loại cửa / model — tính tải chính xác", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L7", text: "Năng lực từng tổ (số người, bộ/tuần, giờ/tuần) — cảnh báo quá tải", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L8", text: "Thời gian setup (đổi màu sơn · mã vân · khuôn chấn · model nhôm) — quyết định gom lô", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L9", text: "Thời gian chờ (sau sơn · sau vân · sau Bồi Lares · chờ keo khô) — không xếp sát nhau khi chưa khô", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L10", text: "Tổ phụ trách + Người phụ trách từng bộ/công đoạn — phân công & năng suất", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L11", text: "Ngày bắt đầu / kết thúc thực tế từng công đoạn — biết chỗ nào trễ, đo năng suất thật", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L12", text: "Ngày hoàn thành sản xuất (đơn/bộ) — so với hạn giao", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L13", text: "Ngày giao thực tế — tính tỷ lệ giao đúng hạn", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L14", text: "Lý do trễ (danh mục: chờ nhôm · chờ chương trình · chờ lô sơn · khách đổi · thiếu người · máy hỏng…) — thống kê nguyên nhân trễ", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L15", text: "Lỗi & làm lại (bộ nào, công đoạn nào, mất bao lâu) — tỷ lệ lỗi theo tổ", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L16", text: "Mã vân + mã màu chuẩn (danh mục) — gom lô sơn / lô vân", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
        { code: "L17", text: "Ghi chú sản xuất theo bộ (khác ghi chú của sale) + đính kèm bản vẽ/chương trình — thay vì gửi Zalo thủ công", level: "P2", kind: "choice", options: ["Cần", "Không cần"], note: true },
      ] },
    ],
  },
  {
    id: "M", title: "KIỂM TRA CHÉO — thông tin app đang có, xưởng có dùng không?", team: "Quản đốc + Kỹ thuật",
    groups: [
      { title: "KIỂM TRA CHÉO — thông tin app đang có, xưởng có dùng không?", items: [
        { code: "M1", text: "Bộ số (set_no)", level: "P2", kind: "choice", options: ["Có", "Không", "Thiếu thông tin"], note: true },
        { code: "M2", text: "Mã hàng · Tên sản phẩm · Model nhôm", level: "P2", kind: "choice", options: ["Có", "Không", "Thiếu thông tin"], note: true },
        { code: "M3", text: "Loại mở · Hướng phào · Loại phào · Số phào/bộ", level: "P2", kind: "choice", options: ["Có", "Không", "Thiếu thông tin"], note: true },
        { code: "M4", text: "Số cánh · Thông tin cánh/panel · Ô thoáng", level: "P2", kind: "choice", options: ["Có", "Không", "Thiếu thông tin"], note: true },
        { code: "M5", text: "Màu sơn", level: "P2", kind: "choice", options: ["Có", "Không", "Thiếu thông tin"], note: true },
        { code: "M6", text: "Cao × Rộng · Khung bao · Thông thủy cao/rộng", level: "P2", kind: "choice", options: ["Có", "Không", "Thiếu thông tin"], note: true },
        { code: "M7", text: "Mã khoá · Phụ kiện (tên / SL / ghi chú / ảnh)", level: "P2", kind: "choice", options: ["Có", "Không", "Thiếu thông tin"], note: true },
        { code: "M8", text: "Ghi chú dòng hàng", level: "P2", kind: "choice", options: ["Có", "Không", "Thiếu thông tin"], note: true },
        { code: "M9", text: "Ảnh sản phẩm · Ảnh chi tiết", level: "P2", kind: "choice", options: ["Có", "Không", "Thiếu thông tin"], note: true },
        { code: "M10", text: "Hạn giao · Ngày đặt hàng", level: "P2", kind: "choice", options: ["Có", "Không", "Thiếu thông tin"], note: true },
        { code: "M11", text: "Khách hàng / Đại lý / Khu vực / Số km", level: "P2", kind: "choice", options: ["Có", "Không", "Thiếu thông tin"], note: true },
        { code: "M12", text: "KH/Lượng (pricing_quantity) & ĐVT", level: "P2", kind: "choice", options: ["Có", "Không", "Thiếu thông tin"], note: true },
      ] },
    ],
  },
  {
    id: "O", title: "XIN KÈM THEO (nếu có", team: "Ai cũng góp ý được",
    groups: [
      { title: "XIN KÈM THEO (nếu có", items: [
        { code: "O1", text: "Điều gì đang cản trở nhất khi lên kế hoạch sản xuất hiện nay?", why: "mở", level: "P2", kind: "text" },
        { code: "O2", text: "Điều gì app cần làm được để xưởng thấy hữu ích ngay tuần đầu?", why: "mở", level: "P2", kind: "text" },
        { code: "O3", text: "Câu hỏi / thông tin nào xưởng muốn bổ sung vào phiếu này?", why: "mở", level: "P2", kind: "text" },
      ] },
    ],
  },
];

export const SURVEY_ITEMS: SurveyItem[] = SURVEY_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.items));
export const SURVEY_TOTAL = SURVEY_ITEMS.length;
export const SURVEY_P1_TOTAL = SURVEY_ITEMS.filter((i) => i.level === "P1").length;
export const SURVEY_ITEM_MAP: Record<string, SurveyItem> = Object.fromEntries(
  SURVEY_ITEMS.map((i) => [i.code, i])
);
