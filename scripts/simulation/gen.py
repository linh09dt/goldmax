#!/usr/bin/env python3
"""
Sinh đơn hàng mô phỏng cho module Lên kế hoạch sản xuất GOLDMAX.

Dữ liệu bám sát danh mục THẬT trích từ 8 file Excel đơn hàng của nhà máy:
  sản phẩm, model, hướng mở, phào, màu sơn, khoảng kích thước, hàng kèm (khóa/kính/phào rời),
  đơn giá/m2, định dạng mã đơn, tên đại lý theo tỉnh.

Dùng:
  python3 gen.py --n 1000 --seed 20260926 --out payloads.jsonl
"""
import argparse, json, random, unicodedata
from datetime import date, timedelta

# ── DANH MỤC THẬT ────────────────────────────────────────────────────────────
PRODUCTS = [
    # (tên, số cánh, trọng số, mẫu model, khoảng cao, khoảng rộng, ô thoáng)
    ("Cửa Đi 1 Cánh", 1, 30, ["GM1-H{h}-1TK", "GM1-H{h}", "GM1-Đ-CK-1TK", "GM1-H{h}-1NC"],
     (2050, 2750), (850, 1150), ["1TK", "1NC"], ["1", "3", "5"]),
    ("Cửa Sổ", 2, 24, ["CS2-Đ-H10-{o}", "CSLUX2-Đ-H10-{o}", "CS2-L-H10-{o}"],
     (1000, 2050), (900, 2250), ["1TK", "2TK", "2NC"], ["10"]),
    ("Cửa Đi 4 Cánh", 4, 16, ["GM4-L-H3-HPK-{o}", "LX4-L-H3-HPK-{o}", "GMLUX4-L-H3-H9-{o}"],
     (2400, 3200), (2500, 3200), ["3TK", "3NC"], ["3", "9"]),
    ("Cửa Đi 2 Cánh", 2, 14, ["GM2-Đ-H{h}-{o}", "GM2-Đ-HPK-VK-{o}"],
     (2200, 2900), (1300, 1800), ["2TK", "2NC"], ["3", "5"]),
    ("Cửa Đi Vách Kính", 2, 8, ["GM2-Đ-HPK-VK-{o}"],
     (2500, 3200), (2000, 2900), ["2TK", "3TK"], ["5"]),
    ("Cửa Sổ 3 Cánh", 3, 8, ["CS3-Đ-H10-{o}", "CSLUX4-Đ-H10-HPK-{o}"],
     (1400, 2400), (1700, 2800), ["2TK", "3TK"], ["10"]),
]
HUONG_MO = ["NP", "NP", "NP", "TP", "TP", "TT", "TT", "NT"]
PHAO = ["Thuận"] * 7 + ["Vuông"] * 2 + ["Nghịch"]
MAU_SON = (["GM-01"] * 8 + ["GM-06"] * 5 + ["GM-09"] * 5 + ["GM-14"] * 4 +
           ["GM-11"] * 3 + ["GM-05"] * 2 + ["GM-02", "GM-03", "GM-04", "GM-07", "GM-08",
                                          "GM-10", "GM-12", "GM-13"])
KHUON = ([150] * 6 + [210] * 5 + [240] * 5 + [250] * 4 + [170] * 3 + [160] * 2 + [120, 140])
LOCKS = [("Khóa tay trúc GM805", 1100000), ("Khóa GM 202", 480000), ("Khóa GM 330", 770000),
         ("Khóa tay gạt GM505", 950000), ("Khóa đa điểm GM700", 1450000)]
GHI_CHU = ["Bản lề inox", "Bản lề, chốt âm inox", "Kính trên cánh màu trắng trong",
           "OT kính dán 6.38 màu trắng trong", "Kính trên OT 6,38 mầu xanh đen",
           "ĐÓNG GÓI CHỐNG XỐC", "Cắt hèm dật cấp 1,5 cm", "SX PHÀO BIỆT THỰ 260",
           "Chấn song vuông tròn phi 34", "2 lập là", "Khuôn Vuông, Phào rời 2 mặt"]

