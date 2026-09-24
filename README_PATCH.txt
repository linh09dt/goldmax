DOOR PRODUCTION - ACCESSORY DIRECT EDIT + SAVE PATCH

Thay đổi:
1. Bỏ dòng tóm tắt "Chưa chọn chi tiết / phụ kiện" và toàn bộ hàng summary master-detail.
2. Bấm "+ Thêm phụ kiện" sẽ hiện trực tiếp hàng nhập liệu để chọn Nhóm hàng / Model / kích thước / KH-Lượng / Đơn giá / Ghi chú.
3. Thêm nút "Lưu ngay" ngay trên từng hàng phụ kiện.
4. "Lưu ngay" dùng API lưu đơn hàng hiện có, không thay DB/schema/API. Khi tạo đơn mới lần đầu, hệ thống tạo đơn rồi chuyển sang URL chỉnh sửa để các lần lưu sau cập nhật đúng đơn, tránh tạo trùng.
5. Giữ nút "Xóa" trên từng hàng phụ kiện và giữ toàn bộ logic catalog/tính giá/upload hiện có.

File thay đổi:
- src/components/order-form.tsx

Cách dùng:
- Copy thư mục src trong patch đè vào project hiện tại.
