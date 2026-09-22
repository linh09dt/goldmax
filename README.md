# Door Production Starter

Starter local cho dự án quản lý sản xuất cửa.

- Next.js 16 / App Router / TypeScript
- React 19
- Tailwind CSS 4
- Prisma ORM 7 + PostgreSQL driver adapter
- PostgreSQL 18 local

Đọc `SETUP_WINDOWS.md` để cài đặt.

## Nguyên tắc kiến trúc

- PostgreSQL local là môi trường phát triển ban đầu.
- Prisma migrations là nguồn chuẩn cho thay đổi schema.
- Không hard-code connection string trong source code.
- Core nghiệp vụ không phụ thuộc Supabase.
- Khi deploy Vercel + Supabase sau này, chủ yếu đổi database connection và storage/auth adapter nếu cần.
