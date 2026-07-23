import { compareDateAsc, formatCurrency, formatDate, sumBy, toNumber } from "../utils/helpers.js";

export function renderTreasurySection(state) {
  const treasuryTransactions = [...state.data.treasuryTransactions].sort((firstItem, secondItem) =>
    compareDateAsc(firstItem.date, secondItem.date),
  );
  const totalCollected = sumBy(state.data.payments, (item) => item.amount);
  const totalExpenses = sumBy(state.data.expenses, (item) => item.amount);
  const openingBalance = toNumber(state.data.settings.openingBalance);
  const currentBalance = openingBalance + totalCollected - totalExpenses;

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
            ${treasuryTransactions
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
              .join("")}
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
