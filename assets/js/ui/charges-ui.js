import { MONTHS, PAYMENT_METHODS, PAYMENT_STATUS_LABELS, USER_ROLES } from "../config/constants.js";
import {
  compareTextAsc,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatMonthYear,
  getApartmentResidentName,
  getAvailableYears,
  getCurrentMonthYear,
  getPaymentMethodLabel,
  getPaymentStatusMeta,
  sumBy,
  toInputDate,
} from "../utils/helpers.js";
import { emptyState, renderResetPageButton } from "./layout.js";

export function buildChargeSummaryText(charge, payments, apartment = null) {
  const status = getPaymentStatusMeta(charge.status).label;
  const residentName = getApartmentResidentName(apartment) || "-";
  const paymentLines = payments.length
    ? payments
        .map(
          (payment) =>
            `- ${formatDate(payment.paymentDate)} | ${formatCurrency(payment.amount)} | ${getPaymentMethodLabel(payment.paymentMethod)}`,
        )
        .join("\n")
    : "- لا توجد دفعات مسجلة";

  return [
    `بيانات سداد الشقة ${charge.apartmentNumber}`,
    `اسم الساكن: ${residentName}`,
    `الفترة: ${formatMonthYear(charge.month, charge.year)}`,
    `الحالة: ${status}`,
    `إجمالي المطلوب: ${formatCurrency(charge.totalAmount)}`,
    `إجمالي المدفوع: ${formatCurrency(charge.paidAmount)}`,
    `المتبقي: ${formatCurrency(charge.remainingAmount)}`,
    "الخدمات المطلوبة:",
    ...(charge.services || []).map((service) => `- ${service.name}: ${formatCurrency(service.amount)}`),
    "الدفعات المسجلة:",
    paymentLines,
  ].join("\n");
}

