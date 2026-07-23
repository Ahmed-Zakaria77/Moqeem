import { APP_NAME, USER_ROLES } from "./config/constants.js";
import {
  createPendingUserAccount,
  getCurrentUserProfile,
  loginWithUsername,
  logout,
  subscribeToAuth,
} from "./services/auth-service.js";
import {
  approvePendingUser,
  deleteExpense,
  deleteOrArchiveApartment,
  deleteResident,
  ensureSettingsDocument,
  fetchAppData,
  generateMonthlyCharges,
  rejectPendingUser,
  registerPayment,
  resetPageData,
  saveApartment,
  saveAttachmentMetadata,
  saveExpense,
  saveResident,
  saveService,
  updateOpeningBalance,
  updateServiceState,
} from "./services/data-service.js";
import { isFirebaseConfigured } from "./services/firebase.js";
import { formToObject, formatMonthYear, getCurrentMonthYear, getPaymentMethodLabel, toNumber } from "./utils/helpers.js";
import {
  buildApartmentSummaryText,
  getApartmentDetails,
  getApartmentForm,
  getApartmentStatementPrintDocument,
  renderMyApartmentSection,
  renderApartmentsSection,
} from "./ui/apartments-ui.js";
import { getAttachmentForm, renderAttachmentsSection } from "./ui/attachments-ui.js";
import {
  buildChargeSummaryText,
  getChargeDetails,
  getChargePrintDocument,
  getGenerateChargesForm,
  getPaymentForm,
  renderChargesSection,
} from "./ui/charges-ui.js";
import { renderDashboard } from "./ui/dashboard-ui.js";
import { getExpenseForm, renderExpensesSection } from "./ui/expenses-ui.js";
import {
  animatePageTransition,
  clearAlert,
  closeModal,
  hideGlobalLoader,
  initLayout,
  openConfirm,
  openModal,
  renderSidebarNav,
  setButtonLoading,
  setPageMeta,
  showGlobalLoader,
  showAlert,
  withGlobalLoader,
} from "./ui/layout.js";
import { renderLogsSection } from "./ui/logs-ui.js";
import { getResidentForm, renderResidentsSection } from "./ui/residents-ui.js";
import { getApproveRequestForm, renderRequestsSection } from "./ui/requests-ui.js";
import { AVATAR_PRESETS, getAvatarPresetById, getAvatarSettingsForm, getDefaultAvatarPresetId } from "./ui/profile-ui.js";
import { searchApartments, renderSearchResults } from "./ui/search-ui.js";
import { getServiceForm, renderServicesSection } from "./ui/services-ui.js";
import { getOpeningBalanceForm, renderTreasurySection } from "./ui/treasury-ui.js";

const currentPeriod = getCurrentMonthYear();

const state = {
  route: window.location.hash.replace("#", "") || "dashboard",
  user: null,
  data: {
    users: [],
    apartments: [],
    residents: [],
    services: [],
    monthlyCharges: [],
    payments: [],
    expenses: [],
    treasuryTransactions: [],
    attachments: [],
    activityLogs: [],
    settings: {},
  },
  filters: {
    apartments: {
      floor: "",
      status: "",
    },
    charges: {
      month: currentPeriod.month,
      year: currentPeriod.year,
      status: "",
    },
    treasury: {
      year: currentPeriod.year,
      month: "",
    },
  },
  modalContext: null,
  authMode: "login",
  authFlow: null,
  initialAuthResolved: false,
};

const refs = {
  authView: document.getElementById("auth-view"),
  appView: document.getElementById("app-view"),
  loginForm: document.getElementById("login-form"),
  registerForm: document.getElementById("register-form"),
  authFeedback: document.getElementById("auth-feedback"),
  loginButton: document.getElementById("login-button"),
  registerButton: document.getElementById("register-button"),
  alerts: document.getElementById("alerts-container"),
  content: document.getElementById("content"),
  sidebarNav: document.getElementById("sidebar-nav"),
  sidebarUserAvatar: document.getElementById("sidebar-user-avatar"),
  sidebarUserName: document.getElementById("sidebar-user-name"),
  sidebarUserRole: document.getElementById("sidebar-user-role"),
  setupAlert: document.getElementById("setup-alert"),
  searchInput: document.getElementById("global-search-input"),
  searchResults: document.getElementById("search-results"),
  sidebar: document.getElementById("sidebar"),
  authModeButtons: document.querySelectorAll("[data-auth-mode]"),
};

function getRoleLabel(role) {
  return role === USER_ROLES.ADMIN ? "أدمن" : "مستخدم";
}

function getAvatarStorageKey(userId) {
  return `tower-avatar-preset:${userId}`;
}

function getSavedAvatarPresetId(user) {
  if (!user) {
    return getDefaultAvatarPresetId();
  }

  try {
    return localStorage.getItem(getAvatarStorageKey(user.id)) || user.avatarPreset || getDefaultAvatarPresetId();
  } catch {
    return user.avatarPreset || getDefaultAvatarPresetId();
  }
}

function applySidebarAvatar(user) {
  if (!refs.sidebarUserAvatar || !user) {
    return;
  }

  const preset = getAvatarPresetById(getSavedAvatarPresetId(user), user.role);
  refs.sidebarUserAvatar.className = `user-avatar user-avatar--button ${preset.className}`;
  refs.sidebarUserAvatar.innerHTML = `<i class="${preset.icon}"></i>`;
  refs.sidebarUserAvatar.setAttribute("aria-label", `تخصيص أيقونة الحساب. الشكل الحالي: ${preset.label}`);
  refs.sidebarUserAvatar.setAttribute("title", `تخصيص أيقونة الحساب - ${preset.label}`);
}

