export const APP_NAME = "برج الشعراوي";
export const INTERNAL_AUTH_DOMAIN = "tower.local";

export const USER_ROLES = {
  ADMIN: "admin",
  USER: "user",
};

export const USER_STATUSES = {
  PENDING: "pending",
  ACTIVE: "active",
  REJECTED: "rejected",
};

export const USER_STATUS_LABELS = {
  [USER_STATUSES.PENDING]: "قيد المراجعة",
  [USER_STATUSES.ACTIVE]: "مفعل",
  [USER_STATUSES.REJECTED]: "مرفوض",
};

export const APARTMENT_STATUSES = [
  { value: "occupied", label: "ساكن" },
  { value: "vacant", label: "فاضية" },
  { value: "finishing", label: "تحت التشطيب" },
];

export const PAYMENT_METHODS = [
  { value: "cash", label: "كاش" },
  { value: "wallet", label: "محفظة إلكترونية" },
  { value: "instapay", label: "InstaPay" },
];

export const PAYMENT_STATUSES = {
  PAID: "paid",
  PARTIAL: "partial",
  PARTIAL_LATE: "partial_late",
  UNPAID: "unpaid",
  LATE: "late",
};

export const PAYMENT_STATUS_LABELS = {
  [PAYMENT_STATUSES.PAID]: "تم الدفع",
  [PAYMENT_STATUSES.PARTIAL]: "دفع جزئي",
  [PAYMENT_STATUSES.PARTIAL_LATE]: "دفع جزئي ومتأخر",
  [PAYMENT_STATUSES.UNPAID]: "لم يدفع",
  [PAYMENT_STATUSES.LATE]: "متأخر",
};

export const SERVICE_STATE_OPTIONS = [
  { value: true, label: "مفعلة" },
  { value: false, label: "غير مفعلة" },
];

export const ATTACHMENT_TYPES = [
  "إيصال",
  "فاتورة",
  "صورة عداد",
  "عقد",
  "أخرى",
];

export const EXPENSE_CATEGORIES = [
  "صيانة الأسانسير",
  "شراء لمبات",
  "سباك",
  "كهربائي",
  "تنظيف السلم",
  "فاتورة المياه",
  "شحن عداد الكهرباء",
  "صيانة الانترنت",
  "أخرى",
];

export const MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export const NAV_ITEMS = [
  { route: "dashboard", label: "لوحة التحكم", icon: "fa-solid fa-chart-line" },
  { route: "requests", label: "طلبات التسجيل", icon: "fa-solid fa-user-clock", adminOnly: true },
  { route: "apartments", label: "الشقق", icon: "fa-solid fa-building-user" },
  { route: "residents", label: "السكان", icon: "fa-solid fa-people-roof" },
  { route: "services", label: "الخدمات", icon: "fa-solid fa-screwdriver-wrench" },
  { route: "charges", label: "التحصيل الشهري", icon: "fa-solid fa-file-invoice-dollar" },
  { route: "expenses", label: "المصروفات", icon: "fa-solid fa-receipt" },
  { route: "treasury", label: "الخزنة", icon: "fa-solid fa-vault" },
  { route: "attachments", label: "المرفقات", icon: "fa-solid fa-paperclip" },
  { route: "logs", label: "سجل التعديلات", icon: "fa-solid fa-clock-rotate-left", adminOnly: true },
];

export const DEFAULT_SETTINGS = {
  buildingName: APP_NAME,
  openingBalance: 0,
  paymentStartDay: 1,
  paymentEndDay: 7,
};

export const COLLECTIONS = {
  USERS: "users",
  LOGIN_INDEX: "loginIndex",
  APARTMENTS: "apartments",
  RESIDENTS: "residents",
  SERVICES: "services",
  MONTHLY_CHARGES: "monthlyCharges",
  PAYMENTS: "payments",
  EXPENSES: "expenses",
  TREASURY_TRANSACTIONS: "treasuryTransactions",
  ATTACHMENTS: "attachments",
  ACTIVITY_LOGS: "activityLogs",
  SETTINGS: "settings",
};

export const SETTINGS_DOC_ID = "general";
