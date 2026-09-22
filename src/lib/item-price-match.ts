import type { ParsedItemAttribute } from "@/lib/item-attribute-excel";

export type PriceMatchMethod = "MA_HANG" | "TEN_HANG" | "NHOM_GIA_CUA" | "NHOM_GIA_CUA_SO";

export type PriceMatchResult = {
  attribute: ParsedItemAttribute;
  method: PriceMatchMethod;
  priceModelCode: string;
};

type ItemForPriceMatch = {
  code: string;
  name: string;
};

export function buildPriceAttributeIndex(attributes: ParsedItemAttribute[]) {
  return new Map(attributes.map((row) => [normalizeLookup(row.code), row]));
}

export function findItemPriceMatch(
  item: ItemForPriceMatch,
  index: Map<string, ParsedItemAttribute>,
): PriceMatchResult | null {
  const directCode = index.get(normalizeLookup(item.code));
  if (directCode) {
    return { attribute: directCode, method: "MA_HANG", priceModelCode: directCode.code };
  }

  const directName = index.get(normalizeLookup(item.name));
  if (directName) {
    return { attribute: directName, method: "TEN_HANG", priceModelCode: directName.code };
  }

  for (const candidate of buildFamilyCandidates(item)) {
    const attribute = index.get(normalizeLookup(candidate.code));
    if (attribute) {
      return { attribute, method: candidate.method, priceModelCode: attribute.code };
    }
  }

  return null;
}

function buildFamilyCandidates(item: ItemForPriceMatch): Array<{ code: string; method: PriceMatchMethod }> {
  const code = normalizeProductCode(item.code);
  const name = normalizeWords(item.name);
  const result: Array<{ code: string; method: PriceMatchMethod }> = [];
  const push = (candidate: string, method: PriceMatchMethod) => {
    if (!candidate) return;
    if (!result.some((row) => normalizeLookup(row.code) === normalizeLookup(candidate))) {
      result.push({ code: candidate, method });
    }
  };

  // Cửa sổ phải xét trước vì một số mã Luxury không có chữ CS trong mã nhưng tên hàng là Cửa sổ.
  const isWindow = code.startsWith("SVCS") || name.includes("CUA SO");
  if (isWindow) {
    const windowLeafCount = detectWindowLeafCount(code);
    if (windowLeafCount) {
      if (code.includes("PK")) push(`CS${windowLeafCount}-HPK`, "NHOM_GIA_CUA_SO");
      if (code.includes("H10")) push(`CS${windowLeafCount}-H10`, "NHOM_GIA_CUA_SO");
    }
    return result;
  }

  const oneLeaf = code.match(/^SV(?:LUX)?1-(.*)$/);
  if (oneLeaf) {
    const rest = oneLeaf[1];
    if (rest.includes("HTD") || rest === "TD") push("GM1-HTD", "NHOM_GIA_CUA");
    if (rest.includes("HPD")) push("GM1-HPD", "NHOM_GIA_CUA");
    if (rest.includes("PK") || rest.startsWith("P-") || rest === "P") push("GM1-HP", "NHOM_GIA_CUA");

    const huynh = rest.match(/^H([1-8])(?:'|KK)?(?:-|$)/);
    if (huynh) push(`GM1-H${huynh[1]}`, "NHOM_GIA_CUA");
    return result;
  }

  const twoLeaf = code.match(/^SV(?:LUX)?2-(.*)$/);
  if (twoLeaf) {
    const rest = removeDoorBalancePrefix(twoLeaf[1]);

    if (/H5-H9/.test(rest)) push("GM2-H5-H9", "NHOM_GIA_CUA");
    if (/H4.*PK/.test(rest)) push("GM2-H4-HPK", "NHOM_GIA_CUA");
    if (/H3.*PK/.test(rest)) push("GM2-H3-HP", "NHOM_GIA_CUA");
    if (rest.includes("HTD")) push("GM2-HTD", "NHOM_GIA_CUA");
    if (rest.startsWith("PK") || rest.startsWith("P-") || rest === "P") push("GM2-HP", "NHOM_GIA_CUA");

    const huynh = rest.match(/^H([1-8])(?:'|KK)?(?:-|$)/);
    if (huynh) push(`GM2-H${huynh[1]}`, "NHOM_GIA_CUA");
    return result;
  }

  const fourLeaf = code.match(/^SV(?:LUX)?4L?-(.*)$/);
  if (fourLeaf) {
    let rest = removeDoorBalancePrefix(fourLeaf[1]);
    rest = rest.replace(/H4'/g, "H4");

    const firstPanel = detectFourLeafFirstPanel(rest);
    if (!firstPanel) return result;

    const remaining = rest.slice(firstPanel.consumed.length).replace(/^-+/, "");
    let secondPanel = "";
    if (remaining.startsWith("H9")) secondPanel = "H9";
    else if (remaining.startsWith("H1")) secondPanel = "H1";
    else if (remaining.startsWith("PK") || remaining.startsWith("HPK")) secondPanel = "HPK";

    if (!secondPanel) return result;

    let target = `GM4-${firstPanel.target}-${secondPanel}-3TK`;
    // File giá đang dùng tên GM4-H5-H9-TK, không có số 3.
    if (target === "GM4-H5-H9-3TK") target = "GM4-H5-H9-TK";
    push(target, "NHOM_GIA_CUA");
  }

  return result;
}

function detectWindowLeafCount(code: string) {
  const cs = code.match(/^SVCS(?:LUX)?([1-4])/);
  if (cs) return cs[1];

  const lux = code.match(/^SVLUX([1-4])/);
  if (lux) return lux[1];

  return null;
}

function detectFourLeafFirstPanel(rest: string) {
  const candidates: Array<{ source: string; target: string }> = [
    { source: "H4KK", target: "H4K" },
    { source: "H4K", target: "H4K" },
    { source: "H4", target: "H4" },
    { source: "H3", target: "H3" },
    { source: "H2", target: "H2" },
    { source: "H5", target: "H5" },
    { source: "H7", target: "H7" },
    { source: "H8", target: "H8" },
  ];

  return candidates.find((candidate) => rest.startsWith(candidate.source))
    ? (() => {
        const candidate = candidates.find((row) => rest.startsWith(row.source))!;
        return { consumed: candidate.source, target: candidate.target };
      })()
    : null;
}

function removeDoorBalancePrefix(value: string) {
  return value.replace(/^(D|L)-/, "");
}

function normalizeProductCode(value: string) {
  return removeVietnameseMarks(value)
    .toUpperCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeWords(value: string) {
  return removeVietnameseMarks(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLookup(value: string) {
  return removeVietnameseMarks(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .trim();
}

function removeVietnameseMarks(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}
