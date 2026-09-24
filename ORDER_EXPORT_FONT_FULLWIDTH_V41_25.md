# V41.25 - Export font +2 / full-width

- Tăng cỡ chữ khoảng +2 cho các chức năng xuất đơn hàng: PDF/Print cũ, PDF V2 ReportLab, Excel cũ và Excel V2.
- PDF V2 giảm lề trái/phải từ 12 mm xuống 4 mm; bảng và header scale đúng toàn bộ chiều rộng còn lại của A4 landscape.
- Browser Print/PDF giữ lề 4 mm và chuẩn hóa tổng tỷ lệ 20 cột về đúng 100% để không tràn trang.
- Excel V2 giảm lề trái/phải về ~4 mm; Excel cũ vốn đã dùng lề ~3 mm nên giữ nguyên.
- Cân lại chiều cao hàng để font lớn hơn không bị cắt; giữ fit-to-width 1 trang theo chiều ngang.
- Cân lại cột Đơn giá/Thành tiền trong PDF V2 để số tiền không bị xuống dòng sau khi tăng font.
- Không thay đổi dữ liệu, công thức, giá, ảnh, logic nhóm hàng hoặc logic export đã chốt ở các version trước.