export function renderChargesSection(state) {
  const filters = state.filters.charges;
  const current = getCurrentMonthYear();
  const month = Number(filters?.month || current.month);
  const year = Number(filters?.year || current.year);
  const statusFilter = filters?.status || "";
  const availableYears = Array.from(new Set([current.year, ...getAvailableYears(state.data.monthlyCharges, (item) => item.year)])).sort(
    (firstYear, secondYear) => firstYear - secondYear,
  );

  const charges = state.data.monthlyCharges
    .filter((item) => {
      const monthMatch = Number(item.month) === month && Number(item.year) === year;
      const statusMatch = !statusFilter || item.status === statusFilter;
      return monthMatch && statusMatch;
    })
    .sort((firstCharge, secondCharge) => compareTextAsc(firstCharge.apartmentNumber, secondCharge.apartmentNumber));
  const totalDue = sumBy(charges, (item) => item.totalAmount);
  const totalPaid = sumBy(charges, (item) => item.paidAmount);
  const totalRemaining = sumBy(charges, (item) => item.remainingAmount);

  return `
    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">سجل التحصيل الشهري</h2>
          <p class="text-muted mb-0">يمكن تسجيل أكثر من دفعة لنفس الشهر عند السداد الجزئي</p>
        </div>
        ${
          state.user.role === USER_ROLES.ADMIN
            ? `<div class="section-actions">
                <button class="btn btn-primary" data-action="open-generate-charges">
                  <i class="fa-solid fa-calendar-plus"></i>
                  إنشاء خدمات الشهر
                </button>
                ${renderResetPageButton("charges")}
              </div>`
            : ""
        }
      </div>

      <form id="charges-filter-form" class="section-filters">
        <select class="form-select" name="month" style="max-width: 180px;">
          ${MONTHS.map(
            (label, index) => `<option value="${index + 1}" ${month === index + 1 ? "selected" : ""}>${label}</option>`,
          ).join("")}
        </select>
        <select class="form-select" name="year" style="max-width: 180px;">
          ${availableYears.map((optionYear) => `<option value="${optionYear}" ${year === optionYear ? "selected" : ""}>${optionYear}</option>`).join("")}
        </select>
        <select class="form-select" name="status" style="max-width: 220px;">
          <option value="">كل الحالات</option>
          ${Object.entries(PAYMENT_STATUS_LABELS)
            .map(([value, label]) => `<option value="${value}" ${statusFilter === value ? "selected" : ""}>${label}</option>`)
            .join("")}
        </select>
        <button class="btn btn-outline-primary" type="submit">تطبيق</button>
      </form>

      <div class="summary-strip">
        <div class="summary-chip">
          <small>الفترة المحددة</small>
          <strong>${formatMonthYear(month, year)}</strong>
        </div>
        <div class="summary-chip">
          <small>إجمالي المطلوب</small>
          <strong>${formatCurrency(totalDue)}</strong>
        </div>
        <div class="summary-chip">
          <small>إجمالي المدفوع</small>
          <strong>${formatCurrency(totalPaid)}</strong>
        </div>
        <div class="summary-chip">
          <small>إجمالي المتبقي</small>
          <strong>${formatCurrency(totalRemaining)}</strong>
        </div>
      </div>

      ${
        charges.length
          ? `<div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>الشقة</th>
                    <th>الفترة</th>
                    <th>المطلوب</th>
                    <th>المدفوع</th>
                    <th>المتبقي</th>
                    <th>آخر دفعة</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  ${charges
                    .map((charge) => {
                      const status = getPaymentStatusMeta(charge.status);
                      return `
                        <tr>
                          <td>${escapeHtml(charge.apartmentNumber)}</td>
                          <td>${formatMonthYear(charge.month, charge.year)}</td>
                          <td>${formatCurrency(charge.totalAmount)}</td>
                          <td>${formatCurrency(charge.paidAmount)}</td>
                          <td>${formatCurrency(charge.remainingAmount)}</td>
                          <td>${formatDate(charge.lastPaymentDate)}</td>
                          <td><span class="badge badge-soft ${status.className}">${status.label}</span></td>
                          <td>
                            <div class="d-flex gap-2">
                              <button class="btn btn-sm btn-outline-primary" data-action="charge-view" data-id="${charge.id}">
                                <i class="fa-solid fa-eye"></i>
                              </button>
                              ${
                                state.user.role === USER_ROLES.ADMIN
                                  ? `<button class="btn btn-sm btn-outline-success" data-action="charge-payment" data-id="${charge.id}">
                                      <i class="fa-solid fa-money-bill-wave"></i>
                                    </button>`
                                  : ""
                              }
                            </div>
                          </td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>`
          : emptyState("لا توجد سجلات مطابقة للفلاتر المختارة.")
      }
    </section>
  `;
}

export function getGenerateChargesForm() {
  const current = getCurrentMonthYear();
  return `
    <form id="generate-charges-form">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">الشهر</label>
          <select class="form-select" name="month">
            ${MONTHS.map(
              (label, index) => `<option value="${index + 1}" ${current.month === index + 1 ? "selected" : ""}>${label}</option>`,
            ).join("")}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">السنة</label>
          <input class="form-control" name="year" type="number" min="2024" value="${current.year}" />
        </div>
      </div>
      <div class="alert alert-info mt-3 mb-0">
        سيتم إنشاء سجل لكل شقة غير مؤرشفة مع حفظ قيمة كل خدمة وقت الإنشاء، ولن يتم تكرار السجل إذا كان موجودًا.
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" data-bs-dismiss="modal">إلغاء</button>
        <button type="submit" class="btn btn-primary">إنشاء السجلات</button>
      </div>
    </form>
  `;
}

export function getPaymentForm(charge) {
  const editableServices = (charge.services || []).filter((service) => service.isEditable);
  return `
    <form id="payment-form">
      <div class="summary-strip">
        <div class="summary-chip">
          <small>الشقة</small>
          <strong>${escapeHtml(charge.apartmentNumber)}</strong>
        </div>
        <div class="summary-chip">
          <small>المتبقي</small>
          <strong>${formatCurrency(charge.remainingAmount)}</strong>
        </div>
        <div class="summary-chip">
          <small>الفترة</small>
          <strong>${formatMonthYear(charge.month, charge.year)}</strong>
        </div>
      </div>
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">قيمة الدفعة</label>
          <input class="form-control" name="amount" type="number" min="0.01" step="0.01" max="${charge.remainingAmount}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label">طريقة الدفع</label>
          <select class="form-select" name="paymentMethod" required>
            <option value="">اختر</option>
            ${PAYMENT_METHODS.map((item) => `<option value="${item.value}">${item.label}</option>`).join("")}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">تاريخ الدفع</label>
          <input class="form-control" name="paymentDate" type="date" value="${toInputDate()}" required />
        </div>
        <div class="col-12">
          <label class="form-label">ملاحظات</label>
          <textarea class="form-control" name="notes" rows="3"></textarea>
        </div>
      </div>
      ${
        editableServices.length
          ? `<div class="mt-4">
              <h3 class="h6 mb-3">الخدمات القابلة للتعديل لهذا الشهر</h3>
              <div class="row g-3">
                ${editableServices
                  .map(
                    (service) => `
                      <div class="col-md-6">
                        <label class="form-label">${escapeHtml(service.name)}</label>
                        <input
                          class="form-control"
                          type="number"
                          min="0"
                          step="0.01"
                          name="serviceAmount__${service.serviceId}"
                          value="${service.amount}"
                        />
                      </div>
                    `,
                  )
                  .join("")}
              </div>
              <div class="form-text mt-2">
                أي تعديل هنا سيؤثر على سجل هذا الشهر فقط، ولن يغير إعدادات الخدمة الأصلية أو السجلات السابقة.
              </div>
            </div>`
          : ""
      }
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" data-bs-dismiss="modal">إلغاء</button>
        <button type="submit" class="btn btn-primary">تسجيل الدفعة</button>
      </div>
    </form>
  `;
}

export function getChargeDetails(charge, payments, attachments, apartment = null, canManage = false) {
  const status = getPaymentStatusMeta(charge.status);
  const residentName = getApartmentResidentName(apartment) || "-";

  return `
    ${
      canManage
        ? `<div class="detail-actions">
            <button class="btn btn-outline-primary" data-action="charge-copy-summary" data-id="${charge.id}">
              <i class="fa-solid fa-copy"></i>
              نسخ بيانات السداد
            </button>
            <button class="btn btn-outline-primary" data-action="charge-print" data-id="${charge.id}">
              <i class="fa-solid fa-file-pdf"></i>
              طباعة PDF
            </button>
          </div>`
        : ""
    }

    <div class="summary-strip">
      <div class="summary-chip">
        <small>الشقة</small>
        <strong>${escapeHtml(charge.apartmentNumber)}</strong>
      </div>
      <div class="summary-chip">
        <small>اسم الساكن</small>
        <strong>${escapeHtml(residentName)}</strong>
      </div>
      <div class="summary-chip">
        <small>الفترة</small>
        <strong>${formatMonthYear(charge.month, charge.year)}</strong>
      </div>
      <div class="summary-chip">
        <small>الحالة</small>
        <strong><span class="badge badge-soft ${status.className}">${status.label}</span></strong>
      </div>
    </div>

    <div class="detail-grid mb-4">
      <div class="detail-grid__item"><strong>المطلوب</strong>${formatCurrency(charge.totalAmount)}</div>
      <div class="detail-grid__item"><strong>المدفوع</strong>${formatCurrency(charge.paidAmount)}</div>
      <div class="detail-grid__item"><strong>المتبقي</strong>${formatCurrency(charge.remainingAmount)}</div>
      <div class="detail-grid__item"><strong>آخر دفعة</strong>${formatDate(charge.lastPaymentDate)}</div>
    </div>

    <h3 class="h6 mb-2">الخدمات المطلوبة</h3>
    <ul class="list-group mb-4">
      ${charge.services
        .map(
          (service) => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
              <span>${escapeHtml(service.name)}</span>
              <strong>${formatCurrency(service.amount)}</strong>
            </li>
          `,
        )
        .join("")}
    </ul>

    <h3 class="h6 mb-2">الدفعات المسجلة</h3>
    ${
      payments.length
        ? `<div class="table-responsive mb-4">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>المبلغ</th>
                  <th>التاريخ</th>
                  <th>الطريقة</th>
                  <th>الملاحظات</th>
                  <th>المستخدم</th>
                </tr>
              </thead>
              <tbody>
                ${payments
                  .map(
                    (payment) => `
                      <tr>
                        <td>${formatCurrency(payment.amount)}</td>
                        <td>${formatDate(payment.paymentDate)}</td>
                        <td>${escapeHtml(getPaymentMethodLabel(payment.paymentMethod))}</td>
                        <td>${escapeHtml(payment.notes || "-")}</td>
                        <td>${escapeHtml(payment.createdByName || "-")}</td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>`
        : emptyState("لا توجد دفعات لهذا السجل.")
    }

    <h3 class="h6 mb-2">المرفقات</h3>
    ${
      attachments.length
        ? `<div class="list-group">
            ${attachments
              .map(
                (attachment) => `
                  <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center gap-3 flex-wrap">
                      <div class="d-flex align-items-center gap-2">
                        ${
                          attachment.isImage
                            ? `<img src="${escapeHtml(attachment.attachmentUrl)}" alt="${escapeHtml(attachment.fileName)}" class="attachment-thumb" loading="lazy" />`
                            : `<span class="btn btn-sm btn-light disabled"><i class="fa-solid fa-link"></i></span>`
                        }
                        <div>
                          <div>${escapeHtml(attachment.fileName)}</div>
                          <small>${escapeHtml(attachment.attachmentType || "مرفق")}</small>
                        </div>
                      </div>
                      <a href="${escapeHtml(attachment.attachmentUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary">
                        فتح المرفق
                      </a>
                    </div>
                  </div>
                `,
              )
              .join("")}
          </div>`
        : emptyState("لا توجد مرفقات مرتبطة بهذا السجل.")
    }
  `;
}

export function getChargePrintDocument(charge, payments, attachments, apartment = null) {
  const status = getPaymentStatusMeta(charge.status);
  const residentName = getApartmentResidentName(apartment) || "-";
  const servicesRows = (charge.services || [])
    .map(
      (service) => `
        <tr>
          <td>${escapeHtml(service.name)}</td>
          <td>${formatCurrency(service.amount)}</td>
        </tr>
      `,
    )
    .join("");

  const paymentsRows = payments.length
    ? payments
        .map(
          (payment) => `
            <tr>
              <td>${formatCurrency(payment.amount)}</td>
              <td>${formatDate(payment.paymentDate)}</td>
              <td>${escapeHtml(getPaymentMethodLabel(payment.paymentMethod))}</td>
              <td>${escapeHtml(payment.notes || "-")}</td>
              <td>${escapeHtml(payment.createdByName || "-")}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="5" class="print-empty">لا توجد دفعات مسجلة.</td></tr>`;

  const attachmentsRows = attachments.length
    ? attachments
        .map(
          (attachment) => `
            <tr>
              <td>${escapeHtml(attachment.fileName)}</td>
              <td>${escapeHtml(attachment.attachmentType || "مرفق")}</td>
              <td><a href="${escapeHtml(attachment.attachmentUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(attachment.attachmentUrl)}</a></td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="3" class="print-empty">لا توجد مرفقات مرتبطة بهذا السجل.</td></tr>`;

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>بطاقة تحصيل - شقة ${escapeHtml(charge.apartmentNumber)}</title>
        <style>
          :root {
            --color-dark: #0b0909;
            --color-green-dark: #2e4540;
            --color-border: #dbe4e0;
            --color-surface: #f7faf9;
            --color-text: #1d2524;
            --color-muted: #68726f;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 28px;
            font-family: Tahoma, "Segoe UI", sans-serif;
            color: var(--color-text);
            background: #ffffff;
          }
          .print-card {
            max-width: 980px;
            margin: 0 auto;
            border: 1px solid var(--color-border);
            border-radius: 20px;
            padding: 28px;
            background: #fff;
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 24px;
            margin-bottom: 24px;
            padding-bottom: 18px;
            border-bottom: 1px solid var(--color-border);
          }
          .print-title {
            margin: 0;
            font-size: 1.8rem;
            color: var(--color-dark);
          }
          .print-subtitle {
            margin: 8px 0 0;
            color: var(--color-muted);
          }
          .print-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 10px 16px;
            border-radius: 999px;
            background: rgba(64, 129, 117, 0.12);
            color: var(--color-green-dark);
            font-weight: 700;
            white-space: nowrap;
          }
          .print-summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 18px;
          }
          .print-summary__item {
            padding: 16px;
            border-radius: 16px;
            border: 1px solid var(--color-border);
            background: var(--color-surface);
          }
          .print-summary__label {
            display: block;
            margin-bottom: 8px;
            color: var(--color-muted);
            font-size: 0.92rem;
          }
          .print-summary__value {
            font-weight: 700;
            font-size: 1.15rem;
          }
          .print-section {
            margin-top: 24px;
          }
          .print-section h2 {
            margin: 0 0 12px;
            font-size: 1.05rem;
            color: var(--color-green-dark);
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th,
          td {
            padding: 12px 14px;
            border: 1px solid var(--color-border);
            text-align: right;
            vertical-align: top;
          }
          th {
            background: #f0f5f3;
            color: var(--color-green-dark);
          }
          .print-empty {
            text-align: center;
            color: var(--color-muted);
          }
          .print-footer {
            margin-top: 28px;
            padding-top: 16px;
            border-top: 1px solid var(--color-border);
            color: var(--color-muted);
            font-size: 0.94rem;
          }
          a {
            color: var(--color-green-dark);
            word-break: break-all;
          }
          @media print {
            body { padding: 0; }
            .print-card {
              border: 0;
              border-radius: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body onload="window.print(); window.onafterprint = () => window.close();">
        <main class="print-card">
          <header class="print-header">
            <div>
              <h1 class="print-title">بطاقة تحصيل الشقة ${escapeHtml(charge.apartmentNumber)}</h1>
              <p class="print-subtitle">تفاصيل السداد عن ${formatMonthYear(charge.month, charge.year)}</p>
            </div>
            <div class="print-badge">${status.label}</div>
          </header>

          <section class="print-summary">
            <div class="print-summary__item">
              <span class="print-summary__label">اسم الساكن</span>
              <div class="print-summary__value">${escapeHtml(residentName)}</div>
            </div>
            <div class="print-summary__item">
              <span class="print-summary__label">إجمالي المطلوب</span>
              <div class="print-summary__value">${formatCurrency(charge.totalAmount)}</div>
            </div>
            <div class="print-summary__item">
              <span class="print-summary__label">إجمالي المدفوع</span>
              <div class="print-summary__value">${formatCurrency(charge.paidAmount)}</div>
            </div>
            <div class="print-summary__item">
              <span class="print-summary__label">المتبقي</span>
              <div class="print-summary__value">${formatCurrency(charge.remainingAmount)}</div>
            </div>
          </section>

          <section class="print-section">
            <h2>الخدمات المطلوبة</h2>
            <table>
              <thead>
                <tr>
                  <th>الخدمة</th>
                  <th>القيمة</th>
                </tr>
              </thead>
              <tbody>${servicesRows}</tbody>
            </table>
          </section>

          <section class="print-section">
            <h2>الدفعات المسجلة</h2>
            <table>
              <thead>
                <tr>
                  <th>المبلغ</th>
                  <th>التاريخ</th>
                  <th>الطريقة</th>
                  <th>الملاحظات</th>
                  <th>المستخدم</th>
                </tr>
              </thead>
              <tbody>${paymentsRows}</tbody>
            </table>
          </section>

          <section class="print-section">
            <h2>المرفقات</h2>
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>النوع</th>
                  <th>الرابط</th>
                </tr>
              </thead>
              <tbody>${attachmentsRows}</tbody>
            </table>
          </section>

          <footer class="print-footer">
            تم إنشاء هذه البطاقة من نظام إدارة البرج لمشاركة حالة السداد مع الساكن أو المالك عند الحاجة.
          </footer>
        </main>
      </body>
    </html>
  `;
}
