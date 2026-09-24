GOLDMAX - PDF Mẫu Mới (test song song)

File mới:
- src/components/order-pdf-preview-button.tsx
- api/order_pdf_preview.py
- python/reportlab_order_preview.py

File thay đổi:
- src/app/orders/[id]/page.tsx: chỉ thêm nút "PDF Mẫu Mới" riêng, không thay nút PDF hiện tại.
- vercel.json: chỉ thêm maxDuration cho api/order_pdf_preview.py.

Logic test:
- Nút PDF hiện tại vẫn giữ nguyên.
- Nút "PDF Mẫu Mới" gọi /api/order_pdf_preview?orderId=...
- PDF mới A4 ngang, vector text/bảng.
- Cột HÌNH ẢNH nằm phía cuối.
- Hình ảnh trong cột được gom theo từng Bộ cửa: ảnh dòng bộ cửa chính + ảnh tất cả chi tiết/phụ kiện của bộ.
- Nếu tải ảnh lỗi, nút tự thử lại chế độ noImages để vẫn xem được layout.

Không thay DB schema, không thay API PDF V2 cũ, không thay Excel export.