TINH = [("Bắc Ninh", "BN"), ("Bắc Giang", "BG"), ("Hải Dương", "HD"), ("Lâm Đồng", "LĐ"),
        ("Đắk Lắk", "ĐL"), ("Hà Nội", "HN"), ("Hưng Yên", "HY"), ("Vĩnh Phúc", "VP"),
        ("Thái Nguyên", "TN"), ("Ninh Bình", "NB"), ("Thanh Hóa", "TH"), ("Nghệ An", "NA"),
        ("Quảng Bình", "QB"), ("Quảng Trị", "QT"), ("Huế", "HU"), ("Đà Nẵng", "DN"),
        ("Quảng Nam", "QN"), ("Quảng Ngãi", "QNg"), ("Bình Định", "BD"), ("Phú Yên", "PY"),
        ("Khánh Hòa", "KH"), ("Ninh Thuận", "NT"), ("Bình Thuận", "BT"), ("Đồng Nai", "ĐN"),
        ("Sài Gòn", "SG"), ("Long An", "LA"), ("Tiền Giang", "TG"), ("Bến Tre", "BT"),
        ("Vĩnh Long", "VL"), ("Cần Thơ", "CT"), ("An Giang", "AG"), ("Kiên Giang", "KG"),
        ("Đồng Tháp", "ĐT"), ("Tây Ninh", "TNg"), ("Bình Phước", "BP"), ("Lạng Sơn", "LS"),
        ("Cao Bằng", "CB"), ("Tuyên Quang", "TQ"), ("Yên Bái", "YB"), ("Sơn La", "SL")]
TEN_DEM = ["Anh", "A", "Chị", "Chú", "Bác", "Cô"]
TEN_RIENG = ["Luyện", "Lân", "Vinh", "Tuấn", "Kiên", "Hưng Phương", "Lĩnh", "Hằng", "Trang",
             "Ngọc", "Thảo", "Hùng", "Mai", "Yến", "Dũng", "Hoa", "Sơn", "Bình", "Tâm", "Phúc",
             "Giang", "Hải", "Long", "Nam", "Oanh", "Phương", "Quân", "Quỳnh", "Tú", "Uyên",
             "Vân", "Xuân", "Đức", "Hiếu", "Khánh", "Lan", "Minh", "Nhung", "Phát", "Thắng"]
NVKD = ["Lĩnh", "Hằng", "Trang", "Ngọc", "Thảo", "Hùng", "Mai", "Yến"]
HUYEN = ["Sơn Động", "Lạng Giang", "Yên Dũng", "Hiệp Hòa", "Tân Yên", "Việt Yên",
         "Gia Bình", "Lương Tài", "Thuận Thành", "Quế Võ", "Tiên Du", "Yên Phong"]


def khong_dau(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s)
                   if unicodedata.category(c) != "Mn").replace("Đ", "D").replace("đ", "d")


def make_dealers(rng, count=70):
    dealers, used = [], set()
    tinhs = rng.sample(TINH, min(count, len(TINH)))
    i = 0
    while len(dealers) < count:
        tinh, ma = tinhs[i % len(tinhs)]
        i += 1
        for _ in range(40):
            code = f"{ma}{rng.randint(2, 68)}"
            if code in used:
                continue
            used.add(code)
            name = f"{rng.choice(TEN_DEM)} {rng.choice(TEN_RIENG)}"
            addr = f"{rng.choice(HUYEN)} - {tinh}" if rng.random() < 0.5 else tinh
            phone = "0" + rng.choice("35789") + "".join(str(rng.randint(0, 9)) for _ in range(8))
            dealers.append(dict(code=code, name=name, address=addr, phone=phone, tinh=tinh))
            break
    return dealers


def dims(rng, lo, hi, step=5):
    return int(round(rng.uniform(lo, hi) / step) * step)


