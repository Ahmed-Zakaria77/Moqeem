import { APARTMENT_STATUSES, USER_ROLES } from "../config/constants.js";
import {
  compareDateAsc,
  compareTextAsc,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatMonthYear,
  getApartmentResidentName,
  getPaymentMethodLabel,
  getPaymentStatusMeta,
  sumBy,
} from "../utils/helpers.js";
import { emptyState, renderResetPageButton } from "./layout.js";

function getAssignedServiceNames(apartment, services) {
  const servicesMap = Object.fromEntries(services.map((service) => [service.id, service]));

  if (Array.isArray(apartment.assignedServiceIds)) {
    return apartment.assignedServiceIds
      .map((serviceId) => servicesMap[serviceId]?.name)
      .filter(Boolean);
  }

  return services.filter((service) => service.isActive !== false).map((service) => service.name);
}

function sortChargesDesc(charges) {
  return [...charges].sort((firstCharge, secondCharge) => {
    if (Number(secondCharge.year) !== Number(firstCharge.year)) {
      return Number(secondCharge.year) - Number(firstCharge.year);
    }

    return Number(secondCharge.month) - Number(firstCharge.month);
  });
}

export function buildApartmentSummaryText(apartment, residents, charges, services = []) {
  const assignedServices = getAssignedServiceNames(apartment, services);
  const latestCharge = sortChargesDesc(charges)[0];
  const latestStatus = latestCharge ? getPaymentStatusMeta(latestCharge.status).label : "لا توجد سجلات تحصيل بعد";

  return [
    `ملخص الشقة ${apartment.apartmentNumber}`,
    `اسم الساكن: ${getApartmentResidentName(apartment) || "-"}`,
    `الدور: ${apartment.floor || "-"}`,
    `رقم الموبايل: ${apartment.phone || "-"}`,
    `الحالة: ${APARTMENT_STATUSES.find((item) => item.value === apartment.status)?.label || "-"}`,
    `عدد السكان المرتبطين: ${residents.length}`,
    `الخدمات المطلوبة: ${assignedServices.length ? assignedServices.join(" - ") : "غير محددة"}`,
    `آخر حالة سداد: ${latestStatus}`,
    latestCharge ? `آخر فترة مسجلة: ${formatMonthYear(latestCharge.month, latestCharge.year)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function renderApartmentsSection(state) {
  const filters = state.filters.apartments || {};
  const apartments = state.data.apartments
    .filter((item) => !item.isArchived)
    .filter((item) => {
      const floorMatch = !filters.floor || String(item.floor || "") === String(filters.floor);
      const statusMatch = !filters.status || item.status === filters.status;
      return floorMatch && statusMatch;
    })
    .sort((firstApartment, secondApartment) => compareTextAsc(firstApartment.apartmentNumber, secondApartment.apartmentNumber));
  const floors = [...new Set(state.data.apartments.filter((item) => !item.isArchived).map((item) => String(item.floor || "").trim()).filter(Boolean))]
    .sort(compareTextAsc);
  const residentsCount = state.data.residents.reduce((map, resident) => {
    map[resident.apartmentId] = (map[resident.apartmentId] || 0) + 1;
    return map;
  }, {});

  return `
    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">قائمة الشقق</h2>
          <p class="text-muted mb-0">عرض وإدارة بيانات الشقق داخل البرج</p>
        </div>
        ${
          state.user.role === USER_ROLES.ADMIN
            ? `<div class="section-actions">
                <button class="btn btn-primary" data-action="apartment-create">
                  <i class="fa-solid fa-plus"></i>
                  إضافة شقة
                </button>
                ${renderResetPageButton("apartments")}
              </div>`
            : ""
        }
      </div>

      <form id="apartments-filter-form" class="section-filters">
        <select class="form-select" name="floor" style="max-width: 220px;">
          <option value="">كل الأدوار</option>
          ${floors
            .map((floor) => `<option value="${escapeHtml(floor)}" ${String(filters.floor || "") === floor ? "selected" : ""}>الدور ${escapeHtml(floor)}</option>`)
            .join("")}
        </select>
        <select class="form-select" name="status" style="max-width: 220px;">
          <option value="">كل الحالات</option>
          ${APARTMENT_STATUSES.map(
            (status) =>
              `<option value="${status.value}" ${filters.status === status.value ? "selected" : ""}>${status.label}</option>`,
          ).join("")}
        </select>
        <button class="btn btn-outline-primary" type="submit">تطبيق</button>
      </form>

      ${
        apartments.length
          ? `<div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>رقم الشقة</th>
                    <th>الدور</th>
                    <th>اسم الساكن</th>
                    <th>الموبايل</th>
                    <th>الحالة</th>
                    <th>السكان</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  ${apartments
                    .map(
                      (apartment) => `
                        <tr>
                          <td>${escapeHtml(apartment.apartmentNumber)}</td>
                          <td>${escapeHtml(apartment.floor)}</td>
                          <td>${escapeHtml(getApartmentResidentName(apartment) || "-")}</td>
                          <td>${escapeHtml(apartment.phone || "-")}</td>
                          <td>${getApartmentStatusBadge(apartment.status)}</td>
                          <td>${residentsCount[apartment.id] || 0}</td>
                          <td>
                            <div class="d-flex gap-2">
                              <button class="btn btn-sm btn-outline-primary" data-action="apartment-view" data-id="${apartment.id}">
                                <i class="fa-solid fa-eye"></i>
                              </button>
                              ${
                                state.user.role === USER_ROLES.ADMIN
                                  ? `
                                  <button class="btn btn-sm btn-outline-secondary" data-action="apartment-edit" data-id="${apartment.id}">
                                    <i class="fa-solid fa-pen"></i>
                                  </button>
                                  <button class="btn btn-sm btn-outline-danger" data-action="apartment-delete" data-id="${apartment.id}">
                                    <i class="fa-solid fa-trash"></i>
                                  </button>
                                `
                                  : ""
                              }
                            </div>
                          </td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
          : emptyState("لا توجد شقق مطابقة للفلاتر الحالية.")
      }
    </section>
  `;
}

export function renderMyApartmentSection(state) {
  const apartment = state.data.apartments.find((item) => item.id === state.user?.apartmentId && !item.isArchived);

  if (!apartment) {
    return `
      <section class="section-card">
        <div class="section-card__header">
          <div>
            <h2 class="h5 mb-1">بيانات شقتي</h2>
            <p class="text-muted mb-0">كل ما يخص الشقة المرتبطة بحسابك</p>
          </div>
        </div>
        ${emptyState("لم يتم ربط هذا الحساب بأي شقة حتى الآن. تواصل مع الأدمن لإكمال الربط.")}
      </section>
    `;
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

  return `
    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">بيانات شقتي</h2>
          <p class="text-muted mb-0">تفاصيل الشقة والخدمات المطلوبة وسجل السداد الشهري</p>
        </div>
      </div>
      ${getApartmentDetails(apartment, residents, charges, payments, attachments, state.data.services, false)}
    </section>
  `;
}

function getApartmentStatusBadge(status) {
  const meta = APARTMENT_STATUSES.find((item) => item.value === status) || APARTMENT_STATUSES[0];
  const className =
    status === "occupied"
      ? "status-dot--occupied"
      : status === "vacant"
        ? "status-dot--vacant"
        : "status-dot--finishing";

  return `<span class="status-dot ${className}"></span>${meta.label}`;
}

export function getApartmentForm(apartment = null, services = []) {
  const sortedServices = [...services].sort((firstService, secondService) => compareTextAsc(firstService.name, secondService.name));
  const selectedServiceIds = Array.isArray(apartment?.assignedServiceIds)
    ? apartment.assignedServiceIds
    : sortedServices.filter((service) => service.isActive !== false).map((service) => service.id);

  return `
    <form id="apartment-form" novalidate>
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">رقم الشقة</label>
          <input class="form-control" name="apartmentNumber" value="${escapeHtml(apartment?.apartmentNumber || "")}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label">الدور</label>
          <input class="form-control" name="floor" value="${escapeHtml(apartment?.floor || "")}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label">اسم الساكن</label>
          <input class="form-control" name="residentName" value="${escapeHtml(getApartmentResidentName(apartment) || "")}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label">رقم الموبايل</label>
          <input class="form-control" name="phone" value="${escapeHtml(apartment?.phone || "")}" />
        </div>
        <div class="col-md-6">
          <label class="form-label">حالة الشقة</label>
          <select class="form-select" name="status" required>
            ${APARTMENT_STATUSES.map(
              (status) =>
                `<option value="${status.value}" ${apartment?.status === status.value ? "selected" : ""}>${status.label}</option>`,
            ).join("")}
          </select>
        </div>
        <div class="col-12">
          <label class="form-label">ملاحظات</label>
          <textarea class="form-control" name="notes" rows="3">${escapeHtml(apartment?.notes || "")}</textarea>
        </div>
        <div class="col-12">
          <label class="form-label d-block mb-3">الخدمات المطلوبة لهذه الشقة</label>
          ${
            sortedServices.length
              ? `<div class="row g-2">
                  ${sortedServices
                    .map(
                      (service) => `
                        <div class="col-md-6 col-lg-4">
                          <label class="border rounded-4 p-3 d-flex align-items-center justify-content-between gap-3 w-100 bg-white">
                            <span>
                              <strong class="d-block">${escapeHtml(service.name)}</strong>
                              <small class="text-muted">${formatCurrency(service.amount)}</small>
                            </span>
                            <span class="d-flex align-items-center gap-2">
                              ${
                                service.isActive
                                  ? `<span class="badge badge-soft badge-status-paid">مفعلة</span>`
                                  : `<span class="badge badge-soft badge-status-late">غير مفعلة</span>`
                              }
                              <input
                                class="form-check-input m-0"
                                type="checkbox"
                                name="assignedServiceIds"
                                value="${service.id}"
                                ${selectedServiceIds.includes(service.id) ? "checked" : ""}
                              />
                            </span>
                          </label>
                        </div>
                      `,
                    )
                    .join("")}
                </div>`
              : `<div class="alert alert-light border mb-0">لا توجد خدمات مضافة بعد. أضف الخدمات أولًا ثم حدّد المناسب لكل شقة.</div>`
          }
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" data-bs-dismiss="modal">إلغاء</button>
        <button type="submit" class="btn btn-primary">${apartment ? "حفظ التعديلات" : "إضافة الشقة"}</button>
      </div>
    </form>
  `;
}

export function getApartmentDetails(apartment, residents, charges, payments, attachments, services = [], canManage = false) {
  const sortedCharges = sortChargesDesc(charges);
  const sortedResidents = [...residents].sort((firstResident, secondResident) => compareTextAsc(firstResident.name, secondResident.name));
  const assignedServiceNames = getAssignedServiceNames(apartment, services);

  return `
    ${
      canManage
        ? `<div class="detail-actions">
            <button class="btn btn-outline-primary" data-action="apartment-copy-summary" data-id="${apartment.id}">
              <i class="fa-solid fa-copy"></i>
              نسخ ملخص الشقة
            </button>
            <button class="btn btn-outline-primary" data-action="apartment-print-statement" data-id="${apartment.id}">
              <i class="fa-solid fa-file-pdf"></i>
              طباعة كشف الشقة PDF
            </button>
          </div>`
        : ""
    }

    <div class="summary-strip">
      <div class="summary-chip">
        <small>رقم الشقة</small>
        <strong>${escapeHtml(apartment.apartmentNumber)}</strong>
      </div>
      <div class="summary-chip">
        <small>الحالة</small>
        <strong>${getApartmentStatusBadge(apartment.status)}</strong>
      </div>
      <div class="summary-chip">
        <small>رقم الموبايل</small>
        <strong>${escapeHtml(apartment.phone || "-")}</strong>
      </div>
    </div>

    <div class="detail-grid mb-4">
      <div class="detail-grid__item"><strong>الدور</strong>${escapeHtml(apartment.floor)}</div>
      <div class="detail-grid__item"><strong>اسم الساكن</strong>${escapeHtml(getApartmentResidentName(apartment) || "-")}</div>
      <div class="detail-grid__item"><strong>الخدمات المطلوبة</strong>${escapeHtml(assignedServiceNames.join(" - ") || "-")}</div>
      <div class="detail-grid__item"><strong>ملاحظات</strong>${escapeHtml(apartment.notes || "-")}</div>
    </div>

    <h3 class="h6 mb-3">السكان المرتبطون بالشقة</h3>
    ${
      sortedResidents.length
        ? `<div class="table-responsive mb-4">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>واتساب</th>
                  <th>سيارة</th>
                  <th>بيانات السيارة</th>
                </tr>
              </thead>
              <tbody>
                ${sortedResidents
                  .map(
                    (resident) => `
                      <tr>
                        <td>${escapeHtml(resident.name)}</td>
                        <td>${escapeHtml(resident.whatsapp || "-")}</td>
                        <td>${resident.hasCar ? "نعم" : "لا"}</td>
                        <td>${resident.hasCar ? `${escapeHtml(resident.carType || "-")} - ${escapeHtml(resident.carNumber || "-")}` : "-"}</td>
                      </tr>
                    `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>`
        : emptyState("لا يوجد سكان مرتبطون بهذه الشقة.")
    }

    <h3 class="h6 mb-3">Timeline التحصيل الشهري</h3>
    ${
      sortedCharges.length
        ? `<div class="accordion" id="charge-timeline">
            ${sortedCharges
              .map((charge, index) => {
                const status = getPaymentStatusMeta(charge.status);
                const relatedPayments = payments
                  .filter((payment) => payment.monthlyChargeId === charge.id)
                  .sort((firstPayment, secondPayment) => compareDateAsc(secondPayment.paymentDate, firstPayment.paymentDate));
                const relatedAttachments = attachments.filter(
                  (item) => item.relatedId === charge.id || relatedPayments.some((payment) => payment.id === item.relatedId),
                );

                return `
                  <div class="accordion-item mb-3 border rounded-4 overflow-hidden">
                    <h2 class="accordion-header">
                      <button
                        class="accordion-button ${index !== 0 ? "collapsed" : ""}"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#charge-${charge.id}"
                      >
                        <div class="w-100 d-flex justify-content-between align-items-center gap-3">
                          <span>${formatMonthYear(charge.month, charge.year)}</span>
                          <span class="badge badge-soft ${status.className}">${status.label}</span>
                        </div>
                      </button>
                    </h2>
                    <div id="charge-${charge.id}" class="accordion-collapse collapse ${index === 0 ? "show" : ""}" data-bs-parent="#charge-timeline">
                      <div class="accordion-body">
                        <div class="detail-grid mb-3">
                          <div class="detail-grid__item"><strong>المبلغ المطلوب</strong>${formatCurrency(charge.totalAmount)}</div>
                          <div class="detail-grid__item"><strong>المدفوع</strong>${formatCurrency(charge.paidAmount)}</div>
                          <div class="detail-grid__item"><strong>المتبقي</strong>${formatCurrency(charge.remainingAmount)}</div>
                          <div class="detail-grid__item"><strong>آخر دفعة</strong>${formatDate(charge.lastPaymentDate)}</div>
                        </div>

                        <h4 class="h6 mb-2">الخدمات</h4>
                        <ul class="list-group mb-3">
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

                        <h4 class="h6 mb-2">الدفعات</h4>
                        ${
                          relatedPayments.length
                            ? `<div class="table-responsive mb-3">
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
                                    ${relatedPayments
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
                            : emptyState("لا توجد دفعات مسجلة لهذا الشهر.")
                        }

                        <h4 class="h6 mb-2">المرفقات</h4>
                        ${
                          relatedAttachments.length
                            ? `<div class="list-group">
                                ${relatedAttachments
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
                            : emptyState("لا توجد مرفقات مرتبطة بهذا الشهر.")
                        }
                      </div>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>`
        : emptyState("لا توجد سجلات شهرية لهذه الشقة بعد.")
    }
  `;
}

export function getApartmentStatementPrintDocument(apartment, residents, charges, payments, services = []) {
  const assignedServiceNames = getAssignedServiceNames(apartment, services);
  const totalDue = sumBy(charges, (charge) => charge.totalAmount);
  const totalPaid = sumBy(charges, (charge) => charge.paidAmount);
  const totalRemaining = sumBy(charges, (charge) => charge.remainingAmount);
  const sortedCharges = sortChargesDesc(charges);

  const residentsRows = residents.length
    ? [...residents]
        .sort((firstResident, secondResident) => compareTextAsc(firstResident.name, secondResident.name))
        .map(
          (resident) => `
            <tr>
              <td>${escapeHtml(resident.name)}</td>
              <td>${escapeHtml(resident.whatsapp || "-")}</td>
              <td>${resident.hasCar ? "نعم" : "لا"}</td>
              <td>${resident.hasCar ? `${escapeHtml(resident.carType || "-")} - ${escapeHtml(resident.carNumber || "-")}` : "-"}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="4" class="print-empty">لا يوجد سكان مرتبطون بهذه الشقة.</td></tr>`;

  const chargesRows = sortedCharges.length
    ? sortedCharges
        .map((charge) => {
          const chargePayments = payments
            .filter((payment) => payment.monthlyChargeId === charge.id)
            .sort((firstPayment, secondPayment) => compareDateAsc(firstPayment.paymentDate, secondPayment.paymentDate));

          return `
            <tr>
              <td>${formatMonthYear(charge.month, charge.year)}</td>
              <td>${getPaymentStatusMeta(charge.status).label}</td>
              <td>${formatCurrency(charge.totalAmount)}</td>
              <td>${formatCurrency(charge.paidAmount)}</td>
              <td>${formatCurrency(charge.remainingAmount)}</td>
              <td>${chargePayments.length ? chargePayments.map((payment) => `${formatDate(payment.paymentDate)} - ${formatCurrency(payment.amount)}`).join("<br />") : "-"}</td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="6" class="print-empty">لا توجد سجلات تحصيل لهذه الشقة.</td></tr>`;

  return `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>كشف الشقة ${escapeHtml(apartment.apartmentNumber)}</title>
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
            max-width: 1020px;
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
          .print-summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 14px;
            margin-bottom: 20px;
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
            font-size: 1.12rem;
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
          .print-note {
            padding: 16px;
            border-radius: 16px;
            border: 1px solid var(--color-border);
            background: var(--color-surface);
          }
          .print-footer {
            margin-top: 28px;
            padding-top: 16px;
            border-top: 1px solid var(--color-border);
            color: var(--color-muted);
            font-size: 0.94rem;
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
              <h1 class="print-title">كشف الشقة ${escapeHtml(apartment.apartmentNumber)}</h1>
              <p class="print-subtitle">ملخص بيانات الساكن وسجل التحصيل الشهري</p>
            </div>
            <div class="print-note">
              <strong>اسم الساكن:</strong> ${escapeHtml(getApartmentResidentName(apartment) || "-")}<br />
              <strong>الدور:</strong> ${escapeHtml(apartment.floor || "-")}<br />
              <strong>رقم الموبايل:</strong> ${escapeHtml(apartment.phone || "-")}
            </div>
          </header>

          <section class="print-summary">
            <div class="print-summary__item">
              <span class="print-summary__label">إجمالي المطلوب</span>
              <div class="print-summary__value">${formatCurrency(totalDue)}</div>
            </div>
            <div class="print-summary__item">
              <span class="print-summary__label">إجمالي المدفوع</span>
              <div class="print-summary__value">${formatCurrency(totalPaid)}</div>
            </div>
            <div class="print-summary__item">
              <span class="print-summary__label">إجمالي المتبقي</span>
              <div class="print-summary__value">${formatCurrency(totalRemaining)}</div>
            </div>
            <div class="print-summary__item">
              <span class="print-summary__label">الخدمات المطلوبة</span>
              <div class="print-summary__value">${escapeHtml(assignedServiceNames.join(" - ") || "غير محددة")}</div>
            </div>
          </section>

          <section class="print-section">
            <h2>السكان المرتبطون</h2>
            <table>
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>واتساب</th>
                  <th>سيارة</th>
                  <th>بيانات السيارة</th>
                </tr>
              </thead>
              <tbody>${residentsRows}</tbody>
            </table>
          </section>

          <section class="print-section">
            <h2>سجل التحصيل الشهري</h2>
            <table>
              <thead>
                <tr>
                  <th>الفترة</th>
                  <th>الحالة</th>
                  <th>المطلوب</th>
                  <th>المدفوع</th>
                  <th>المتبقي</th>
                  <th>الدفعات المسجلة</th>
                </tr>
              </thead>
              <tbody>${chargesRows}</tbody>
            </table>
          </section>

          <footer class="print-footer">
            تم إنشاء هذا الكشف من نظام إدارة البرج لتسهيل مشاركة بيانات الشقة مع الساكن أو المالك.
          </footer>
        </main>
      </body>
    </html>
  `;
}
