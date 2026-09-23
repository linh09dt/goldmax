# V41.24 - Bắt buộc đầy đủ Thông tin đơn hàng

- Tất cả 16 trường trong khối `Thông tin đơn hàng` là bắt buộc cho cả Tạo đơn và Sửa đơn.
- Client chặn lưu, liệt kê các trường còn thiếu, đánh dấu đỏ từng ô thiếu và cuộn về khối Thông tin đơn hàng.
- API/server kiểm tra lại cùng rule; không thể bỏ qua validation bằng cách gọi API trực tiếp.
- Các trường số/ngày bắt buộc phải có giá trị hợp lệ; `Số Km giao hàng = 0` vẫn được chấp nhận.
- Không thay đổi DB, bảng chi tiết, giá, ảnh, export PDF/Excel hay các logic khác.