function translateAppError(errorOrMessage, fallback = "حدث خطأ غير متوقع. حاول مرة أخرى.") {
  const message = typeof errorOrMessage === "string" ? errorOrMessage : errorOrMessage?.message || "";
  const code = typeof errorOrMessage === "string" ? "" : errorOrMessage?.code || "";
  const normalized = String(message || "").trim();
  const lowerMessage = normalized.toLowerCase();
  const lowerCode = String(code || "").toLowerCase();

  if (!normalized && !lowerCode) {
    return fallback;
  }

  if (lowerCode.includes("permission-denied") || lowerMessage.includes("missing or insufficient permissions")) {
    return "ليس لديك صلاحية لتنفيذ هذه العملية.";
  }

  if (lowerCode.includes("network-request-failed") || lowerMessage.includes("offline") || lowerMessage.includes("network")) {
    return "تعذر الاتصال بالإنترنت. تأكد من الشبكة ثم حاول مرة أخرى.";
  }

  if (lowerCode.includes("invalid-credential") || lowerCode.includes("wrong-password")) {
    return "اسم المستخدم أو كلمة المرور غير صحيحة.";
  }

  if (lowerCode.includes("email-already-in-use")) {
    return "اسم المستخدم مستخدم بالفعل.";
  }

  if (lowerCode.includes("too-many-requests")) {
    return "تمت محاولات كثيرة. حاول مرة أخرى بعد قليل.";
  }

  if (lowerMessage.includes("cannot read properties") || lowerMessage.includes("undefined")) {
    return "تعذر إكمال العملية بسبب نقص في بعض البيانات. أعد تحميل الصفحة ثم حاول مرة أخرى.";
  }

  if (lowerMessage.includes("is not defined")) {
    return "حدث خطأ داخلي في الصفحة. أعد تحميل الصفحة ثم حاول مرة أخرى.";
  }

  if (lowerMessage.includes("popup") || lowerMessage.includes("blocked")) {
    return "تعذر فتح النافذة المطلوبة. تأكد من السماح بالنوافذ المنبثقة ثم حاول مرة أخرى.";
  }

  return normalized || fallback;
}

function translateAuthError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) {
    return "اسم المستخدم أو كلمة المرور غير صحيحة.";
  }
  if (code.includes("email-already-in-use")) {
    return "اسم المستخدم أو البريد الداخلي مستخدم بالفعل.";
  }
  if (code.includes("too-many-requests")) {
    return "تمت محاولات كثيرة. حاول مرة أخرى بعد قليل.";
  }
  if (code.includes("network-request-failed")) {
    return "تعذر الاتصال بالشبكة. تأكد من الاتصال بالإنترنت.";
  }
  return translateAppError(error, "تعذر إكمال تسجيل الدخول. حاول مرة أخرى.");
}

function showAuthMessage(type, message) {
  refs.authFeedback.className = `alert alert-${type}`;
  refs.authFeedback.textContent = message;
  refs.authFeedback.classList.remove("d-none");
}

function showLoginError(message) {
  showAuthMessage("danger", translateAppError(message, "تعذر إكمال تسجيل الدخول. حاول مرة أخرى."));
}

function showAuthSuccess(message) {
  showAuthMessage("success", message);
}

function clearLoginError() {
  refs.authFeedback.classList.add("d-none");
  refs.authFeedback.textContent = "";
  refs.authFeedback.className = "alert d-none";
}

function showMessage(type, message) {
  const resolvedMessage =
    type === "danger" || type === "warning"
      ? translateAppError(message, "تعذر إكمال العملية. حاول مرة أخرى.")
      : message;
  showAlert(refs.alerts, type, resolvedMessage);
}

function hideSearchResults() {
  refs.searchResults.classList.add("d-none");
  refs.searchResults.innerHTML = "";
}

function closeSidebar() {
  refs.sidebar.classList.remove("sidebar--open");
}

function openSidebar() {
  refs.sidebar.classList.add("sidebar--open");
}

function requireAdmin() {
  if (state.user?.role !== USER_ROLES.ADMIN) {
    throw new Error("هذه العملية متاحة للأدمن فقط.");
  }
}

function setAuthMode(mode) {
  state.authMode = mode;
  refs.loginForm.classList.toggle("d-none", mode !== "login");
  refs.registerForm.classList.toggle("d-none", mode !== "register");
  refs.authModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === mode);
  });
  clearLoginError();
}

function getRoute() {
  const route = window.location.hash.replace("#", "") || "dashboard";
  if (["logs", "requests"].includes(route) && state.user?.role !== USER_ROLES.ADMIN) {
    return "dashboard";
  }
  if (route === "my-apartment" && state.user?.role !== USER_ROLES.USER) {
    return "dashboard";
  }
  return route;
}

function renderCurrentRoute() {
  if (!state.user) {
    return;
  }

  state.route = getRoute();
  setPageMeta(state.route);
  refs.sidebarNav.innerHTML = renderSidebarNav(state.route, state.user.role, {
    pendingRequestsCount: state.data.users.filter((item) => item.role === "user" && item.status === "pending").length,
  });
  refs.sidebarUserName.textContent = state.user.name || APP_NAME;
  refs.sidebarUserRole.textContent = getRoleLabel(state.user.role);
  applySidebarAvatar(state.user);

  const renderers = {
    dashboard: renderDashboard,
    "my-apartment": renderMyApartmentSection,
    requests: renderRequestsSection,
    apartments: renderApartmentsSection,
    residents: renderResidentsSection,
    services: renderServicesSection,
    charges: renderChargesSection,
    expenses: renderExpensesSection,
    treasury: renderTreasurySection,
    attachments: renderAttachmentsSection,
    logs: renderLogsSection,
  };

  refs.content.innerHTML = (renderers[state.route] || renderDashboard)(state);
}

function waitForPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

async function renderRouteWithLoader(message = "جارٍ فتح الصفحة...") {
  renderCurrentRoute();
  animatePageTransition();
  await waitForPaint();
}

async function refreshData({ preserveAlert = true, useLoader = true, loadingMessage = "جارٍ تحميل البيانات..." } = {}) {
  const loadData = async () => {
    if (!refs.content.innerHTML.trim()) {
      refs.content.innerHTML = `
        <section class="section-card text-center py-5">
          <p class="mb-0 text-muted">جارٍ تجهيز البيانات...</p>
        </section>
      `;
    }

    const data = await fetchAppData(state.user);
    data.payments = data.payments.map((item) => ({
      ...item,
    }));
    state.data = data;

    if (!preserveAlert) {
      clearAlert(refs.alerts);
    }

    renderCurrentRoute();
  };

  if (useLoader) {
    await withGlobalLoader(loadData, { message: loadingMessage });
    return;
  }

  await loadData();
}

function setAuthenticatedState(isAuthenticated) {
  refs.authView.classList.toggle("d-none", isAuthenticated);
  refs.appView.classList.toggle("d-none", !isAuthenticated);
}

function findApartment(id) {
  return state.data.apartments.find((item) => item.id === id);
}

function findResident(id) {
  return state.data.residents.find((item) => item.id === id);
}

function findService(id) {
  return state.data.services.find((item) => item.id === id);
}

function findCharge(id) {
  return state.data.monthlyCharges.find((item) => item.id === id);
}

function findExpense(id) {
  return state.data.expenses.find((item) => item.id === id);
}

function findUser(id) {
  return state.data.users.find((item) => item.id === id);
}

function findAttachment(id) {
  return state.data.attachments.find((item) => item.id === id);
}

async function writeTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

async function copyTextWithFeedback(text, successMessage) {
  await writeTextToClipboard(text);
  showMessage("success", successMessage);
}

function openAvatarSettings() {
  if (!state.user) {
    return;
  }

  state.modalContext = { type: "avatar-preferences" };
  openModal({
    title: "تخصيص أيقونة الحساب",
    body: getAvatarSettingsForm(getSavedAvatarPresetId(state.user)),
    size: "modal-md",
  });
}

const PAGE_RESET_CONFIG = {
  apartments: {
    confirm: "سيتم إعادة تعيين صفحة الشقق. الشقق المرتبطة بسجلات مالية سيتم أرشفتها، وغير المرتبطة سيتم حذفها. هل تريد المتابعة؟",
    loading: "جارٍ إعادة تعيين بيانات الشقق...",
    success: (result) =>
      `تمت إعادة تعيين صفحة الشقق. تمت أرشفة ${result.archivedCount} شقة وحذف ${result.deletedCount} شقة.`,
  },
  residents: {
    confirm: "سيتم حذف جميع بيانات السكان من هذه الصفحة. هل تريد المتابعة؟",
    loading: "جارٍ إعادة تعيين بيانات السكان...",
    success: (result) => `تم حذف ${result.deletedCount} ساكن من صفحة السكان.`,
  },
  services: {
    confirm: "سيتم حذف الخدمات غير المرتبطة بسجلات قديمة، وتعطيل الخدمات المرتبطة بالسجلات السابقة. هل تريد المتابعة؟",
    loading: "جارٍ إعادة تعيين بيانات الخدمات...",
    success: (result) =>
      `تمت إعادة تعيين صفحة الخدمات. تم تعطيل ${result.deactivatedCount} خدمة وحذف ${result.deletedCount} خدمة.`,
  },
  charges: {
    confirm: () =>
      `سيتم إعادة تعيين بيانات التحصيل لشهر ${formatMonthYear(
        state.filters.charges.month,
        state.filters.charges.year,
      )}، مع إخفاء الدفعات المرتبطة وحذف المرفقات الخاصة بها. هل تريد المتابعة؟`,
    loading: "جارٍ إعادة تعيين بيانات التحصيل الشهري...",
    success: (result) =>
      `تمت إعادة تعيين بيانات التحصيل. تم إخفاء ${result.chargesCount} سجل و${result.paymentsCount} دفعة.`,
  },
  expenses: {
    confirm: "سيتم إخفاء جميع المصروفات من الصفحة الحالية مع الإبقاء على الأثر داخل السجل. هل تريد المتابعة؟",
    loading: "جارٍ إعادة تعيين بيانات المصروفات...",
    success: (result) => `تمت إعادة تعيين صفحة المصروفات وإخفاء ${result.expensesCount} مصروف.`,
  },
  attachments: {
    confirm: "سيتم حذف جميع روابط المرفقات من هذه الصفحة. هل تريد المتابعة؟",
    loading: "جارٍ إعادة تعيين بيانات المرفقات...",
    success: (result) => `تم حذف ${result.deletedCount} مرفق من صفحة المرفقات.`,
  },
};

