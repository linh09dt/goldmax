PATCH: Cho phép chọn lại đề xuất mà không cần xóa giá trị cũ

File thay đổi:
- src/components/order-form.tsx

Thay đổi:
- Ô thoáng / Hướng mở / Phào / Màu sơn dùng dropdown đề xuất riêng thay cho datalist của trình duyệt.
- Sau khi đã chọn một giá trị (ví dụ TP), bấm mũi tên vẫn hiển thị toàn bộ đề xuất để chọn giá trị khác.
- Vẫn cho phép gõ tay giá trị nếu cần.
- Áp dụng cả Bộ cửa và phần Thông số thêm của phụ kiện.
- Không thay DB/API/logic tính giá/lưu đơn hàng.
