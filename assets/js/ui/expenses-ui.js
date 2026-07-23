import { EXPENSE_CATEGORIES, USER_ROLES } from "../config/constants.js";
import { compareDateAsc, compareTextAsc, escapeHtml, formatCurrency, formatDate } from "../utils/helpers.js";
import { emptyState, renderResetPageButton } from "./layout.js";

export function renderExpensesSection(state) {
  const expenses = [...state.data.expenses].sort((firstExpense, secondExpense) => {
    const dateOrder = compareDateAsc(firstExpense.date, secondExpense.date);
    if (dateOrder !== 0) {
      return dateOrder;
    }
    return compareTextAsc(firstExpense.title, secondExpense.title);
  });

  const attachmentCounts = state.data.attachments.reduce((map, item) => {
    if (item.relatedType === "expense") {
      map[item.relatedId] = (map[item.relatedId] || 0) + 1;
    }
    return map;
  }, {});

  return `
    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">المصروفات</h2>
          <p class="text-muted mb-0">إدارة المصروفات ورفع الفواتير والإيصالات</p>
        </div>
        ${
          state.user.role === USER_ROLES.ADMIN
            ? `<div class="section-actions">
                <button class="btn btn-primary" data-action="expense-create">
                  <i class="fa-solid fa-plus"></i>
                  إضافة مصروف
                </button>
                ${renderResetPageButton("expenses")}
              </div>`
            : ""
        }
      </div>

      ${
        expenses.length
          ? `<div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>الوصف</th>
                    <th>المبلغ</th>
                    <th>التاريخ</th>
                    <th>الفئة</th>
                    <th>المستلم</th>
                    <th>المرفقات</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  ${expenses
                    .map(
                      (expense) => `
                        <tr>
                          <td>${escapeHtml(expense.title)}</td>
                          <td>${formatCurrency(expense.amount)}</td>
                          <td>${formatDate(expense.date)}</td>
                          <td>${escapeHtml(expense.category || "-")}</td>
                          <td>${escapeHtml(expense.recipientName || "-")}</td>
                          <td>${attachmentCounts[expense.id] || 0}</td>
                          <td>
                            ${
                              state.user.role === USER_ROLES.ADMIN
                                ? `<div class="d-flex gap-2">
                                    <button class="btn btn-sm btn-outline-secondary" data-action="expense-edit" data-id="${expense.id}">
                                      <i class="fa-solid fa-pen"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" data-action="expense-delete" data-id="${expense.id}">
                                      <i class="fa-solid fa-trash"></i>
                                    </button>
                                  </div>`
                                : `<span class="text-muted small">عرض فقط</span>`
                            }
                          </td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
          : emptyState("لا توجد مصروفات مسجلة حتى الآن.")
      }
    </section>
  `;
}

export function getExpenseForm(expense = null) {
  return `
    <form id="expense-form">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">الوصف</label>
          <input class="form-control" name="title" value="${escapeHtml(expense?.title || "")}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label">المبلغ</label>
          <input class="form-control" name="amount" type="number" min="0.01" step="0.01" value="${expense?.amount || ""}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label">التاريخ</label>
          <input class="form-control" name="date" type="date" value="${expense?.date ? new Date(expense.date.toDate ? expense.date.toDate() : expense.date).toISOString().split("T")[0] : ""}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label">الفئة</label>
          <select class="form-select" name="category">
            ${EXPENSE_CATEGORIES.map(
              (category) => `<option value="${category}" ${expense?.category === category ? "selected" : ""}>${category}</option>`,
            ).join("")}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">الشخص المستلم</label>
          <input class="form-control" name="recipientName" value="${escapeHtml(expense?.recipientName || "")}" />
        </div>
        <div class="col-12">
          <label class="form-label">ملاحظات</label>
          <textarea class="form-control" name="notes" rows="3">${escapeHtml(expense?.notes || "")}</textarea>
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" data-bs-dismiss="modal">إلغاء</button>
        <button type="submit" class="btn btn-primary">${expense ? "حفظ التعديلات" : "إضافة المصروف"}</button>
      </div>
    </form>
  `;
}
