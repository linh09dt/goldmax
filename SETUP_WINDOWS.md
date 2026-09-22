# Door Production - Setup Windows

## 1. Mở CMD tại thư mục project

```cmd
cd /d D:\Projects\door-production
```

## 2. Tạo file .env

```cmd
copy .env.example .env
```

Mở `.env` và thay `YOUR_PASSWORD` bằng password thật của PostgreSQL user `door_app`.

Ví dụ:

```env
DATABASE_URL="postgresql://door_app:YOUR_PASSWORD@localhost:5432/door_production?schema=public"
```

> Nếu password có ký tự đặc biệt như `@`, `:`, `/`, `#`, `%` thì phải URL-encode password.

## 3. Cài package

```cmd
npm install
```

## 4. Generate Prisma Client

```cmd
npm run db:generate
```

## 5. Tạo migration đầu tiên

```cmd
npm run db:migrate -- --name init
```

Migration này sẽ tạo bảng `system_settings` và bảng `_prisma_migrations` trong database `door_production`.

## 6. Chạy localhost

```cmd
npm run dev
```

Mở:

- http://localhost:3000
- http://localhost:3000/api/health/db

Kết quả health API mong đợi:

```json
{
  "ok": true,
  "database": "door_production",
  "user": "door_app",
  "postgresql": "18.x",
  "app": "Door Production"
}
```

## 7. Lệnh hữu ích

```cmd
npm run db:status
npm run db:studio
npm run lint
npm run build
```

## Kiến trúc hiện tại

```text
Browser
  -> Next.js 16 App Router
      -> Prisma 7 + @prisma/adapter-pg
          -> PostgreSQL 18 local
              -> door_production
```

Chưa thêm logic nghiệp vụ sản xuất cửa ở bản starter này. Bước tiếp theo mới xây database V1:

Customer -> Project/Order -> Door -> BOM -> Routing -> Job Card -> Planning -> Production -> QC -> Delivery
