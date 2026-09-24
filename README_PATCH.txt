DOOR PRODUCTION - CALCULATION CONFIG V44
========================================

Muc tieu
- Dua logic KH/Luong va de xuat Cao/Rong ra cau hinh, de gan dung cho Nhom hang / Model.
- Giu nguyen DB schema don hang, API don hang, gia, PDF, Excel.
- Khong can Prisma migration: cau hinh luu vao system_settings key ORDER_CALCULATION_CONFIG_V1.

File moi
- src/lib/calculation-config.ts
- src/app/api/calculation-config/route.ts
- src/app/calculation-config/page.tsx
- src/components/calculation-config.tsx
- ORDER_CALCULATION_CONFIG_V44.md

File thay doi
- src/components/order-form.tsx
- src/components/erp-shell.tsx
- src/app/guide/page.tsx

Logic
1. MAIN/Bộ cửa chính: mặc định (Cao x Rộng) / 1.000.000.
2. Phào/Phao: mặc định (Cao x 2 + Rộng) / 1.000.
3. Ô thoáng: lấy 1TK/2TK/3TK từ Bộ cửa cha.
4. Khóa: lấy SL bộ cửa cha.
5. Các hàng khác: nhập KH/Lượng bằng tay nếu chưa có rule.
6. Rule Model/Hàng hóa ưu tiên hơn rule Nhóm hàng.
7. Đề xuất Cao/Rộng chỉ áp dụng khi chọn Model và vẫn sửa tay được.
8. Số chữ số thập phân KH/Lượng cấu hình 0-4, mặc định 2.

Mẫu gợi ý tự sinh từ Danh mục hàng hóa
- Phào rời: Cao = Cao cửa, Rộng = Rộng cửa.
- Phào biệt thự đứng: Cao = Cao cửa, Rộng = trống.
- Phào biệt thự ngang: Cao = trống, Rộng = Rộng cửa.
- Phào biệt thự đỉnh: Cao = trống, Rộng = Rộng cửa.

Cách dùng
1. Chép đè thư mục src và file markdown vào project hiện tại.
2. Chạy npm install nếu project chưa đủ dependency.
3. Chạy npm run build.
4. Mở menu "Cấu hình tính toán".
5. Kiểm tra rule gợi ý -> chỉnh đúng Nhóm hàng/Model -> bấm "Lưu cấu hình".
6. Tạo/Sửa đơn hàng và test KH/Lượng + đề xuất Cao/Rộng.

Khong can prisma migrate.
