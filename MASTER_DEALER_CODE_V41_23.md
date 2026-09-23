# V41.23 - Mã Đại Lý trong Danh mục cấu hình

- Thêm nhóm `Mã Đại Lý` (`DEALER_CODE`) trong tab Danh mục cấu hình.
- Cho phép Thêm / Sửa / Ngưng dùng / Kích hoạt / Xóa Mã Đại Lý.
- Màn hình Tạo/Sửa đơn hàng đổi trường `Mã khách hàng` thành `Mã Đại Lý` và chọn từ danh mục active.
- Đơn hàng cũ có mã chưa còn trong danh mục vẫn hiển thị giá trị đang lưu để không mất dữ liệu.
- Không thay đổi schema DB: dùng lại bảng `master_options`; `customerCode` tiếp tục là trường lưu Mã Đại Lý để tương thích dữ liệu và export hiện tại.
