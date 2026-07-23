import {
  APARTMENT_STATUSES,
  DEFAULT_SETTINGS,
  MONTHS,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABELS,
  USER_STATUSES,
  USER_STATUS_LABELS,
} from "../config/constants.js";

export const currencyFormatter = new Intl.NumberFormat("ar-EG", {
  style: "currency",
  currency: "EGP",
  maximumFractionDigits: 2,
});

export const dateFormatter = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export const dateTimeFormatter = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const naturalCollator = new Intl.Collator("ar", {
  numeric: true,
  sensitivity: "base",
});

export function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

export function getApartmentResidentName(apartment) {
  return String(apartment?.residentName || apartment?.tenantName || apartment?.ownerName || "").trim();
}

export function compareTextAsc(firstValue, secondValue) {
  return naturalCollator.compare(String(firstValue ?? "").trim(), String(secondValue ?? "").trim());
}

export function compareDateAsc(firstValue, secondValue) {
  const firstDate = asDate(firstValue);
  const secondDate = asDate(secondValue);

  if (!firstDate && !secondDate) {
    return 0;
  }

  if (!firstDate) {
    return -1;
  }

  if (!secondDate) {
    return 1;
  }

  return firstDate.getTime() - secondDate.getTime();
}

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "");
}

export function normalizePhone(value) {
  return String(value || "").replace(/\D+/g, "");
}

export function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function asDate(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
}

export function formatDate(value) {
  const date = asDate(value);
  return date ? dateFormatter.format(date) : "-";
}

export function formatDateTime(value) {
  const date = asDate(value);
  return date ? dateTimeFormatter.format(date) : "-";
}

export function formatMonthYear(month, year) {
  return `${MONTHS[Number(month) - 1] || month} ${year}`;
}

export function getApartmentStatusMeta(status) {
  return APARTMENT_STATUSES.find((item) => item.value === status) || APARTMENT_STATUSES[0];
}

export function getApartmentStatusBadge(status) {
  const meta = getApartmentStatusMeta(status);
  const className =
    status === "occupied"
      ? "status-dot--occupied"
      : status === "vacant"
        ? "status-dot--vacant"
        : "status-dot--finishing";

  return `<span class="status-dot ${className}"></span>${meta.label}`;
}

export function getPaymentStatusMeta(status) {
  const label = PAYMENT_STATUS_LABELS[status] || "غير معروف";
  const className =
    status === PAYMENT_STATUSES.PAID
      ? "badge-status-paid"
      : status === PAYMENT_STATUSES.PARTIAL || status === PAYMENT_STATUSES.PARTIAL_LATE
        ? "badge-status-partial"
        : status === PAYMENT_STATUSES.LATE
          ? "badge-status-late"
          : "badge-status-unpaid";

  return {
    label,
    className,
  };
}

export function getPaymentMethodLabel(value) {
  return PAYMENT_METHODS.find((item) => item.value === value)?.label || value || "-";
}

export function getUserStatusMeta(status) {
  const label = USER_STATUS_LABELS[status] || "غير معروف";
  const className =
    status === USER_STATUSES.ACTIVE
      ? "badge-status-paid"
      : status === USER_STATUSES.PENDING
        ? "badge-status-partial"
        : "badge-status-late";

  return { label, className };
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getCurrentMonthYear() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

export function computeChargeStatus(chargeLike, settings = DEFAULT_SETTINGS) {
  const paidAmount = toNumber(chargeLike.paidAmount);
  const totalAmount = toNumber(chargeLike.totalAmount);
  const remainingAmount = Math.max(totalAmount - paidAmount, 0);
  const endDate =
    asDate(chargeLike.dueEndDate) ||
    new Date(Number(chargeLike.year), Number(chargeLike.month) - 1, settings.paymentEndDay);
  const isLate = new Date() > endDate;

  if (remainingAmount <= 0) {
    return PAYMENT_STATUSES.PAID;
  }

  if (paidAmount > 0) {
    return isLate ? PAYMENT_STATUSES.PARTIAL_LATE : PAYMENT_STATUSES.PARTIAL;
  }

  return isLate ? PAYMENT_STATUSES.LATE : PAYMENT_STATUSES.UNPAID;
}

export function createChargeId(apartmentId, month, year) {
  return `${apartmentId}_${year}_${month}`;
}

export function formToObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function toInputDate(value = new Date()) {
  const date = asDate(value) || new Date();
  return date.toISOString().split("T")[0];
}

export function slugifyFileName(value) {
  return String(value || "file")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-");
}

export function getUrlFileName(url) {
  try {
    const parsed = new URL(String(url || "").trim());
    const parts = parsed.pathname.split("/").filter(Boolean);
    return decodeURIComponent(parts.at(-1) || "مرفق");
  } catch {
    return "مرفق";
  }
}

export function isImageUrl(url = "") {
  try {
    const parsed = new URL(String(url || "").trim());
    return /\.(jpg|jpeg|png|webp)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function isValidHttpUrl(url = "") {
  try {
    const parsed = new URL(String(url || "").trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function sumBy(items, selector) {
  return items.reduce((total, item) => total + toNumber(selector(item)), 0);
}

export function uniqueBy(items, selector) {
  const map = new Map();
  items.forEach((item) => {
    map.set(selector(item), item);
  });
  return [...map.values()];
}

export function getAvailableYears(items, selector) {
  const years = new Set();

  items.forEach((item) => {
    const resolvedValue = selector(item);
    const year = Number(resolvedValue);
    if (Number.isFinite(year) && year > 0) {
      years.add(year);
    }
  });

  return [...years].sort((firstYear, secondYear) => firstYear - secondYear);
}

export function buildInternalEmail(username, domain) {
  return `${normalizeUsername(username)}@${domain}`;
}

export function buildLoginIndexDocId(type, value) {
  return `${type}_${value}`;
}