async function handlePageReset(page) {
  requireAdmin();
  const config = PAGE_RESET_CONFIG[page];

  if (!config) {
    throw new Error("هذه الصفحة لا تدعم إعادة التعيين.");
  }

  const confirmMessage = typeof config.confirm === "function" ? config.confirm() : config.confirm;

  openConfirm(confirmMessage, async () => {
    const context =
      page === "charges"
        ? {
            month: state.filters.charges.month,
            year: state.filters.charges.year,
          }
        : {};

    const result = await withGlobalLoader(
      async () => {
        const response = await resetPageData(page, context, state.user);
        await refreshData({ useLoader: false });
        return response;
      },
      { message: config.loading },
    );

    showMessage("success", config.success(result));
  });
}

function openApartmentDetails(id) {
  const apartment = findApartment(id);
  if (!apartment) {
    showMessage("danger", "تعذر العثور على الشقة.");
    return;
  }

  const residents = state.data.residents.filter((item) => item.apartmentId === apartment.id);
  const charges = state.data.monthlyCharges.filter((item) => item.apartmentId === apartment.id);
  const payments = state.data.payments.filter((item) => item.apartmentId === apartment.id);
  const attachments = state.data.attachments.filter(
    (item) =>
      item.relatedId === apartment.id ||
      charges.some((charge) => charge.id === item.relatedId) ||
      payments.some((payment) => payment.id === item.relatedId),
  );

  openModal({
    title: `تفاصيل الشقة ${apartment.apartmentNumber}`,
    body: getApartmentDetails(
      apartment,
      residents,
      charges,
      payments,
      attachments,
      state.data.services,
      state.user?.role === USER_ROLES.ADMIN,
    ),
  });
}

function openChargeDetails(id) {
  const charge = findCharge(id);
  if (!charge) {
    showMessage("danger", "تعذر العثور على سجل التحصيل.");
    return;
  }
  const apartment = findApartment(charge.apartmentId);

  const payments = state.data.payments
    .filter((item) => item.monthlyChargeId === id)
    .map((item) => ({ ...item, paymentMethod: getPaymentMethodLabel(item.paymentMethod) }));
  const attachments = state.data.attachments.filter(
    (item) => item.relatedId === id || payments.some((payment) => payment.id === item.relatedId),
  );

  openModal({
    title: `تفاصيل التحصيل - شقة ${charge.apartmentNumber}`,
    body: getChargeDetails(charge, payments, attachments, apartment, state.user?.role === USER_ROLES.ADMIN),
  });
}

function printChargeCard(id) {
  requireAdmin();
  const charge = findCharge(id);
  if (!charge) {
    throw new Error("تعذر العثور على سجل التحصيل.");
  }

  const apartment = findApartment(charge.apartmentId);
  const payments = state.data.payments
    .filter((item) => item.monthlyChargeId === id)
    .map((item) => ({ ...item, paymentMethod: getPaymentMethodLabel(item.paymentMethod) }));
  const attachments = state.data.attachments.filter(
    (item) => item.relatedId === id || payments.some((payment) => payment.id === item.relatedId),
  );

  const printWindow = window.open("", "_blank", "width=1100,height=900");
  if (!printWindow) {
    throw new Error("تعذر فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.");
  }

  printWindow.document.open();
  printWindow.document.write(getChargePrintDocument(charge, payments, attachments, apartment));
  printWindow.document.close();
}

function printApartmentStatement(id) {
  requireAdmin();
  const apartment = findApartment(id);
  if (!apartment) {
    throw new Error("تعذر العثور على الشقة.");
  }

  const residents = state.data.residents.filter((item) => item.apartmentId === apartment.id);
  const charges = state.data.monthlyCharges.filter((item) => item.apartmentId === apartment.id);
  const payments = state.data.payments.filter((item) => item.apartmentId === apartment.id);
  const printWindow = window.open("", "_blank", "width=1200,height=900");

  if (!printWindow) {
    throw new Error("تعذر فتح نافذة الطباعة. تأكد من السماح بالنوافذ المنبثقة.");
  }

  printWindow.document.open();
  printWindow.document.write(getApartmentStatementPrintDocument(apartment, residents, charges, payments, state.data.services));
  printWindow.document.close();
}

async function copyApartmentSummary(id) {
  requireAdmin();
  const apartment = findApartment(id);
  if (!apartment) {
    throw new Error("تعذر العثور على الشقة.");
  }

  const residents = state.data.residents.filter((item) => item.apartmentId === apartment.id);
  const charges = state.data.monthlyCharges.filter((item) => item.apartmentId === apartment.id);
  await copyTextWithFeedback(
    buildApartmentSummaryText(apartment, residents, charges, state.data.services),
    "تم نسخ ملخص الشقة بنجاح.",
  );
}

async function copyChargeSummary(id) {
  requireAdmin();
  const charge = findCharge(id);
  if (!charge) {
    throw new Error("تعذر العثور على سجل التحصيل.");
  }

  const apartment = findApartment(charge.apartmentId);
  const payments = state.data.payments.filter((item) => item.monthlyChargeId === charge.id);
  await copyTextWithFeedback(
    buildChargeSummaryText(charge, payments, apartment),
    "تم نسخ بيانات السداد بنجاح.",
  );
}

async function copyAttachmentUrl(id) {
  requireAdmin();
  const attachment = findAttachment(id);
  if (!attachment?.attachmentUrl) {
    throw new Error("تعذر العثور على رابط المرفق.");
  }

  await copyTextWithFeedback(attachment.attachmentUrl, "تم نسخ رابط المرفق بنجاح.");
}

function openApartmentForm(apartment = null) {
  state.modalContext = { type: "apartment", id: apartment?.id || null };
  openModal({
    title: apartment ? `تعديل الشقة ${apartment.apartmentNumber}` : "إضافة شقة",
    body: getApartmentForm(apartment, state.data.services),
  });
}

