import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  COLLECTIONS,
  DEFAULT_SETTINGS,
  SETTINGS_DOC_ID,
  USER_ROLES,
  USER_STATUSES,
} from "../config/constants.js";
import {
  asDate,
  computeChargeStatus,
  createChargeId,
  formatMonthYear,
  getApartmentResidentName,
  getUrlFileName,
  isImageUrl,
  normalizeText,
  sumBy,
  toNumber,
} from "../utils/helpers.js";
import {
  requireValue,
  validateApartmentPayload,
  validateAttachmentPayload,
  validateChargeGenerationPayload,
  validateExpensePayload,
  validatePaymentPayload,
  validateResidentPayload,
  validateServicePayload,
} from "../utils/validators.js";
import { db, serverTimestamp } from "./firebase.js";

function withId(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function normalizeAttachmentRecord(item) {
  const attachmentUrl = item.attachmentUrl || item.fileUrl || "";
  return {
    ...item,
    attachmentUrl,
    fileName: item.fileName || getUrlFileName(attachmentUrl),
    isImage: isImageUrl(attachmentUrl),
  };
}

function normalizeApartmentRecord(item) {
  const residentName = getApartmentResidentName(item);
  const assignedServiceIds = Array.isArray(item.assignedServiceIds)
    ? item.assignedServiceIds.filter((serviceId) => typeof serviceId === "string" && serviceId.trim())
    : null;

  return {
    ...item,
    residentName,
    assignedServiceIds,
    searchIndex:
      item.searchIndex ||
      normalizeText([item.apartmentNumber, residentName, item.phone].join(" ")),
  };
}

function collectionRef(name) {
  return collection(db, name);
}

function docRef(name, id) {
  return doc(db, name, id);
}

async function commitBatchOperations(operations) {
  if (!operations.length) {
    return;
  }

  let batch = writeBatch(db);
  let count = 0;
  const commits = [];

  const flush = () => {
    if (!count) {
      return;
    }

    commits.push(batch.commit());
    batch = writeBatch(db);
    count = 0;
  };

  operations.forEach((operation) => {
    operation(batch);
    count += 1;

    if (count >= 400) {
      flush();
    }
  });

  flush();
  await Promise.all(commits);
}

export async function ensureSettingsDocument() {
  const settingsReference = docRef(COLLECTIONS.SETTINGS, SETTINGS_DOC_ID);
  const snapshot = await getDoc(settingsReference);

  if (!snapshot.exists()) {
    await setDoc(settingsReference, {
      ...DEFAULT_SETTINGS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return DEFAULT_SETTINGS;
  }

  return { ...DEFAULT_SETTINGS, ...snapshot.data() };
}

export async function fetchAppData(currentUser = null) {
  const isAdmin = currentUser?.role === USER_ROLES.ADMIN;
  const [
    users,
    apartments,
    residents,
    services,
    monthlyCharges,
    payments,
    expenses,
    treasuryTransactions,
    attachments,
    settings,
    activityLogs,
  ] = await Promise.all([
    isAdmin
      ? getDocs(query(collectionRef(COLLECTIONS.USERS), orderBy("createdAt", "desc")))
      : Promise.resolve(null),
    getDocs(query(collectionRef(COLLECTIONS.APARTMENTS), orderBy("apartmentNumber"))),
    getDocs(query(collectionRef(COLLECTIONS.RESIDENTS), orderBy("name"))),
    getDocs(query(collectionRef(COLLECTIONS.SERVICES), orderBy("name"))),
    getDocs(collectionRef(COLLECTIONS.MONTHLY_CHARGES)),
    getDocs(query(collectionRef(COLLECTIONS.PAYMENTS), orderBy("paymentDate", "desc"))),
    getDocs(query(collectionRef(COLLECTIONS.EXPENSES), orderBy("date", "desc"))),
    getDocs(query(collectionRef(COLLECTIONS.TREASURY_TRANSACTIONS), orderBy("date", "desc"))),
    getDocs(query(collectionRef(COLLECTIONS.ATTACHMENTS), orderBy("createdAt", "desc"))),
    getDoc(docRef(COLLECTIONS.SETTINGS, SETTINGS_DOC_ID)),
    isAdmin
      ? getDocs(query(collectionRef(COLLECTIONS.ACTIVITY_LOGS), orderBy("createdAt", "desc"), limit(100)))
      : Promise.resolve(null),
  ]);

  const resolvedSettings = settings.exists() ? { id: settings.id, ...DEFAULT_SETTINGS, ...settings.data() } : DEFAULT_SETTINGS;
  const resolvedCharges = withId(monthlyCharges)
    .filter((item) => !item.isDeleted)
    .map((item) => ({
      ...item,
      status: computeChargeStatus(item, resolvedSettings),
    }))
    .sort((a, b) => {
      if (b.year !== a.year) {
        return b.year - a.year;
      }
      return b.month - a.month;
    });

  return {
    users: users ? withId(users) : [],
    apartments: withId(apartments).map(normalizeApartmentRecord),
    residents: withId(residents),
    services: withId(services),
    monthlyCharges: resolvedCharges,
    payments: withId(payments).filter((item) => !item.isDeleted),
    expenses: withId(expenses).filter((item) => !item.isDeleted),
    treasuryTransactions: withId(treasuryTransactions).filter((item) => !item.isDeleted),
    attachments: withId(attachments)
      .filter((item) => !item.isDeleted)
      .map(normalizeAttachmentRecord),
    settings: resolvedSettings,
    activityLogs: activityLogs ? withId(activityLogs) : [],
  };
}

async function createActivityLog({ action, section, itemId, description, user }) {
  if (!user?.id) {
    return;
  }

  await addDoc(collectionRef(COLLECTIONS.ACTIVITY_LOGS), {
    action,
    section,
    itemId,
    description,
    userId: user.id,
    userName: user.name,
    createdAt: serverTimestamp(),
  });
}

export async function saveApartment(payload, user, apartmentId = null) {
  validateApartmentPayload(payload);

  const apartmentNumber = String(payload.apartmentNumber).trim();
  const apartmentsQuery = query(
    collectionRef(COLLECTIONS.APARTMENTS),
    where("apartmentNumber", "==", apartmentNumber),
  );
  const apartmentsSnapshot = await getDocs(apartmentsQuery);
  const duplicate = apartmentsSnapshot.docs.find((item) => item.id !== apartmentId);

  if (duplicate) {
    throw new Error("رقم الشقة موجود بالفعل.");
  }

  const data = {
    apartmentNumber,
    floor: String(payload.floor).trim(),
    residentName: String(payload.residentName).trim(),
    assignedServiceIds: Array.isArray(payload.assignedServiceIds)
      ? payload.assignedServiceIds.map((serviceId) => String(serviceId).trim()).filter(Boolean)
      : [],
    phone: String(payload.phone || "").trim(),
    status: payload.status,
    notes: String(payload.notes || "").trim(),
    searchIndex: normalizeText(
      [payload.apartmentNumber, payload.residentName, payload.phone].join(" "),
    ),
    isArchived: Boolean(payload.isArchived),
    updatedAt: serverTimestamp(),
  };

  if (apartmentId) {
    await updateDoc(docRef(COLLECTIONS.APARTMENTS, apartmentId), data);
    await createActivityLog({
      action: "تعديل",
      section: "الشقق",
      itemId: apartmentId,
      description: `تم تعديل بيانات الشقة ${apartmentNumber}.`,
      user,
    });
    return apartmentId;
  }

  const reference = await addDoc(collectionRef(COLLECTIONS.APARTMENTS), {
    ...data,
    createdAt: serverTimestamp(),
  });

  await createActivityLog({
    action: "إضافة",
    section: "الشقق",
    itemId: reference.id,
    description: `تمت إضافة الشقة ${apartmentNumber}.`,
    user,
  });

  return reference.id;
}

export async function approvePendingUser(userRecord, approvedBy, apartmentId) {
  requireValue(apartmentId, "الشقة");

  await updateDoc(docRef(COLLECTIONS.USERS, userRecord.id), {
    status: USER_STATUSES.ACTIVE,
    isActive: true,
    apartmentId,
    updatedAt: serverTimestamp(),
  });

  await createActivityLog({
    action: "قبول طلب",
    section: "طلبات التسجيل",
    itemId: userRecord.id,
    description: `تم قبول طلب المستخدم ${userRecord.name} وربطه بالشقة.`,
    user: approvedBy,
  });
}

export async function rejectPendingUser(userRecord, approvedBy) {
  await updateDoc(docRef(COLLECTIONS.USERS, userRecord.id), {
    status: USER_STATUSES.REJECTED,
    isActive: false,
    updatedAt: serverTimestamp(),
  });

  await createActivityLog({
    action: "رفض طلب",
    section: "طلبات التسجيل",
    itemId: userRecord.id,
    description: `تم رفض طلب المستخدم ${userRecord.name}.`,
    user: approvedBy,
  });
}

export async function deleteOrArchiveApartment(apartment, user) {
  const relatedCharges = await getDocs(
    query(collectionRef(COLLECTIONS.MONTHLY_CHARGES), where("apartmentId", "==", apartment.id), limit(1)),
  );

  if (!relatedCharges.empty) {
    await updateDoc(docRef(COLLECTIONS.APARTMENTS, apartment.id), {
      isArchived: true,
      updatedAt: serverTimestamp(),
    });

    await createActivityLog({
      action: "حذف",
      section: "الشقق",
      itemId: apartment.id,
      description: `تم أرشفة الشقة ${apartment.apartmentNumber} لارتباطها بسجلات مالية.`,
      user,
    });

    return { archived: true };
  }

  const residentsSnapshot = await getDocs(
    query(collectionRef(COLLECTIONS.RESIDENTS), where("apartmentId", "==", apartment.id)),
  );
  const batch = writeBatch(db);
  batch.delete(docRef(COLLECTIONS.APARTMENTS, apartment.id));
  residentsSnapshot.docs.forEach((residentDoc) => batch.delete(residentDoc.ref));
  await batch.commit();

  await createActivityLog({
    action: "حذف",
    section: "الشقق",
    itemId: apartment.id,
    description: `تم حذف الشقة ${apartment.apartmentNumber}.`,
    user,
  });

  return { archived: false };
}

export async function saveResident(payload, user, residentId = null) {
  validateResidentPayload(payload);

  const data = {
    apartmentId: payload.apartmentId,
    name: String(payload.name).trim(),
    whatsapp: String(payload.whatsapp || "").trim(),
    hasCar: Boolean(payload.hasCar),
    carType: String(payload.carType || "").trim(),
    carNumber: String(payload.carNumber || "").trim(),
    notes: String(payload.notes || "").trim(),
    searchIndex: normalizeText([payload.name, payload.whatsapp, payload.carNumber].join(" ")),
  };

  if (residentId) {
    await updateDoc(docRef(COLLECTIONS.RESIDENTS, residentId), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    await createActivityLog({
      action: "تعديل",
      section: "السكان",
      itemId: residentId,
      description: `تم تعديل بيانات الساكن ${data.name}.`,
      user,
    });
    return residentId;
  }

  const reference = await addDoc(collectionRef(COLLECTIONS.RESIDENTS), {
    ...data,
    createdAt: serverTimestamp(),
  });
  await createActivityLog({
    action: "إضافة",
    section: "السكان",
    itemId: reference.id,
    description: `تمت إضافة الساكن ${data.name}.`,
    user,
  });
  return reference.id;
}

export async function deleteResident(resident, user) {
  await deleteDoc(docRef(COLLECTIONS.RESIDENTS, resident.id));
  await createActivityLog({
    action: "حذف",
    section: "السكان",
    itemId: resident.id,
    description: `تم حذف الساكن ${resident.name}.`,
    user,
  });
}

export async function saveService(payload, user, serviceId = null) {
  validateServicePayload(payload);

  const data = {
    name: String(payload.name).trim(),
    amount: toNumber(payload.amount),
    isFixed: Boolean(payload.isFixed),
    isEditable: Boolean(payload.isEditable),
    isActive: Boolean(payload.isActive),
    updatedAt: serverTimestamp(),
  };

  if (serviceId) {
    await updateDoc(docRef(COLLECTIONS.SERVICES, serviceId), data);
    await createActivityLog({
      action: "تعديل",
      section: "الخدمات",
      itemId: serviceId,
      description: `تم تعديل خدمة ${data.name}.`,
      user,
    });
    return serviceId;
  }

  const reference = await addDoc(collectionRef(COLLECTIONS.SERVICES), {
    ...data,
    createdAt: serverTimestamp(),
  });

  await createActivityLog({
    action: "إضافة",
    section: "الخدمات",
    itemId: reference.id,
    description: `تمت إضافة خدمة ${data.name}.`,
    user,
  });
  return reference.id;
}

export async function updateServiceState(service, user, isActive) {
  await updateDoc(docRef(COLLECTIONS.SERVICES, service.id), {
    isActive,
    updatedAt: serverTimestamp(),
  });
  await createActivityLog({
    action: "تعديل",
    section: "الخدمات",
    itemId: service.id,
    description: `تم ${isActive ? "تفعيل" : "تعطيل"} خدمة ${service.name}.`,
    user,
  });
}

export async function generateMonthlyCharges(payload, user) {
  validateChargeGenerationPayload(payload);
  const month = Number(payload.month);
  const year = Number(payload.year);
  const settings = await ensureSettingsDocument();

  const [servicesSnapshot, apartmentsSnapshot] = await Promise.all([
    getDocs(query(collectionRef(COLLECTIONS.SERVICES), orderBy("name"))),
    getDocs(query(collectionRef(COLLECTIONS.APARTMENTS), orderBy("apartmentNumber"))),
  ]);

  const activeServices = withId(servicesSnapshot).filter((service) => service.isActive !== false);
  const apartments = withId(apartmentsSnapshot).filter((apartment) => !apartment.isArchived);

  if (!activeServices.length) {
    throw new Error("لا توجد خدمات مفعلة لإنشاء السجلات.");
  }

  if (!apartments.length) {
    throw new Error("لا توجد شقق نشطة لإنشاء السجلات.");
  }

  const dueStartDate = new Date(year, month - 1, settings.paymentStartDay);
  const dueEndDate = new Date(year, month - 1, settings.paymentEndDay, 23, 59, 59);
  const batch = writeBatch(db);
  let createdCount = 0;
  let skippedCount = 0;

  await Promise.all(
    apartments.map(async (apartment) => {
      const chargeId = createChargeId(apartment.id, month, year);
      const chargeReference = docRef(COLLECTIONS.MONTHLY_CHARGES, chargeId);
      const existing = await getDoc(chargeReference);

      if (existing.exists()) {
        return;
      }

      const selectedServiceIds = Array.isArray(apartment.assignedServiceIds)
        ? apartment.assignedServiceIds
        : activeServices.map((service) => service.id);

      const serviceSnapshot = activeServices
        .filter((service) => selectedServiceIds.includes(service.id))
        .map((service) => ({
        serviceId: service.id,
        name: service.name,
        amount: toNumber(service.amount),
        isEditable: Boolean(service.isEditable),
      }));

      if (!serviceSnapshot.length) {
        skippedCount += 1;
        return;
      }

      const totalAmount = sumBy(serviceSnapshot, (service) => service.amount);
      batch.set(chargeReference, {
        apartmentId: apartment.id,
        apartmentNumber: apartment.apartmentNumber,
        month,
        year,
        services: serviceSnapshot,
        totalAmount,
        paidAmount: 0,
        remainingAmount: totalAmount,
        status: computeChargeStatus({ month, year, totalAmount, paidAmount: 0, dueEndDate }, settings),
        dueStartDate,
        dueEndDate,
        lastPaymentDate: null,
        notes: "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      createdCount += 1;
    }),
  );

  if (!createdCount) {
    throw new Error(
      skippedCount
        ? "لا يمكن إنشاء السجلات لأن الشقق الحالية ليس لها خدمات محددة."
        : "السجلات موجودة بالفعل لهذا الشهر.",
    );
  }

  await batch.commit();

  await createActivityLog({
    action: "إضافة",
    section: "التحصيل الشهري",
    itemId: `${year}-${month}`,
    description: `تم إنشاء ${createdCount} سجل خدمات لشهر ${formatMonthYear(month, year)}${skippedCount ? ` مع تخطي ${skippedCount} شقة بدون خدمات محددة` : ""}.`,
    user,
  });

  return { createdCount, skippedCount };
}

export async function registerPayment({ chargeId, amount, paymentMethod, paymentDate, notes, serviceAdjustments = {} }, user) {
  const settings = await ensureSettingsDocument();
  const chargeReference = docRef(COLLECTIONS.MONTHLY_CHARGES, chargeId);

  return runTransaction(db, async (transaction) => {
    const chargeSnapshot = await transaction.get(chargeReference);

    if (!chargeSnapshot.exists()) {
      throw new Error("سجل التحصيل غير موجود.");
    }

    const charge = { id: chargeSnapshot.id, ...chargeSnapshot.data() };
    const adjustedServices = (charge.services || []).map((service) => {
      const overrideValue = serviceAdjustments[service.serviceId];
      if (overrideValue === undefined || overrideValue === null || overrideValue === "") {
        return service;
      }

      if (!service.isEditable) {
        return service;
      }

      const updatedAmount = toNumber(overrideValue);
      if (updatedAmount < 0) {
        throw new Error(`قيمة الخدمة ${service.name} لا يمكن أن تكون سالبة.`);
      }

      return {
        ...service,
        amount: updatedAmount,
      };
    });

    const totalAmount = sumBy(adjustedServices, (service) => service.amount);
    const adjustedRemaining = Math.max(totalAmount - toNumber(charge.paidAmount), 0);
    validatePaymentPayload({ amount, paymentMethod, paymentDate }, adjustedRemaining);

    const paymentAmount = toNumber(amount);
    const paidAmount = toNumber(charge.paidAmount) + paymentAmount;
    const remainingAmount = Math.max(totalAmount - paidAmount, 0);
    const status = computeChargeStatus(
      {
        ...charge,
        totalAmount,
        paidAmount,
        dueEndDate: charge.dueEndDate,
      },
      settings,
    );

    const paymentReference = doc(collectionRef(COLLECTIONS.PAYMENTS));
    const treasuryReference = doc(collectionRef(COLLECTIONS.TREASURY_TRANSACTIONS));
    const logReference = doc(collectionRef(COLLECTIONS.ACTIVITY_LOGS));

    transaction.set(paymentReference, {
      monthlyChargeId: charge.id,
      apartmentId: charge.apartmentId,
      amount: paymentAmount,
      paymentMethod,
      paymentDate: new Date(paymentDate),
      notes: String(notes || "").trim(),
      createdBy: user.id,
      createdByName: user.name,
      createdAt: serverTimestamp(),
    });

    transaction.update(chargeReference, {
      services: adjustedServices,
      totalAmount,
      paidAmount,
      remainingAmount,
      lastPaymentDate: new Date(paymentDate),
      paymentMethod,
      notes: String(notes || charge.notes || "").trim(),
      status,
      updatedAt: serverTimestamp(),
    });

    transaction.set(treasuryReference, {
      date: new Date(paymentDate),
      type: "تحصيل",
      amount: paymentAmount,
      description: `تحصيل من الشقة ${charge.apartmentNumber} عن ${formatMonthYear(charge.month, charge.year)}`,
      sourceType: "payment",
      sourceId: paymentReference.id,
      userId: user.id,
      userName: user.name,
      createdAt: serverTimestamp(),
    });

    transaction.set(logReference, {
      action: "تسجيل دفعة",
      section: "التحصيل الشهري",
      itemId: charge.id,
      description: `تم تسجيل دفعة بقيمة ${paymentAmount} لسجل الشقة ${charge.apartmentNumber}.`,
      userId: user.id,
      userName: user.name,
      createdAt: serverTimestamp(),
    });
  });
}

async function upsertTreasuryTransactionBySource(sourceType, sourceId, data) {
  const snapshot = await getDocs(
    query(collectionRef(COLLECTIONS.TREASURY_TRANSACTIONS), where("sourceType", "==", sourceType), where("sourceId", "==", sourceId), limit(1)),
  );

  if (snapshot.empty) {
    await addDoc(collectionRef(COLLECTIONS.TREASURY_TRANSACTIONS), data);
    return;
  }

  await updateDoc(snapshot.docs[0].ref, data);
}

export async function saveExpense(payload, user, expenseId = null) {
  validateExpensePayload(payload);
  const amount = toNumber(payload.amount);
  const data = {
    title: String(payload.title).trim(),
    amount,
    date: new Date(payload.date),
    category: String(payload.category || "أخرى").trim(),
    recipientName: String(payload.recipientName || "").trim(),
    notes: String(payload.notes || "").trim(),
    createdBy: user.id,
    createdByName: user.name,
    updatedAt: serverTimestamp(),
    isDeleted: false,
  };

  if (expenseId) {
    await updateDoc(docRef(COLLECTIONS.EXPENSES, expenseId), data);
    await upsertTreasuryTransactionBySource("expense", expenseId, {
      date: new Date(payload.date),
      type: "مصروف",
      amount,
      description: data.title,
      sourceType: "expense",
      sourceId: expenseId,
      userId: user.id,
      userName: user.name,
      updatedAt: serverTimestamp(),
      isDeleted: false,
    });
    await createActivityLog({
      action: "تعديل",
      section: "المصروفات",
      itemId: expenseId,
      description: `تم تعديل المصروف ${data.title}.`,
      user,
    });
    return expenseId;
  }

  const reference = await addDoc(collectionRef(COLLECTIONS.EXPENSES), {
    ...data,
    createdAt: serverTimestamp(),
  });
  await addDoc(collectionRef(COLLECTIONS.TREASURY_TRANSACTIONS), {
    date: new Date(payload.date),
    type: "مصروف",
    amount,
    description: data.title,
    sourceType: "expense",
    sourceId: reference.id,
    userId: user.id,
    userName: user.name,
    createdAt: serverTimestamp(),
  });
  await createActivityLog({
    action: "إضافة مصروف",
    section: "المصروفات",
    itemId: reference.id,
    description: `تمت إضافة مصروف ${data.title} بقيمة ${amount}.`,
    user,
  });
  return reference.id;
}

export async function deleteExpense(expense, user) {
  await updateDoc(docRef(COLLECTIONS.EXPENSES, expense.id), {
    isDeleted: true,
    updatedAt: serverTimestamp(),
  });
  await upsertTreasuryTransactionBySource("expense", expense.id, {
    date: asDate(expense.date) || new Date(),
    type: "مصروف",
    amount: toNumber(expense.amount),
    description: expense.title,
    sourceType: "expense",
    sourceId: expense.id,
    userId: user.id,
    userName: user.name,
    updatedAt: serverTimestamp(),
    isDeleted: true,
  });
  await createActivityLog({
    action: "حذف",
    section: "المصروفات",
    itemId: expense.id,
    description: `تم حذف المصروف ${expense.title} مع الاحتفاظ بالسجل.`,
    user,
  });
}

export async function updateOpeningBalance(amount, user) {
  requireValue(amount, "الرصيد الافتتاحي");
  const openingBalance = toNumber(amount);
  await setDoc(
    docRef(COLLECTIONS.SETTINGS, SETTINGS_DOC_ID),
    {
      openingBalance,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  await upsertTreasuryTransactionBySource("opening_balance", SETTINGS_DOC_ID, {
    date: new Date(),
    type: "تعديل رصيد افتتاحي",
    amount: openingBalance,
    description: "تعديل الرصيد الافتتاحي",
    sourceType: "opening_balance",
    sourceId: SETTINGS_DOC_ID,
    userId: user.id,
    userName: user.name,
    updatedAt: serverTimestamp(),
    isDeleted: false,
  });

  await createActivityLog({
    action: "تعديل",
    section: "الخزنة",
    itemId: SETTINGS_DOC_ID,
    description: `تم تعديل الرصيد الافتتاحي إلى ${openingBalance}.`,
    user,
  });
}

export async function saveAttachmentMetadata(payload, user) {
  validateAttachmentPayload(payload);
  const attachmentUrl = String(payload.attachmentUrl).trim();
  const fileName = getUrlFileName(attachmentUrl);
  const reference = await addDoc(collectionRef(COLLECTIONS.ATTACHMENTS), {
    relatedType: payload.relatedType,
    relatedId: payload.relatedId,
    attachmentUrl,
    fileName,
    attachmentType: payload.attachmentType,
    uploadedBy: user.id,
    uploadedByName: user.name,
    createdAt: serverTimestamp(),
  });

  await createActivityLog({
    action: "إضافة مرفق",
    section: "المرفقات",
    itemId: reference.id,
    description: `تمت إضافة رابط مرفق ${fileName}.`,
    user,
  });

  return reference.id;
}

async function resetApartmentsPageData(user) {
  const [apartmentsSnapshot, residentsSnapshot, chargesSnapshot] = await Promise.all([
    getDocs(collectionRef(COLLECTIONS.APARTMENTS)),
    getDocs(collectionRef(COLLECTIONS.RESIDENTS)),
    getDocs(collectionRef(COLLECTIONS.MONTHLY_CHARGES)),
  ]);

  const chargedApartmentIds = new Set(
    withId(chargesSnapshot)
      .filter((item) => !item.isDeleted)
      .map((item) => item.apartmentId),
  );

  const deletableApartmentIds = new Set();
  const operations = [];
  let archivedCount = 0;
  let deletedCount = 0;
  let deletedResidentsCount = 0;

  apartmentsSnapshot.docs.forEach((apartmentDoc) => {
    const apartment = { id: apartmentDoc.id, ...apartmentDoc.data() };

    if (chargedApartmentIds.has(apartment.id)) {
      operations.push((batch) =>
        batch.update(apartmentDoc.ref, {
          isArchived: true,
          updatedAt: serverTimestamp(),
        }),
      );
      archivedCount += 1;
      return;
    }

    operations.push((batch) => batch.delete(apartmentDoc.ref));
    deletableApartmentIds.add(apartment.id);
    deletedCount += 1;
  });

  residentsSnapshot.docs.forEach((residentDoc) => {
    if (!deletableApartmentIds.has(residentDoc.data().apartmentId)) {
      return;
    }

    operations.push((batch) => batch.delete(residentDoc.ref));
    deletedResidentsCount += 1;
  });

  await commitBatchOperations(operations);

  await createActivityLog({
    action: "إعادة تعيين",
    section: "الشقق",
    itemId: "all",
    description: `تمت إعادة تعيين صفحة الشقق. تم أرشفة ${archivedCount} شقة وحذف ${deletedCount} شقة وحذف ${deletedResidentsCount} ساكن مرتبط.`,
    user,
  });

  return { archivedCount, deletedCount, deletedResidentsCount };
}

async function resetResidentsPageData(user) {
  const residentsSnapshot = await getDocs(collectionRef(COLLECTIONS.RESIDENTS));
  const operations = residentsSnapshot.docs.map((residentDoc) => (batch) => batch.delete(residentDoc.ref));

  await commitBatchOperations(operations);

  await createActivityLog({
    action: "إعادة تعيين",
    section: "السكان",
    itemId: "all",
    description: `تمت إعادة تعيين صفحة السكان وحذف ${residentsSnapshot.size} سجل.`,
    user,
  });

  return { deletedCount: residentsSnapshot.size };
}

async function resetServicesPageData(user) {
  const [servicesSnapshot, chargesSnapshot] = await Promise.all([
    getDocs(collectionRef(COLLECTIONS.SERVICES)),
    getDocs(collectionRef(COLLECTIONS.MONTHLY_CHARGES)),
  ]);

  const usedServiceIds = new Set();
  withId(chargesSnapshot)
    .filter((item) => !item.isDeleted)
    .forEach((charge) => {
      (charge.services || []).forEach((service) => {
        if (service.serviceId) {
          usedServiceIds.add(service.serviceId);
        }
      });
    });

  const operations = [];
  let deactivatedCount = 0;
  let deletedCount = 0;

  servicesSnapshot.docs.forEach((serviceDoc) => {
    if (usedServiceIds.has(serviceDoc.id)) {
      operations.push((batch) =>
        batch.update(serviceDoc.ref, {
          isActive: false,
          updatedAt: serverTimestamp(),
        }),
      );
      deactivatedCount += 1;
      return;
    }

    operations.push((batch) => batch.delete(serviceDoc.ref));
    deletedCount += 1;
  });

  await commitBatchOperations(operations);

  await createActivityLog({
    action: "إعادة تعيين",
    section: "الخدمات",
    itemId: "all",
    description: `تمت إعادة تعيين صفحة الخدمات. تم تعطيل ${deactivatedCount} خدمة مرتبطة وحذف ${deletedCount} خدمة غير مرتبطة.`,
    user,
  });

  return { deactivatedCount, deletedCount };
}

async function resetChargesPageData({ month, year }, user) {
  const [chargesSnapshot, paymentsSnapshot, treasurySnapshot, attachmentsSnapshot] = await Promise.all([
    getDocs(collectionRef(COLLECTIONS.MONTHLY_CHARGES)),
    getDocs(collectionRef(COLLECTIONS.PAYMENTS)),
    getDocs(collectionRef(COLLECTIONS.TREASURY_TRANSACTIONS)),
    getDocs(collectionRef(COLLECTIONS.ATTACHMENTS)),
  ]);

  const targetCharges = chargesSnapshot.docs.filter((chargeDoc) => {
    const charge = chargeDoc.data();
    return Number(charge.month) === Number(month) && Number(charge.year) === Number(year) && !charge.isDeleted;
  });

  const chargeIds = new Set(targetCharges.map((chargeDoc) => chargeDoc.id));
  const targetPayments = paymentsSnapshot.docs.filter((paymentDoc) => {
    const payment = paymentDoc.data();
    return chargeIds.has(payment.monthlyChargeId) && !payment.isDeleted;
  });
  const paymentIds = new Set(targetPayments.map((paymentDoc) => paymentDoc.id));

  const targetTreasury = treasurySnapshot.docs.filter((transactionDoc) => {
    const transaction = transactionDoc.data();
    return transaction.sourceType === "payment" && paymentIds.has(transaction.sourceId) && !transaction.isDeleted;
  });

  const targetAttachments = attachmentsSnapshot.docs.filter((attachmentDoc) => {
    const attachment = attachmentDoc.data();
    return (
      (attachment.relatedType === "charge" && chargeIds.has(attachment.relatedId)) ||
      (attachment.relatedType === "payment" && paymentIds.has(attachment.relatedId))
    );
  });

  const operations = [
    ...targetCharges.map((chargeDoc) => (batch) =>
      batch.update(chargeDoc.ref, {
        isDeleted: true,
        updatedAt: serverTimestamp(),
      })),
    ...targetPayments.map((paymentDoc) => (batch) =>
      batch.update(paymentDoc.ref, {
        isDeleted: true,
        updatedAt: serverTimestamp(),
      })),
    ...targetTreasury.map((transactionDoc) => (batch) =>
      batch.update(transactionDoc.ref, {
        isDeleted: true,
        updatedAt: serverTimestamp(),
      })),
    ...targetAttachments.map((attachmentDoc) => (batch) =>
      batch.update(attachmentDoc.ref, {
        isDeleted: true,
        updatedAt: serverTimestamp(),
      })),
  ];

  await commitBatchOperations(operations);

  await createActivityLog({
    action: "إعادة تعيين",
    section: "التحصيل الشهري",
    itemId: `${year}-${month}`,
    description: `تمت إعادة تعيين صفحة التحصيل لشهر ${formatMonthYear(month, year)}. تم إخفاء ${targetCharges.length} سجل و${targetPayments.length} دفعة وحذف ${targetAttachments.length} مرفق.`,
    user,
  });

  return {
    chargesCount: targetCharges.length,
    paymentsCount: targetPayments.length,
    attachmentsCount: targetAttachments.length,
  };
}

async function resetExpensesPageData(user) {
  const [expensesSnapshot, treasurySnapshot, attachmentsSnapshot] = await Promise.all([
    getDocs(collectionRef(COLLECTIONS.EXPENSES)),
    getDocs(collectionRef(COLLECTIONS.TREASURY_TRANSACTIONS)),
    getDocs(collectionRef(COLLECTIONS.ATTACHMENTS)),
  ]);

  const targetExpenses = expensesSnapshot.docs.filter((expenseDoc) => !expenseDoc.data().isDeleted);
  const expenseIds = new Set(targetExpenses.map((expenseDoc) => expenseDoc.id));
  const targetTreasury = treasurySnapshot.docs.filter((transactionDoc) => {
    const transaction = transactionDoc.data();
    return transaction.sourceType === "expense" && expenseIds.has(transaction.sourceId) && !transaction.isDeleted;
  });
  const targetAttachments = attachmentsSnapshot.docs.filter(
    (attachmentDoc) => attachmentDoc.data().relatedType === "expense" && expenseIds.has(attachmentDoc.data().relatedId),
  );

  const operations = [
    ...targetExpenses.map((expenseDoc) => (batch) =>
      batch.update(expenseDoc.ref, {
        isDeleted: true,
        updatedAt: serverTimestamp(),
      })),
    ...targetTreasury.map((transactionDoc) => (batch) =>
      batch.update(transactionDoc.ref, {
        isDeleted: true,
        updatedAt: serverTimestamp(),
      })),
    ...targetAttachments.map((attachmentDoc) => (batch) =>
      batch.update(attachmentDoc.ref, {
        isDeleted: true,
        updatedAt: serverTimestamp(),
      })),
  ];

  await commitBatchOperations(operations);

  await createActivityLog({
    action: "إعادة تعيين",
    section: "المصروفات",
    itemId: "all",
    description: `تمت إعادة تعيين صفحة المصروفات. تم إخفاء ${targetExpenses.length} مصروف وحذف ${targetAttachments.length} مرفق مرتبط.`,
    user,
  });

  return { expensesCount: targetExpenses.length, attachmentsCount: targetAttachments.length };
}

async function resetAttachmentsPageData(user) {
  const attachmentsSnapshot = await getDocs(collectionRef(COLLECTIONS.ATTACHMENTS));
  const targetAttachments = attachmentsSnapshot.docs.filter((attachmentDoc) => !attachmentDoc.data().isDeleted);
  const operations = targetAttachments.map((attachmentDoc) => (batch) =>
    batch.update(attachmentDoc.ref, {
      isDeleted: true,
      updatedAt: serverTimestamp(),
    }),
  );

  await commitBatchOperations(operations);

  await createActivityLog({
    action: "إعادة تعيين",
    section: "المرفقات",
    itemId: "all",
    description: `تمت إعادة تعيين صفحة المرفقات وإخفاء ${targetAttachments.length} مرفق.`,
    user,
  });

  return { deletedCount: targetAttachments.length };
}

export async function resetPageData(page, context, user) {
  switch (page) {
    case "apartments":
      return resetApartmentsPageData(user);
    case "residents":
      return resetResidentsPageData(user);
    case "services":
      return resetServicesPageData(user);
    case "charges":
      return resetChargesPageData(context || {}, user);
    case "expenses":
      return resetExpensesPageData(user);
    case "attachments":
      return resetAttachmentsPageData(user);
    default:
      throw new Error("هذه الصفحة لا تدعم إعادة التعيين.");
  }
}