def build_order(rng, seq_no, day_seq, cust_seq, order_date, due_date):
    dealer = rng.choice(DEALERS)
    n_bo = rng.choices([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
                       weights=[42, 26, 13, 7, 4, 2.5, 1.5, 1, 0.7, 0.5, 0.3, 0.2, 0.15, 0.1, 0.05])[0]
    items, total_bo = [], 0
    for line in range(1, n_bo + 1):
        name, canh, _, model_tpl, (h_lo, h_hi), (w_lo, w_hi), ots, hs = rng.choices(
            PRODUCTS, weights=[p[2] for p in PRODUCTS])[0]
        ot = rng.choice(ots)
        model = rng.choice(model_tpl).format(h=rng.choice(hs), o=ot)
        cao, rong = dims(rng, h_lo, h_hi), dims(rng, w_lo, w_hi)
        khuon = rng.choice(KHUON)
        qty = rng.choices([1, 2, 3], weights=[90, 8, 2])[0]
        if total_bo + qty > 15:
            qty, model = 1, model
        total_bo += qty
        unit_price = rng.randrange(1850000, 3250000, 10000)
        khl = round(cao * rong * qty / 1_000_000, 4)
        note = ". ".join(rng.sample(GHI_CHU, rng.choices([1, 2, 3], weights=[30, 55, 15])[0]))
        details = []
        if rng.random() < 0.85:                      # KHÓA
            lk, lp = rng.choice(LOCKS)
            details.append(dict(rowOrder=len(details) + 1, detailType="HANG_KEM",
                                productName="KHÓA", productCode=lk, model=lk, unit="bộ",
                                pricingQuantity=1.0, unitPrice=lp))
        if rng.random() < 0.55:                      # Ô thoáng (kính)
            so_ot = int(ot[0]) if ot[0].isdigit() else 1
            ten = "Ô thoáng nan chớp" if ot.endswith("NC") else "kính ô thoáng"
            gia = 350000 if ot.endswith("NC") else 90000
            details.append(dict(rowOrder=len(details) + 1, detailType="HANG_KEM",
                                productName="Ô Thoáng", productCode=ten, model=ten, unit="m2",
                                pricingQuantity=float(so_ot), unitPrice=gia))
        if rng.random() < 0.30:                      # Phào rời
            details.append(dict(rowOrder=len(details) + 1, detailType="HANG_KEM",
                                productName="Phao Rời", productCode="PR", model="PR",
                                heightMm=cao, widthMm=rong, unit="m",
                                pricingQuantity=round((2 * cao + 2 * rong) / 1000, 2),
                                unitPrice=70000))
        for d in details:
            d["amount"] = round(d["pricingQuantity"] * d["unitPrice"], 2)
        items.append(dict(
            setNo=None, productName=name, productCode=model, model=model,
            openingDirection=rng.choice(HUONG_MO), trimDirection=rng.choice(PHAO),
            paintColor=rng.choice(MAU_SON), heightMm=cao, widthMm=rong, frameMm=khuon,
            clearHeightMm=cao - 2 * khuon, clearWidthMm=rong - 2 * khuon,
            panelInfo=ot, leavesPerSet=canh, quantity=qty, unit="m2",
            pricingQuantity=khl, unitPrice=unit_price, amount=round(khl * unit_price, 2),
            note=note, details=details))

    subtotal = sum(i["amount"] + sum(d["amount"] for d in i["details"]) for i in items)
    subtotal = round(subtotal + (0 if rng.random() < 0.75 else rng.randrange(200000, 1500000, 50000)), 2)
    discount = rng.choices([0, 2, 3, 5, 8], weights=[70, 10, 8, 8, 4])[0]
    after = round(subtotal * (1 - discount / 100), 2)
    deposit = round(after * rng.choice([0, 0, 0.2, 0.3, 0.5]) / 1_000_000) * 1_000_000
    order_type = rng.choices(["SAN_XUAT", "MAU", "LAM_LAI"], weights=[70, 20, 10])[0]
    status = "NHAP" if rng.random() < 0.05 else "DA_XAC_NHAN"
    return dict(
        orderCode=f"{order_date:%y%m%d}{day_seq:02d}{dealer['code']}DH{cust_seq:02d}",
        orderType=order_type, status=status,
        customerCode=dealer["code"], customerName=dealer["name"],
        salesEmployeeCode=rng.choice(NVKD),
        orderDate=order_date.isoformat(), requiredDeliveryDate=due_date.isoformat(),
        excelUpdateDate=order_date.isoformat(),
        receiverName=dealer["name"] if rng.random() < 0.6 else "",
        receiverPhone=dealer["phone"], receiverAddress=dealer["address"],
        deliveryKm=rng.choice(["", "", 8, 12, 15, 20, 25, 30, 40, 55, 70, 90]) if rng.random() < 0.3 else "",
        region=dealer["tinh"] if rng.random() < 0.5 else "",
        discountPercent=discount, depositAmount=deposit, shippingFee=0,
        warehouseReceiptDeduction=0,
        items=items,
        requirements=[dict(code=c, questionText=q,
                           answer=rng.choice(["Có", "Không", "", "Đã trừ khe hở", "Chưa"]),
                           note="", sortOrder=i + 1)
                      for i, (c, q) in enumerate(DEFAULT_REQ)])


DEFAULT_REQ = [
    ("NEN_GIAT_CAP", "Nền có giật cấp hay không?"),
    ("KICH_THUOC_DA_TRU", "Kích thước đã trừ chưa?"),
    ("PHAO_XI_MANG", "Mép tường có đắp phào xi măng hay không?"),
    ("PHAO_LUX_LEN_TRAN", "Lắp phào LUX: hỏi mép tường lên trần?"),
    ("TUONG_T_HOAC_I", "Có thuộc tường chữ T hoặc I không?"),
    ("CUA_4_CANH_XAC_NHAN_KT", "Cửa 4 cánh xác nhận chiều rộng và cao"),
]

DEALERS = []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1000)
    ap.add_argument("--seed", type=int, default=20260926)
    ap.add_argument("--out", default="payloads.jsonl")
    ap.add_argument("--from-date", default="2026-09-15")
    ap.add_argument("--to-date", default="2026-10-10")
    ap.add_argument("--due-limit", default="2026-10-31")
    a = ap.parse_args()
    rng = random.Random(a.seed)
    global DEALERS
    DEALERS = make_dealers(rng, 70)

    d0 = date.fromisoformat(a.from_date)
    d1 = date.fromisoformat(a.to_date)
    limit = date.fromisoformat(a.due_limit)
    span = (d1 - d0).days

    per_day, per_cust = {}, {}
    orders = []
    for _ in range(a.n):
        while True:                                   # 60% dồn vào tháng 9
            off = int(rng.triangular(0, span, span * (0.42 if rng.random() < 0.6 else 0.85)))
            od = d0 + timedelta(days=off)
            lead = max(8, min(26, int(rng.gauss(17, 3.5))))
            if rng.random() < 0.06:            # ~6% đơn GẤP → hạn sát, dễ thành quá hạn
                lead = rng.randint(5, 9)
            dd = od + timedelta(days=lead)
            if dd <= limit:
                break
        key = od.isoformat()
        per_day[key] = per_day.get(key, 0) + 1
        dl = rng.choice(DEALERS)
        per_cust[dl["code"]] = per_cust.get(dl["code"], 0) + 1
        orders.append(build_order(rng, 0, per_day[key], per_cust[dl["code"]], od, dd))
        DEALERS = DEALERS  # giữ danh sách

    # mã đơn phải duy nhất: sinh lại mã cho các bộ trùng (khác ngày/đại lý thì đã khác)
    seen = set()
    for o in orders:
        assert o["orderCode"] not in seen, f"mã đơn trùng: {o['orderCode']}"
        seen.add(o["orderCode"])

    with open(a.out, "w", encoding="utf-8") as f:
        for o in orders:
            f.write(json.dumps(o, ensure_ascii=False) + "\n")

    n_bo = sum(i["quantity"] for o in orders for i in o["items"])
    n_line = sum(len(o["items"]) for o in orders)
    n_det = sum(len(i["details"]) for o in orders for i in o["items"])
    tong = sum(i["amount"] + sum(d["amount"] for d in i["details"]) for o in orders for i in o["items"])
    print(f"✔ {len(orders)} đơn → {a.out}")
    print(f"  dòng bộ cửa      : {n_line}")
    print(f"  TỔNG BỘ          : {n_bo}  (TB {n_bo/len(orders):.2f} bộ/đơn)")
    print(f"  hàng kèm         : {n_det}")
    print(f"  tổng giá trị     : {tong/1e9:.2f} tỷ đồng")
    print(f"  đơn nháp         : {sum(1 for o in orders if o['status']=='NHAP')}")
    print(f"  loại đơn         : " + str({t: sum(1 for o in orders if o['orderType']==t)
                                        for t in ('SAN_XUAT','MAU','LAM_LAI')}))
    print(f"  ngày đặt         : {min(o['orderDate'] for o in orders)} → {max(o['orderDate'] for o in orders)}")
    print(f"  ngày giao        : {min(o['requiredDeliveryDate'] for o in orders)} → {max(o['requiredDeliveryDate'] for o in orders)}")


if __name__ == "__main__":
    main()
