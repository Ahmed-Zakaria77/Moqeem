import { USER_ROLES } from "../config/constants.js";
import { formatCurrency, formatMonthYear, getCurrentMonthYear, getPaymentStatusMeta, sumBy, toNumber } from "../utils/helpers.js";
import { emptyState } from "./layout.js";

function getCurrentMonthStats(data) {
  const { month, year } = getCurrentMonthYear();
  const activeApartments = data.apartments.filter((item) => !item.isArchived);
  const currentCharges = data.monthlyCharges.filter((item) => Number(item.month) === month && Number(item.year) === year);
  const currentPayments = data.payments.filter((item) => {
    const date = item.paymentDate?.toDate ? item.paymentDate.toDate() : new Date(item.paymentDate);
    return date && date.getMonth() + 1 === month && date.getFullYear() === year;
  });
  const currentExpenses = data.expenses.filter((item) => {
    const date = item.date?.toDate ? item.date.toDate() : new Date(item.date);
    return date && date.getMonth() + 1 === month && date.getFullYear() === year;
  });

  const totalCollected = sumBy(currentPayments, (item) => item.amount);
  const totalExpenses = sumBy(currentExpenses, (item) => item.amount);
  const currentBalance =
    toNumber(data.settings.openingBalance) + sumBy(data.payments, (item) => item.amount) - sumBy(data.expenses, (item) => item.amount);

  return {
    activeApartments,
    currentCharges,
    currentPayments,
    currentExpenses,
    totalCollected,
    totalExpenses,
    currentBalance,
  };
}

export function renderDashboard(state) {
  const { data, user } = state;
  const stats = getCurrentMonthStats(data);
  const occupied = stats.activeApartments.filter((item) => item.status === "occupied").length;
  const vacant = stats.activeApartments.filter((item) => item.status === "vacant").length;
  const finishing = stats.activeApartments.filter((item) => item.status === "finishing").length;
  const paid = stats.currentCharges.filter((item) => item.status === "paid").length;
  const unpaid = stats.currentCharges.filter((item) => ["unpaid", "late"].includes(item.status)).length;
  const partial = stats.currentCharges.filter((item) => ["partial", "partial_late"].includes(item.status)).length;
  const overdueCharges = data.monthlyCharges.filter((item) => ["late", "partial_late"].includes(item.status)).slice(0, 6);

  const cards = [
    { label: "عدد الشقق", value: stats.activeApartments.length, icon: "fa-building" },
    { label: "الشقق الساكنة", value: occupied, icon: "fa-house-user" },
    { label: "الشقق الفارغة", value: vacant, icon: "fa-door-open" },
    { label: "تحت التشطيب", value: finishing, icon: "fa-hammer" },
    { label: "إجمالي المحصل هذا الشهر", value: formatCurrency(stats.totalCollected), icon: "fa-money-bill-wave" },
    { label: "إجمالي المصروفات هذا الشهر", value: formatCurrency(stats.totalExpenses), icon: "fa-file-invoice-dollar" },
    { label: "الرصيد الحالي", value: formatCurrency(stats.currentBalance), icon: "fa-vault" },
    { label: "شقق دفعت", value: paid, icon: "fa-circle-check" },
    { label: "شقق لم تدفع", value: unpaid, icon: "fa-circle-xmark" },
    { label: "شقق دفعت جزئيًا", value: partial, icon: "fa-circle-half-stroke" },
  ];

  return `
    <div class="dashboard-grid">
      ${cards
        .map(
          (card) => `
            <article class="stat-card">
              <div>
                <small>${card.label}</small>
                <div class="stat-card__value">${card.value}</div>
              </div>
              <span class="stat-card__icon">
                <i class="fa-solid ${card.icon}"></i>
              </span>
            </article>
          `,
        )
        .join("")}
    </div>

    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">إجراءات سريعة</h2>
          <p class="text-muted mb-0">أدوات الإدارة السريعة للشهر الحالي</p>
        </div>
        ${
          user.role === USER_ROLES.ADMIN
            ? `<div class="section-actions">
                <button class="btn btn-primary" data-action="open-generate-charges">
                  <i class="fa-solid fa-calendar-plus"></i>
                  إنشاء خدمات الشهر
                </button>
              </div>`
            : ""
        }
      </div>
      <div class="summary-strip">
        <div class="summary-chip">
          <small>الشهر الحالي</small>
          <strong>${formatMonthYear(getCurrentMonthYear().month, getCurrentMonthYear().year)}</strong>
        </div>
        <div class="summary-chip">
          <small>عدد سجلات التحصيل</small>
          <strong>${stats.currentCharges.length}</strong>
        </div>
        <div class="summary-chip">
          <small>عدد الدفعات المسجلة</small>
          <strong>${stats.currentPayments.length}</strong>
        </div>
      </div>
    </section>

    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">تنبيهات الحسابات المتأخرة</h2>
          <p class="text-muted mb-0">السجلات التي تجاوزت آخر موعد للسداد</p>
        </div>
      </div>
      ${
        overdueCharges.length
          ? `<div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>الشقة</th>
                    <th>الفترة</th>
                    <th>المطلوب</th>
                    <th>المدفوع</th>
                    <th>المتبقي</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  ${overdueCharges
                    .map((charge) => {
                      const status = getPaymentStatusMeta(charge.status);
                      return `
                        <tr>
                          <td>${charge.apartmentNumber}</td>
                          <td>${formatMonthYear(charge.month, charge.year)}</td>
                          <td>${formatCurrency(charge.totalAmount)}</td>
                          <td>${formatCurrency(charge.paidAmount)}</td>
                          <td>${formatCurrency(charge.remainingAmount)}</td>
                          <td><span class="badge badge-soft ${status.className}">${status.label}</span></td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>`
          : emptyState("لا توجد حسابات متأخرة حاليًا.")
      }
    </section>
  `;
}
