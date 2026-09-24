# V41.26 - Tạm ẩn export cũ

- Tạm ẩn 3 nút trên từng đơn: **Xuất Excel**, **PDF** (bản cũ), **Xuất Excel V2**.
- Giữ duy nhất chức năng **PDF V2**, đổi nhãn hiển thị thành **Xuất PDF**.
- Không xóa code hoặc API của các chức năng cũ; chỉ dùng cờ `SHOW_LEGACY_EXPORT_BUTTONS = false` để có thể bật lại sau.
- Đổi các thông báo người dùng của PDF V2 sang tên **PDF** cho thống nhất giao diện.
- Cập nhật Hướng dẫn sử dụng để phản ánh trạng thái hiện tại.
- Không thay đổi logic tạo PDF V2, dữ liệu, DB, export API, ảnh hoặc giá.
