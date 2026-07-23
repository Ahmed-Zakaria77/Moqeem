import { MONTHS } from "../config/constants.js";
import { asDate, compareDateAsc, formatCurrency, formatDate, getAvailableYears, sumBy, toNumber } from "../utils/helpers.js";

function getSignedTransactionAmount(transaction) {
  if (transaction.type === "تحصيل") {
    return toNumber(transaction.amount);
  }

  if (transaction.type === "مصروف") {
    return toNumber(transaction.amount) * -1;
  }

  return 0;
}

function getTransactionYear(transaction) {
  return asDate(transaction.date)?.getFullYear() || null;
}

function getTransactionMonth(transaction) {
  const date = asDate(transaction.date);
  return date ? date.getMonth() + 1 : null;
}

function matchesPeriod(item, year, month = "") {
  const itemDate = asDate(item.date || item.paymentDate);
  if (!itemDate) {
    return false;
  }

  const yearMatch = itemDate.getFullYear() === Number(year);
  const monthMatch = !month || itemDate.getMonth() + 1 === Number(month);
  return yearMatch && monthMatch;
}

function getMonthlyBalanceRows(state, year) {
  const transactions = [...state.data.treasuryTransactions].sort((firstItem, secondItem) => compareDateAsc(firstItem.date, secondItem.date));
  const openingBalance = toNumber(state.data.settings.openingBalance);
  let runningBalance =
    openingBalance +
    sumBy(
      transactions.filter((item) => {
        const itemYear = getTransactionYear(item);
        return itemYear && itemYear < Number(year);
      }),
      (item) => getSignedTransactionAmount(item),
    );

  return MONTHS.map((label, index) => {
    const month = index + 1;
    const monthTransactions = transactions.filter((item) => {
      const itemYear = getTransactionYear(item);
      const itemMonth = getTransactionMonth(item);
      return itemYear === Number(year) && itemMonth === month;
    });
    const inflow = sumBy(monthTransactions.filter((item) => item.type === "تحصيل"), (item) => item.amount);
    const outflow = sumBy(monthTransactions.filter((item) => item.type === "مصروف"), (item) => item.amount);
    const opening = runningBalance;
    const closing = opening + inflow - outflow;
    runningBalance = closing;

    return {
      month,
      label,
      opening,
      inflow,
      outflow,
      closing,
    };
  });
}

