import { APP_NAME, NAV_ITEMS, USER_ROLES } from "../config/constants.js";

export const ROUTE_META = {
  dashboard: { title: "لوحة التحكم", subtitle: "ملخص الشقق والتحصيل والمصروفات" },
  requests: { title: "طلبات التسجيل", subtitle: "مراجعة الحسابات الجديدة وقبولها أو رفضها" },
  apartments: { title: "إدارة الشقق", subtitle: "إضافة وتعديل وعرض حالة كل شقة" },
  residents: { title: "إدارة السكان", subtitle: "ربط السكان بالشقق ومتابعة بياناتهم" },
  services: { title: "إدارة الخدمات", subtitle: "الخدمات الشهرية المفعلة وقيمها الحالية" },
  charges: { title: "التحصيل الشهري", subtitle: "متابعة السداد وإنشاء خدمات الشهر" },
  expenses: { title: "المصروفات", subtitle: "تسجيل المصروفات والمرفقات المرتبطة بها" },
  treasury: { title: "الخزنة", subtitle: "الرصيد الافتتاحي والحركات والرصيد الحالي" },
  attachments: { title: "المرفقات", subtitle: "روابط المرفقات ومعاينات الصور المرتبطة بالعناصر" },
  logs: { title: "سجل التعديلات", subtitle: "عرض العمليات المهمة داخل النظام" },
};

let appModalInstance = null;
let confirmModalInstance = null;
let confirmCallback = null;
let globalLoaderElement = null;
let globalLoaderTextElement = null;
let globalLoaderCount = 0;

function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

export function initLayout() {
  const appModalElement = document.getElementById("app-modal");
  const confirmModalElement = document.getElementById("confirm-modal");
  globalLoaderElement = document.getElementById("global-loader");
  globalLoaderTextElement = document.getElementById("global-loader-text");

  if (window.bootstrap) {
    appModalInstance = window.bootstrap.Modal.getOrCreateInstance(appModalElement);
    confirmModalInstance = window.bootstrap.Modal.getOrCreateInstance(confirmModalElement);
  }

  document.getElementById("confirm-modal-action").addEventListener("click", async () => {
    if (confirmCallback) {
      await confirmCallback();
      confirmCallback = null;
    }
    confirmModalInstance?.hide();
  });
}

export function renderSidebarNav(activeRoute, role, options = {}) {
  const pendingRequestsCount = Number(options.pendingRequestsCount || 0);

  return NAV_ITEMS.filter((item) => !(item.adminOnly && role !== USER_ROLES.ADMIN))
    .map(
      (item) => {
        const hasPendingRequests = item.route === "requests" && pendingRequestsCount > 0;
        return `
        <a href="#${item.route}" class="nav-link ${activeRoute === item.route ? "active" : ""}" data-route="${item.route}">
          <i class="${item.icon}"></i>
          <span>${item.label}</span>
          ${
            hasPendingRequests
              ? `<span class="nav-notification-badge" title="يوجد ${pendingRequestsCount} طلب ${pendingRequestsCount === 1 ? "جديد" : "جديدة"}">
                  <span class="nav-notification-badge__dot"></span>
                  <span class="nav-notification-badge__count">${pendingRequestsCount}</span>
                </span>`
              : ""
          }
        </a>
      `;
      },
    )
    .join("");
}

export function setPageMeta(route) {
  const meta = ROUTE_META[route] || ROUTE_META.dashboard;
  document.getElementById("page-title").textContent = meta.title;
  document.getElementById("page-subtitle").textContent = meta.subtitle;
  document.title = `${meta.title} | ${APP_NAME}`;
}

export function openModal({ title, body, size = "modal-lg" }) {
  const dialog = document.querySelector("#app-modal .modal-dialog");
  dialog.className = `modal-dialog ${size} modal-dialog-centered modal-dialog-scrollable`;
  document.getElementById("app-modal-title").textContent = title;
  document.getElementById("app-modal-body").innerHTML = body;
  appModalInstance?.show();
}

export function closeModal() {
  appModalInstance?.hide();
}

export function openConfirm(message, onConfirm) {
  document.getElementById("confirm-modal-message").textContent = message;
  confirmCallback = onConfirm;
  confirmModalInstance?.show();
}

export function showAlert(container, type, message) {
  container.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show shadow-sm" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>
  `;
}

export function clearAlert(container) {
  container.innerHTML = "";
}

export function setButtonLoading(button, isLoading) {
  const text = button.querySelector(".button-text");
  const spinner = button.querySelector(".spinner-border");

  if (text && spinner) {
    text.classList.toggle("d-none", isLoading);
    spinner.classList.toggle("d-none", !isLoading);
  }

  button.disabled = isLoading;
}

export function showGlobalLoader(message = "جارٍ التحميل...") {
  if (!globalLoaderElement) {
    return;
  }

  globalLoaderCount += 1;
  globalLoaderTextElement.textContent = message;
  globalLoaderElement.classList.remove("d-none");
  globalLoaderElement.setAttribute("aria-hidden", "false");
}

export function hideGlobalLoader() {
  if (!globalLoaderElement) {
    return;
  }

  globalLoaderCount = Math.max(globalLoaderCount - 1, 0);
  if (globalLoaderCount > 0) {
    return;
  }

  globalLoaderElement.classList.add("d-none");
  globalLoaderElement.setAttribute("aria-hidden", "true");
}

export async function withGlobalLoader(task, options = {}) {
  const { message = "جارٍ التحميل...", minDuration = 240 } = options;
  const startedAt = Date.now();
  showGlobalLoader(message);

  try {
    return await task();
  } finally {
    const elapsed = Date.now() - startedAt;
    if (elapsed < minDuration) {
      await wait(minDuration - elapsed);
    }
    hideGlobalLoader();
  }
}

export function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

export function renderResetPageButton(page) {
  return `
    <button class="btn btn-outline-danger" data-action="page-reset" data-page="${page}">
      <i class="fa-solid fa-rotate-left"></i>
      إعادة تعيين الصفحة
    </button>
  `;
}