function openResidentForm(resident = null) {
  state.modalContext = { type: "resident", id: resident?.id || null };
  openModal({
    title: resident ? `تعديل بيانات ${resident.name}` : "إضافة ساكن",
    body: getResidentForm(state.data.apartments, resident),
  });
}

function openServiceForm(service = null) {
  state.modalContext = { type: "service", id: service?.id || null };
  openModal({
    title: service ? `تعديل خدمة ${service.name}` : "إضافة خدمة",
    body: getServiceForm(service),
  });
}

function openExpenseForm(expense = null) {
  state.modalContext = { type: "expense", id: expense?.id || null };
  openModal({
    title: expense ? `تعديل المصروف ${expense.title}` : "إضافة مصروف",
    body: getExpenseForm(expense),
  });
}

function openGenerateChargesForm() {
  requireAdmin();
  state.modalContext = { type: "generate-charges" };
  openModal({
    title: "إنشاء خدمات الشهر",
    body: getGenerateChargesForm(),
    size: "modal-md",
  });
}

function openPaymentForm(charge) {
  requireAdmin();
  state.modalContext = { type: "payment", id: charge.id };
  openModal({
    title: `تسجيل دفعة - شقة ${charge.apartmentNumber}`,
    body: getPaymentForm(charge),
    size: "modal-md",
  });
}

function openOpeningBalanceForm() {
  requireAdmin();
  state.modalContext = { type: "opening-balance" };
  openModal({
    title: "تعديل الرصيد الافتتاحي",
    body: getOpeningBalanceForm(toNumber(state.data.settings.openingBalance)),
    size: "modal-md",
  });
}

function openAttachmentForm() {
  requireAdmin();
  state.modalContext = { type: "attachment" };
  openModal({
    title: "إضافة رابط مرفق",
    body: getAttachmentForm(state),
  });
}

