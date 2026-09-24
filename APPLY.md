# BẢN ZIP THAY ĐỔI — áp cho project door-production

Gói này **chỉ chứa file đã thay đổi/mới**, giữ nguyên đường dẫn trong project.
Không chứa `node_modules`, `.next`, `src/generated`, `.env`, `next-env.d.ts` hay dữ liệu database.

Gói này gồm **toàn bộ thay đổi kể từ file zip gốc của bạn**: V75 (Bộ số tự động) + V76 (gộp 3 tab thành tab CẤU HÌNH) + V77 (sửa UI view Tạo đơn hàng).
Nếu đã áp bản V76 trước đó thì chỉ cần quan tâm 2 file của V77: `src/components/order-form.tsx`, `src/lib/order-form.ts`.

## Cách áp

```
unzip -o door-production-changes-v77.zip -d <thư-mục-project>
npm run db:generate
npm run build
npm run dev
```

Không cần `npm run db:migrate` (không đổi schema Prisma).

## Nội dung theo phiên bản

**V75 — Bộ số tự động** → `ORDER_SET_NUMBER_AUTO_V75.md`
- `src/lib/set-number.ts` (mới) · `src/lib/order-form.ts` · `src/lib/calculation-config.ts`
- `src/app/api/orders/route.ts` · `src/app/api/orders/[id]/route.ts`
- `src/components/order-form.tsx` · `src/app/orders/[id]/page.tsx` · `src/components/calculation-config.tsx`

**V76 — Gộp 3 tab thành tab CẤU HÌNH** → `SETTINGS_TAB_MERGE_V76.md`
- `src/app/settings/page.tsx` (mới) · `src/components/settings/` (mới) · `src/components/erp-nav.tsx` (mới)
- `src/components/erp-shell.tsx` · `src/app/globals.css` · `src/app/guide/page.tsx`
- `src/app/items/page.tsx` · `src/app/master-options/page.tsx` · `src/app/calculation-config/page.tsx` (redirect)
- `src/components/item-master.tsx` · `src/components/master-options.tsx` · `src/components/calculation-config.tsx`

**V77 — Sửa UI view Tạo đơn hàng** → `ORDER_ENTRY_UI_V77.md`
- `src/components/order-form.tsx` · `src/lib/order-form.ts`
