import { APARTMENT_STATUSES, USER_ROLES } from "../config/constants.js";
import {
  compareTextAsc,
  escapeHtml,
  formatCurrency,
  formatDate,
  formatMonthYear,
  getApartmentResidentName,
  getApartmentStatusBadge,
  getPaymentMethodLabel,
  getPaymentStatusMeta,
} from "../utils/helpers.js";
import { emptyState, renderResetPageButton } from "./layout.js";

export function renderApartmentsSection(state) {
  const apartments = state.data.apartments
    .filter((item) => !item.isArchived)
    .sort((firstApartment, secondApartment) => compareTextAsc(firstApartment.apartmentNumber, secondApartment.apartmentNumber));
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
          : emptyState("لا توجد شقق مضافة حتى الآن.")
      }
    </section>
  `;
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

export function getApartmentDetails(apartment, residents, charges, payments, attachments, services = []) {
  const sortedCharges = [...charges].sort((a, b) => {
    if (b.year !== a.year) {
      return b.year - a.year;
    }
    return b.month - a.month;
  });
  const servicesMap = Object.fromEntries(services.map((service) => [service.id, service]));
  const assignedServiceNames = Array.isArray(apartment.assignedServiceIds)
    ? apartment.assignedServiceIds
        .map((serviceId) => servicesMap[serviceId]?.name)
        .filter(Boolean)
    : services.filter((service) => service.isActive !== false).map((service) => service.name);

  return `
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
      residents.length
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
                ${residents
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
                const relatedPayments = payments.filter((payment) => payment.monthlyChargeId === charge.id);
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