export function renderTreasurySection(state) {
  const currentYear = new Date().getFullYear();
  const filters = state.filters.treasury || { year: currentYear, month: "" };
  const selectedYear = Number(filters.year || currentYear);
  const selectedMonth = filters.month ? Number(filters.month) : "";
  const years = Array.from(
    new Set([
      currentYear,
      ...getAvailableYears(state.data.treasuryTransactions, (item) => getTransactionYear(item)),
      ...getAvailableYears(state.data.expenses, (item) => asDate(item.date)?.getFullYear()),
      ...getAvailableYears(state.data.payments, (item) => asDate(item.paymentDate)?.getFullYear()),
    ]),
  ).sort((firstYear, secondYear) => firstYear - secondYear);

  const treasuryTransactions = [...state.data.treasuryTransactions]
    .filter((item) => matchesPeriod(item, selectedYear, selectedMonth))
    .sort((firstItem, secondItem) => compareDateAsc(firstItem.date, secondItem.date));
  const periodExpenses = state.data.expenses.filter((item) => matchesPeriod(item, selectedYear, selectedMonth));
  const totalCollected = sumBy(state.data.payments, (item) => item.amount);
  const totalExpenses = sumBy(state.data.expenses, (item) => item.amount);
  const openingBalance = toNumber(state.data.settings.openingBalance);
  const currentBalance = openingBalance + totalCollected - totalExpenses;
  const periodInflow = sumBy(treasuryTransactions.filter((item) => item.type === "تحصيل"), (item) => item.amount);
  const periodOutflow = sumBy(treasuryTransactions.filter((item) => item.type === "مصروف"), (item) => item.amount);
  const periodNet = periodInflow - periodOutflow;
  const monthlyBalanceRows = getMonthlyBalanceRows(state, selectedYear);
  const topExpenseCategories = Object.entries(
    periodExpenses.reduce((map, expense) => {
      const key = expense.category || "أخرى";
      map[key] = (map[key] || 0) + toNumber(expense.amount);
      return map;
    }, {}),
  )
    .sort((firstEntry, secondEntry) => secondEntry[1] - firstEntry[1])
    .slice(0, 5);
  const selectedPeriodLabel = selectedMonth ? `${MONTHS[selectedMonth - 1]} ${selectedYear}` : `سنة ${selectedYear}`;

  return `
    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">ملخص الخزنة</h2>
          <p class="text-muted mb-0">الرصيد الحالي يتم احتسابه تلقائيًا من البيانات</p>
        </div>
        ${
          state.user.role === "admin"
            ? `<div class="section-actions">
                <button class="btn btn-primary" data-action="treasury-update-opening">
                  <i class="fa-solid fa-pen"></i>
                  تعديل الرصيد الافتتاحي
                </button>
              </div>`
            : ""
        }
      </div>

      <div class="summary-strip">
        <div class="summary-chip">
          <small>الرصيد الافتتاحي</small>
          <strong>${formatCurrency(openingBalance)}</strong>
        </div>
        <div class="summary-chip">
          <small>إجمالي المحصل</small>
          <strong>${formatCurrency(totalCollected)}</strong>
        </div>
        <div class="summary-chip">
          <small>إجمالي المصروفات</small>
          <strong>${formatCurrency(totalExpenses)}</strong>
        </div>
        <div class="summary-chip">
          <small>الرصيد الحالي</small>
          <strong>${formatCurrency(currentBalance)}</strong>
        </div>
      </div>
    </section>

    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">تقرير الخزنة حسب الفترة</h2>
          <p class="text-muted mb-0">ملخص سريع للداخل والخارج خلال الفترة المحددة</p>
        </div>
      </div>

      <form id="treasury-filter-form" class="section-filters">
        <select class="form-select" name="year" style="max-width: 180px;">
          ${years.map((year) => `<option value="${year}" ${selectedYear === year ? "selected" : ""}>${year}</option>`).join("")}
        </select>
        <select class="form-select" name="month" style="max-width: 180px;">
          <option value="">كل الشهور</option>
          ${MONTHS.map(
            (label, index) =>
              `<option value="${index + 1}" ${selectedMonth === index + 1 ? "selected" : ""}>${label}</option>`,
          ).join("")}
        </select>
        <button class="btn btn-outline-primary" type="submit">تطبيق</button>
      </form>

      <div class="summary-strip">
        <div class="summary-chip">
          <small>الفترة</small>
          <strong>${selectedPeriodLabel}</strong>
        </div>
        <div class="summary-chip">
          <small>إجمالي الداخل</small>
          <strong>${formatCurrency(periodInflow)}</strong>
        </div>
        <div class="summary-chip">
          <small>إجمالي الخارج</small>
          <strong>${formatCurrency(periodOutflow)}</strong>
        </div>
        <div class="summary-chip">
          <small>صافي الحركة</small>
          <strong>${formatCurrency(periodNet)}</strong>
        </div>
      </div>
    </section>

    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">أكثر فئات المصروفات</h2>
          <p class="text-muted mb-0">الفئات الأعلى تكلفة خلال ${selectedPeriodLabel}</p>
        </div>
      </div>

      ${
        topExpenseCategories.length
          ? `<div class="summary-strip">
              ${topExpenseCategories
                .map(
                  ([category, amount]) => `
                    <div class="summary-chip">
                      <small>${category}</small>
                      <strong>${formatCurrency(amount)}</strong>
                    </div>
                  `,
                )
                .join("")}
            </div>`
          : `<div class="empty-state">لا توجد مصروفات مسجلة في الفترة المحددة.</div>`
      }
    </section>

    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">السجل الشهري</h2>
          <p class="text-muted mb-0">رصيد بداية الشهر والداخل والخارج والرصيد النهائي</p>
        </div>
      </div>

      <div class="table-responsive mb-4">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>الشهر</th>
              <th>رصيد البداية</th>
              <th>الداخل</th>
              <th>الخارج</th>
              <th>الرصيد النهائي</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyBalanceRows
              .map(
                (row) => `
                  <tr>
                    <td>${row.label} ${selectedYear}</td>
                    <td>${formatCurrency(row.opening)}</td>
                    <td>${formatCurrency(row.inflow)}</td>
                    <td>${formatCurrency(row.outflow)}</td>
                    <td>${formatCurrency(row.closing)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">سجل حركة الخزنة</h2>
          <p class="text-muted mb-0">يشمل التحصيل والمصروفات وتعديل الرصيد الافتتاحي</p>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-hover">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>نوع الحركة</th>
              <th>المبلغ</th>
              <th>البيان</th>
              <th>المستخدم</th>
            </tr>
          </thead>
          <tbody>
            ${
              treasuryTransactions.length
                ? treasuryTransactions
                    .map(
                      (item) => `
                        <tr>
                          <td>${formatDate(item.date)}</td>
                          <td>${item.type}</td>
                          <td>${formatCurrency(item.amount)}</td>
                          <td>${item.description || "-"}</td>
                          <td>${item.userName || "-"}</td>
                        </tr>
                      `,
                    )
                    .join("")
                : `<tr><td colspan="5" class="text-center text-muted py-4">لا توجد حركات خزنة في الفترة المحددة.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

export function getOpeningBalanceForm(currentBalance) {
  return `
    <form id="opening-balance-form">
      <label class="form-label">الرصيد الافتتاحي</label>
      <input class="form-control" type="number" min="0" step="0.01" name="openingBalance" value="${currentBalance}" required />
      <div class="alert alert-info mt-3 mb-0">
        لن يتم إدخال الرصيد الحالي يدويًا، وسيتم احتسابه تلقائيًا بعد الحفظ.
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" data-bs-dismiss="modal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ</button>
      </div>
    </form>
  `;
}
