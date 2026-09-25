/**
 * V111 — Tuỳ chọn dùng chung cho các transaction GHI đơn hàng.
 *
 * Vì sao cần: DB production là Supabase pooler (Singapore, `connection_limit=1`), mỗi lượt
 * round trip thực đo ~40–100 ms. Transaction tương tác mặc định của Prisma chỉ cho **5 giây**,
 * nên một đơn 25 bộ cửa (61 lượt round trip tuần tự) chạm hạn mức và báo:
 *
 *   Invalid `tx.salesOrderItem.create()` invocation …
 *   Transaction API error: A query cannot be executed on an expired transaction.
 *   The timeout for this transaction was 5000 ms, however 5102 ms passed…
 *
 * Đã xử lý ở hai lớp:
 *  1. Giảm mạnh số lượt round trip — ghi lồng nhau (order + items + details + requirements
 *     trong MỘT lượt) và gộp các câu SQL cấp Bộ số lại (xem `src/lib/set-number.ts`).
 *  2. Nới hạn mức dưới đây để đơn rất lớn hoặc mạng chậm vẫn không vỡ.
 *
 * `timeout` = thời gian tối đa của cả transaction; `maxWait` = thời gian chờ lấy connection.
 */
export const ORDER_WRITE_TRANSACTION = { maxWait: 15_000, timeout: 30_000 } as const;
