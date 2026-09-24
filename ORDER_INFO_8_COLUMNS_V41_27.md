# V41.27 - Thông tin đơn hàng 8 trường / hàng

- Desktop `xl` trở lên: khối **Thông tin đơn hàng** hiển thị đúng 8 trường trên mỗi hàng, tổng 2 hàng.
- Hàng 1: Mã Đại Lý, Tên khách hàng, NVKD phụ trách, Mã đơn hàng, Ngày đặt hàng, Ngày cần giao hàng, Trạng thái, Ngày cập nhật.
- Hàng 2: Người nhận, Số điện thoại, Số Km giao hàng, Vùng miền, Nhóm, Mã biểu mẫu, Ngày hiệu lực, Địa chỉ nhận hàng.
- Cân lại tỷ lệ chiều rộng: ưu tiên Mã đơn hàng, Tên khách hàng và Địa chỉ nhận hàng; các trường ngắn thu gọn hơn.
- Input/select cao 36px, font nội dung 13px, label 10-11px để tránh vỡ giao diện.
- Địa chỉ nhận hàng chuyển thành input một dòng để nằm cùng hàng; dữ liệu/logic lưu giữ nguyên.
- Responsive: tablet 4 cột, mobile 2 cột; validation bắt buộc V41.24 giữ nguyên.
- Không thay đổi DB, API, PDF/Excel, giá, ảnh hay logic đơn hàng.