function openApproveRequestForm(userRecord) {
  requireAdmin();
  state.modalContext = { type: "approve-request", id: userRecord.id };
  openModal({
    title: `قبول طلب ${userRecord.name}`,
    body: getApproveRequestForm(userRecord, state.data.apartments),
    size: "modal-md",
  });
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  clearLoginError();

  const usernameValue = String(refs.loginForm.elements.username?.value || "").trim();
  const passwordValue = String(refs.loginForm.elements.password?.value || "").trim();

  if (!usernameValue && !passwordValue) {
    showLoginError("أدخل اسم المستخدم أو رقم الهاتف وكلمة المرور.");
    return;
  }

  if (!usernameValue) {
    showLoginError("أدخل اسم المستخدم أو رقم الهاتف.");
    return;
  }

  if (!passwordValue) {
    showLoginError("أدخل كلمة المرور.");
    return;
  }

  if (!isFirebaseConfigured) {
    showLoginError("أكمل إعداد Firebase أولًا داخل ملف الإعداد.");
    return;
  }

  const formData = formToObject(refs.loginForm);
  setButtonLoading(refs.loginButton, true);

  try {
    await withGlobalLoader(
      () => loginWithUsername(formData.username, formData.password),
      { message: "جارٍ تسجيل الدخول..." },
    );
  } catch (error) {
    showLoginError(translateAuthError(error));
  } finally {
    setButtonLoading(refs.loginButton, false);
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  clearLoginError();

  if (!isFirebaseConfigured) {
    showLoginError("أكمل إعداد Firebase أولًا داخل ملف الإعداد.");
    return;
  }

  const formData = formToObject(refs.registerForm);
  setButtonLoading(refs.registerButton, true);
  state.authFlow = "register";

  try {
    await withGlobalLoader(
      async () => {
        await createPendingUserAccount(formData);
        await logout();
      },
      { message: "جارٍ إنشاء الحساب..." },
    );
    refs.registerForm.reset();
    setAuthMode("login");
    showAuthSuccess("تم إنشاء الحساب بنجاح. حسابك الآن قيد المراجعة، وسيتم تفعيله بعد موافقة الأدمن.");
  } catch (error) {
    await logout().catch(() => {});
    showLoginError(translateAuthError(error));
  } finally {
    state.authFlow = null;
    setButtonLoading(refs.registerButton, false);
  }
}

async function handleAuthState(user) {
  if (state.authFlow === "register") {
    return;
  }

  if (!user) {
    state.user = null;
    setAuthenticatedState(false);
    refs.loginForm.reset();
    hideSearchResults();
    return;
  }

  try {
    const profile = await getCurrentUserProfile(user.uid);

    if (!profile) {
      await logout();
      showLoginError(
        "تم تسجيل الدخول، لكن الحساب غير مهيأ داخل النظام بعد. تواصل مع الأدمن لإكمال الإعداد.",
      );
      return;
    }

    if (!profile.isActive) {
      await logout();
      showLoginError(
        profile.status === "pending"
          ? "تم استلام طلب التسجيل، لكنه ما زال قيد المراجعة من الأدمن."
          : "الحساب موجود لكنه غير مفعل داخل النظام.",
      );
      return;
    }

    state.user = {
      id: profile.id,
      name: profile.name,
      role: profile.role,
      email: profile.email,
      apartmentId: profile.apartmentId || null,
      avatarPreset: profile.avatarPreset || null,
    };

    if (state.user.role === USER_ROLES.ADMIN) {
      await ensureSettingsDocument();
    }

    setAuthenticatedState(true);
    clearLoginError();
    await refreshData({ preserveAlert: false });
  } catch (error) {
    await logout();
    if (error?.code === "permission-denied") {
      showLoginError(
        "تم تسجيل الدخول، لكن لا توجد صلاحية لقراءة بيانات الحساب. تأكد من قواعد Firestore وربط الحساب داخل النظام.",
      );
      return;
    }

    showLoginError(error);
  }
}

async function submitApartmentForm(form) {
  requireAdmin();
  const payload = {
    ...formToObject(form),
    assignedServiceIds: new FormData(form).getAll("assignedServiceIds"),
  };
  await withGlobalLoader(
    async () => {
      await saveApartment(payload, state.user, state.modalContext.id);
      closeModal();
      await refreshData({ useLoader: false });
    },
    { message: state.modalContext.id ? "جارٍ تحديث بيانات الشقة..." : "جارٍ إضافة الشقة..." },
  );
  showMessage("success", `تم ${state.modalContext.id ? "تحديث" : "إضافة"} بيانات الشقة بنجاح.`);
}

async function submitResidentForm(form) {
  requireAdmin();
  const payload = {
    ...formToObject(form),
    hasCar: form.elements.hasCar.checked,
  };
  await withGlobalLoader(
    async () => {
      await saveResident(payload, state.user, state.modalContext.id);
      closeModal();
      await refreshData({ useLoader: false });
    },
    { message: state.modalContext.id ? "جارٍ تحديث بيانات الساكن..." : "جارٍ إضافة الساكن..." },
  );
  showMessage("success", `تم ${state.modalContext.id ? "تحديث" : "إضافة"} بيانات الساكن بنجاح.`);
}

async function submitServiceForm(form) {
  requireAdmin();
  const payload = {
    ...formToObject(form),
    isFixed: form.elements.isFixed.checked,
    isEditable: form.elements.isEditable.checked,
    isActive: form.elements.isActive.checked,
  };
  await withGlobalLoader(
    async () => {
      await saveService(payload, state.user, state.modalContext.id);
      closeModal();
      await refreshData({ useLoader: false });
    },
    { message: state.modalContext.id ? "جارٍ تحديث الخدمة..." : "جارٍ إضافة الخدمة..." },
  );
  showMessage("success", `تم ${state.modalContext.id ? "تحديث" : "إضافة"} الخدمة بنجاح.`);
}

async function submitGenerateChargesForm(form) {
  requireAdmin();
  const payload = formToObject(form);
  const result = await withGlobalLoader(
    async () => {
      const response = await generateMonthlyCharges(payload, state.user);
      closeModal();
      state.filters.charges.month = Number(payload.month);
      state.filters.charges.year = Number(payload.year);
      await refreshData({ useLoader: false });
      window.location.hash = "#charges";
      return response;
    },
    { message: "جارٍ إنشاء خدمات الشهر..." },
  );
  showMessage(
    "success",
    `تم إنشاء ${result.createdCount} سجل خدمات للشهر المحدد${result.skippedCount ? `، مع تخطي ${result.skippedCount} شقة بدون خدمات محددة` : ""}.`,
  );
}

async function submitPaymentForm(form) {
  requireAdmin();
  const payload = formToObject(form);
  const serviceAdjustments = Object.fromEntries(
    Object.entries(payload)
      .filter(([key]) => key.startsWith("serviceAmount__"))
      .map(([key, value]) => [key.replace("serviceAmount__", ""), value]),
  );
  await withGlobalLoader(
    async () => {
      await registerPayment(
        {
          chargeId: state.modalContext.id,
          amount: payload.amount,
          paymentMethod: payload.paymentMethod,
          paymentDate: payload.paymentDate,
          notes: payload.notes,
          serviceAdjustments,
        },
        state.user,
      );
      closeModal();
      await refreshData({ useLoader: false });
    },
    { message: "جارٍ تسجيل الدفعة..." },
  );
  showMessage("success", "تم تسجيل الدفعة بنجاح.");
}

async function submitExpenseForm(form) {
  requireAdmin();
  const payload = formToObject(form);
  await withGlobalLoader(
    async () => {
      await saveExpense(payload, state.user, state.modalContext.id);
      closeModal();
      await refreshData({ useLoader: false });
    },
    { message: state.modalContext.id ? "جارٍ تحديث المصروف..." : "جارٍ إضافة المصروف..." },
  );
  showMessage("success", `تم ${state.modalContext.id ? "تحديث" : "إضافة"} المصروف بنجاح.`);
}

async function submitOpeningBalanceForm(form) {
  requireAdmin();
  const payload = formToObject(form);
  await withGlobalLoader(
    async () => {
      await updateOpeningBalance(payload.openingBalance, state.user);
      closeModal();
      await refreshData({ useLoader: false });
    },
    { message: "جارٍ تحديث الرصيد الافتتاحي..." },
  );
  showMessage("success", "تم تحديث الرصيد الافتتاحي بنجاح.");
}

async function submitAttachmentForm(form) {
  requireAdmin();
  const relation = String(form.elements.relatedReference.value || "");
  const [relatedType, relatedId] = relation.split("::");
  await withGlobalLoader(
    async () => {
      await saveAttachmentMetadata(
        {
          relatedType,
          relatedId,
          attachmentType: form.elements.attachmentType.value,
          attachmentUrl: form.elements.attachmentUrl.value,
        },
        state.user,
      );
      closeModal();
      await refreshData({ useLoader: false });
    },
    { message: "جارٍ حفظ رابط المرفق..." },
  );
  showMessage("success", "تم حفظ رابط المرفق بنجاح.");
}

async function submitApproveRequestForm(form) {
  requireAdmin();
  const payload = formToObject(form);
  const userRecord = findUser(state.modalContext.id);
  if (!userRecord) {
    throw new Error("تعذر العثور على طلب التسجيل.");
  }

  await withGlobalLoader(
    async () => {
      await approvePendingUser(userRecord, state.user, payload.apartmentId);
      closeModal();
      await refreshData({ useLoader: false });
    },
    { message: "جارٍ تفعيل الحساب..." },
  );
  showMessage("success", "تم قبول الطلب وتفعيل الحساب وربطه بالشقة.");
}

async function submitAvatarPreferencesForm(form) {
  if (!state.user) {
    throw new Error("يجب تسجيل الدخول أولًا.");
  }

  const presetId = String(form.elements.avatarPreset?.value || "").trim();
  if (!AVATAR_PRESETS.some((item) => item.id === presetId)) {
    throw new Error("اختر شكلًا صحيحًا للأيقونة.");
  }

  try {
    localStorage.setItem(getAvatarStorageKey(state.user.id), presetId);
  } catch {
    throw new Error("تعذر حفظ اختيار الأيقونة على هذا الجهاز.");
  }

  applySidebarAvatar(state.user);
  closeModal();
  showMessage("success", "تم تحديث شكل أيقونة الحساب بنجاح.");
}

async function handleActionClick(action, id, page = "") {
  try {
    switch (action) {
      case "open-avatar-settings":
        openAvatarSettings();
        break;
      case "open-generate-charges":
        openGenerateChargesForm();
        break;
      case "page-reset":
        await handlePageReset(page || state.route);
        break;
      case "request-approve": {
        const userRecord = findUser(id);
        if (!userRecord) {
          throw new Error("تعذر العثور على الطلب.");
        }
        openApproveRequestForm(userRecord);
        break;
      }
      case "request-reject": {
        requireAdmin();
        const userRecord = findUser(id);
        if (!userRecord) {
          throw new Error("تعذر العثور على الطلب.");
        }
        openConfirm(`هل تريد رفض طلب التسجيل الخاص بالمستخدم ${userRecord.name}؟`, async () => {
          await withGlobalLoader(
            async () => {
              await rejectPendingUser(userRecord, state.user);
              await refreshData({ useLoader: false });
            },
            { message: "جارٍ رفض الطلب..." },
          );
          showMessage("success", "تم رفض طلب التسجيل.");
        });
        break;
      }
      case "apartment-create":
        openApartmentForm();
        break;
      case "apartment-edit":
        openApartmentForm(findApartment(id));
        break;
      case "apartment-view":
      case "search-open-apartment":
        openApartmentDetails(id);
        hideSearchResults();
        refs.searchInput.value = "";
        break;
      case "apartment-copy-summary":
        await copyApartmentSummary(id);
        break;
      case "apartment-print-statement":
        printApartmentStatement(id);
        break;
      case "apartment-delete": {
        requireAdmin();
        const apartment = findApartment(id);
        if (!apartment) {
          throw new Error("تعذر العثور على الشقة.");
        }
        openConfirm(
          `هل تريد حذف الشقة ${apartment.apartmentNumber}؟ إذا كانت مرتبطة بسجلات مالية فسيتم أرشفتها بدلًا من حذفها نهائيًا.`,
          async () => {
            const result = await withGlobalLoader(
              async () => {
                const response = await deleteOrArchiveApartment(apartment, state.user);
                await refreshData({ useLoader: false });
                return response;
              },
              { message: "جارٍ حذف الشقة..." },
            );
            showMessage("success", result.archived ? "تمت أرشفة الشقة بدلًا من حذفها لوجود سجلات مالية." : "تم حذف الشقة بنجاح.");
          },
        );
        break;
      }
      case "resident-create":
        openResidentForm();
        break;
      case "resident-edit":
        openResidentForm(findResident(id));
        break;
      case "resident-delete": {
        requireAdmin();
        const resident = findResident(id);
        openConfirm(`هل تريد حذف الساكن ${resident?.name || ""}؟`, async () => {
          await withGlobalLoader(
            async () => {
              await deleteResident(resident, state.user);
              await refreshData({ useLoader: false });
            },
            { message: "جارٍ حذف الساكن..." },
          );
          showMessage("success", "تم حذف الساكن.");
        });
        break;
      }
      case "service-create":
        openServiceForm();
        break;
      case "service-edit":
        openServiceForm(findService(id));
        break;
      case "service-toggle": {
        requireAdmin();
        const service = findService(id);
        await withGlobalLoader(
          async () => {
            await updateServiceState(service, state.user, !service.isActive);
            await refreshData({ useLoader: false });
          },
          { message: service.isActive ? "جارٍ تعطيل الخدمة..." : "جارٍ تفعيل الخدمة..." },
        );
        showMessage("success", `تم ${service.isActive ? "تعطيل" : "تفعيل"} الخدمة.`);
        break;
      }
      case "charge-view":
        openChargeDetails(id);
        break;
      case "charge-copy-summary":
        await copyChargeSummary(id);
        break;
      case "charge-print":
        printChargeCard(id);
        break;
      case "charge-payment": {
        const charge = findCharge(id);
        if (!charge) {
          throw new Error("تعذر العثور على السجل.");
        }
        if (toNumber(charge.remainingAmount) <= 0) {
          throw new Error("هذا السجل مسدد بالكامل.");
        }
        openPaymentForm(charge);
        break;
      }
      case "expense-create":
        openExpenseForm();
        break;
      case "expense-edit":
        openExpenseForm(findExpense(id));
        break;
      case "expense-delete": {
        requireAdmin();
        const expense = findExpense(id);
        openConfirm(`هل تريد حذف المصروف ${expense?.title || ""}؟ سيتم الاحتفاظ بالسجل المالي.`, async () => {
          await withGlobalLoader(
            async () => {
              await deleteExpense(expense, state.user);
              await refreshData({ useLoader: false });
            },
            { message: "جارٍ حذف المصروف..." },
          );
          showMessage("success", "تم حذف المصروف مع الاحتفاظ بالسجل المالي.");
        });
        break;
      }
      case "treasury-update-opening":
        openOpeningBalanceForm();
        break;
      case "attachment-create":
        openAttachmentForm();
        break;
      case "attachment-copy-url":
        await copyAttachmentUrl(id);
        break;
      default:
        break;
    }
  } catch (error) {
    showMessage("danger", error.message || "حدث خطأ أثناء تنفيذ العملية.");
  }
}

async function handleDocumentSubmit(event) {
  const { target } = event;
  if (!(target instanceof HTMLFormElement)) {
    return;
  }

  try {
    switch (target.id) {
      case "charges-filter-form": {
        event.preventDefault();
        const payload = formToObject(target);
        state.filters.charges = {
          month: Number(payload.month),
          year: Number(payload.year),
          status: payload.status || "",
        };
        renderCurrentRoute();
        break;
      }
      case "apartments-filter-form": {
        event.preventDefault();
        const payload = formToObject(target);
        state.filters.apartments = {
          floor: payload.floor || "",
          status: payload.status || "",
        };
        renderCurrentRoute();
        break;
      }
      case "treasury-filter-form": {
        event.preventDefault();
        const payload = formToObject(target);
        state.filters.treasury = {
          year: Number(payload.year),
          month: payload.month ? Number(payload.month) : "",
        };
        renderCurrentRoute();
        break;
      }
      case "avatar-preferences-form":
        event.preventDefault();
        await submitAvatarPreferencesForm(target);
        break;
      case "apartment-form":
        event.preventDefault();
        await submitApartmentForm(target);
        break;
      case "resident-form":
        event.preventDefault();
        await submitResidentForm(target);
        break;
      case "service-form":
        event.preventDefault();
        await submitServiceForm(target);
        break;
      case "generate-charges-form":
        event.preventDefault();
        await submitGenerateChargesForm(target);
        break;
      case "payment-form":
        event.preventDefault();
        await submitPaymentForm(target);
        break;
      case "expense-form":
        event.preventDefault();
        await submitExpenseForm(target);
        break;
      case "opening-balance-form":
        event.preventDefault();
        await submitOpeningBalanceForm(target);
        break;
      case "attachment-form":
        event.preventDefault();
        await submitAttachmentForm(target);
        break;
      case "approve-request-form":
        event.preventDefault();
        await submitApproveRequestForm(target);
        break;
      default:
        break;
    }
  } catch (error) {
    showMessage("danger", error.message || "تعذر حفظ البيانات.");
  }
}

function handleSearchInput() {
  const term = refs.searchInput.value;
  if (!term.trim()) {
    hideSearchResults();
    return;
  }

  const results = searchApartments(term, state.data);
  if (!results.length) {
    refs.searchResults.innerHTML = `<div class="p-3 text-muted small">لا توجد نتائج مطابقة.</div>`;
    refs.searchResults.classList.remove("d-none");
    return;
  }

  refs.searchResults.innerHTML = renderSearchResults(results);
  refs.searchResults.classList.remove("d-none");
}

function bindStaticEvents() {
  refs.loginForm.addEventListener("submit", handleLoginSubmit);
  refs.registerForm.addEventListener("submit", handleRegisterSubmit);
  document.getElementById("logout-button").addEventListener("click", async () => {
    await logout();
    clearAlert(refs.alerts);
  });
  document.getElementById("open-sidebar").addEventListener("click", openSidebar);
  document.getElementById("close-sidebar").addEventListener("click", closeSidebar);

  window.addEventListener("hashchange", () => {
    if (!state.user) {
      return;
    }
    renderRouteWithLoader();
    closeSidebar();
  });

  document.addEventListener("click", async (event) => {
    const actionElement = event.target.closest("[data-action]");
    if (actionElement) {
      event.preventDefault();
      await handleActionClick(actionElement.dataset.action, actionElement.dataset.id, actionElement.dataset.page);
      return;
    }

    if (!event.target.closest(".search-box")) {
      hideSearchResults();
    }
  });

  refs.authModeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setAuthMode(button.dataset.authMode);
    });
  });

  document.addEventListener("submit", handleDocumentSubmit);
  refs.searchInput.addEventListener("input", handleSearchInput);

  window.addEventListener("error", (event) => {
    if (!event.error && !event.message) {
      return;
    }

    const translatedMessage = translateAppError(event.error || event.message);
    if (state.user) {
      showMessage("danger", translatedMessage);
      return;
    }

    showLoginError(translatedMessage);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const translatedMessage = translateAppError(event.reason);
    if (state.user) {
      showMessage("danger", translatedMessage);
      return;
    }

    showLoginError(translatedMessage);
  });
}

function initialize() {
  initLayout();
  setAuthMode("login");
  bindStaticEvents();

  if (!isFirebaseConfigured) {
    refs.setupAlert.classList.remove("d-none");
    setAuthenticatedState(false);
    hideGlobalLoader();
    return;
  }

  showGlobalLoader("جارٍ التحقق من الجلسة...");
  subscribeToAuth(async (user) => {
    await handleAuthState(user);

    if (!state.initialAuthResolved) {
      state.initialAuthResolved = true;
      hideGlobalLoader();
    }
  });
}

initialize();
