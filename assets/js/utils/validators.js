import { normalizePhone, normalizeUsername, toNumber, isValidHttpUrl } from "./helpers.js";

export function requireValue(value, label) {
  if (!String(value || "").trim()) {
    throw new Error(`حقل "${label}" مطلوب.`);
  }
}

export function validateNonNegativeAmount(value, label = "المبلغ") {
  const amount = toNumber(value);
  if (amount < 0) {
    throw new Error(`${label} لا يمكن أن يكون سالبًا.`);
  }
  return amount;
}

export function validatePositiveAmount(value, label = "المبلغ") {
  const amount = toNumber(value);
  if (amount <= 0) {
    throw new Error(`${label} يجب أن يكون أكبر من صفر.`);
  }
  return amount;
}

export function validateApartmentPayload(payload) {
  requireValue(payload.apartmentNumber, "رقم الشقة");
  requireValue(payload.floor, "الدور");
  requireValue(payload.residentName, "اسم الساكن");
  requireValue(payload.status, "حالة الشقة");

  if (payload.assignedServiceIds !== undefined && !Array.isArray(payload.assignedServiceIds)) {
    throw new Error("بيانات الخدمات المحددة للشقة غير صحيحة.");
  }
}

export function validateResidentPayload(payload) {
  requireValue(payload.apartmentId, "الشقة");
  requireValue(payload.name, "اسم الساكن");
  if (payload.hasCar && !payload.carType && !payload.carNumber) {
    throw new Error("أدخل بيانات السيارة أو ألغِ خيار وجود سيارة.");
  }
}

export function validateServicePayload(payload) {
  requireValue(payload.name, "اسم الخدمة");
  validateNonNegativeAmount(payload.amount, "قيمة الخدمة");
}

export function validateChargeGenerationPayload(payload) {
  requireValue(payload.month, "الشهر");
  requireValue(payload.year, "السنة");
}

export function validatePaymentPayload(payload, remainingAmount) {
  validatePositiveAmount(payload.amount, "قيمة الدفعة");
  requireValue(payload.paymentMethod, "طريقة الدفع");
  requireValue(payload.paymentDate, "تاريخ الدفع");

  if (toNumber(payload.amount) > toNumber(remainingAmount)) {
    throw new Error("قيمة الدفعة أكبر من المبلغ المتبقي.");
  }
}

export function validateExpensePayload(payload) {
  requireValue(payload.title, "وصف المصروف");
  validatePositiveAmount(payload.amount, "مبلغ المصروف");
  requireValue(payload.date, "تاريخ المصروف");
}

export function validateAttachmentPayload(payload) {
  requireValue(payload.relatedType, "نوع الارتباط");
  requireValue(payload.relatedId, "العنصر المرتبط");
  requireValue(payload.attachmentType, "نوع المرفق");
  requireValue(payload.attachmentUrl, "رابط المرفق");

  if (!isValidHttpUrl(payload.attachmentUrl)) {
    throw new Error("رابط المرفق يجب أن يكون رابطًا صحيحًا يبدأ بـ http أو https.");
  }
}

export function validateSignupPayload(payload) {
  requireValue(payload.name, "الاسم بالكامل");
  requireValue(payload.username, "اسم المستخدم");
  requireValue(payload.phone, "رقم الموبايل");
  requireValue(payload.password, "كلمة المرور");
  requireValue(payload.confirmPassword, "تأكيد كلمة المرور");

  const username = normalizeUsername(payload.username);
  const phone = normalizePhone(payload.phone);

  if (username.length < 4) {
    throw new Error("اسم المستخدم يجب أن يكون 4 أحرف على الأقل.");
  }

  if (phone.length < 10) {
    throw new Error("رقم الموبايل غير صحيح.");
  }

  if (String(payload.password).length < 6) {
    throw new Error("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
  }

  if (payload.password !== payload.confirmPassword) {
    throw new Error("تأكيد كلمة المرور غير مطابق.");
  }
}
