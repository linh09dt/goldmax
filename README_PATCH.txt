Door Production - Remove 5 Door fields + 1-row full view patch

Changed file:
- src/components/order-form.tsx

UI changes only:
- Removed from main Door card UI: Model khóa, Loại phào, Thanh phào / bộ, Nan ô thoáng, Cánh / bộ.
- Remaining 17 Door fields are arranged on a single full-width row without horizontal scrolling.
- Underlying data model/API/database fields are unchanged.

Copy src into the current project and overwrite the changed file.
