import { USER_ROLES } from "../config/constants.js";
import { compareTextAsc, escapeHtml, formatCurrency } from "../utils/helpers.js";
import { emptyState, renderResetPageButton } from "./layout.js";

export function renderServicesSection(state) {
  const services = [...state.data.services].sort((firstService, secondService) => compareTextAsc(firstService.name, secondService.name));

  return `
    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">الخدمات الشهرية</h2>
          <p class="text-muted mb-0">الخدمات المستخدمة عند إنشاء سجلات الشهر</p>
        </div>
        ${
          state.user.role === "admin"
            ? `<div class="section-actions">
                <button class="btn btn-primary" data-action="service-create">
                  <i class="fa-solid fa-plus"></i>
                  إضافة خدمة
                </button>
                ${renderResetPageButton("services")}
              </div>`
            : ""
        }
      </div>

      ${
        services.length
          ? `<div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>الخدمة</th>
                    <th>القيمة</th>
                    <th>ثابتة</th>
                    <th>قابلة للتعديل وقت الدفع</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  ${services
                    .map(
                      (service) => `
                        <tr>
                          <td>${escapeHtml(service.name)}</td>
                          <td>${formatCurrency(service.amount)}</td>
                          <td>${service.isFixed ? "نعم" : "لا"}</td>
                          <td>${service.isEditable ? "نعم" : "لا"}</td>
                          <td>
                            <span class="badge badge-soft ${service.isActive ? "badge-status-paid" : "badge-status-finished"}">
                              ${service.isActive ? "مفعلة" : "غير مفعلة"}
                            </span>
                          </td>
                          <td>
                            ${
                              state.user.role === USER_ROLES.ADMIN
                                ? `<div class="d-flex gap-2">
                                    <button class="btn btn-sm btn-outline-secondary" data-action="service-edit" data-id="${service.id}">
                                      <i class="fa-solid fa-pen"></i>
                                    </button>
                                    <button class="btn btn-sm ${service.isActive ? "btn-outline-warning" : "btn-outline-success"}" data-action="service-toggle" data-id="${service.id}">
                                      <i class="fa-solid ${service.isActive ? "fa-ban" : "fa-check"}"></i>
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
          : emptyState("لا توجد خدمات مضافة حتى الآن.")
      }
    </section>
  `;
}

export function getServiceForm(service = null) {
  return `
    <form id="service-form">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">اسم الخدمة</label>
          <input class="form-control" name="name" value="${escapeHtml(service?.name || "")}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label">القيمة</label>
          <input class="form-control" name="amount" type="number" min="0" step="0.01" value="${service?.amount || 0}" required />
        </div>
        <div class="col-md-4">
          <div class="form-check mt-4">
            <input class="form-check-input" type="checkbox" name="isFixed" id="service-fixed" ${service?.isFixed ?? true ? "checked" : ""} />
            <label class="form-check-label" for="service-fixed">القيمة ثابتة</label>
          </div>
        </div>
        <div class="col-md-4">
          <div class="form-check mt-4">
            <input class="form-check-input" type="checkbox" name="isEditable" id="service-editable" ${service?.isEditable ? "checked" : ""} />
            <label class="form-check-label" for="service-editable">مسموح تعديلها وقت الدفع</label>
          </div>
        </div>
        <div class="col-md-4">
          <div class="form-check mt-4">
            <input class="form-check-input" type="checkbox" name="isActive" id="service-active" ${service?.isActive ?? true ? "checked" : ""} />
            <label class="form-check-label" for="service-active">الخدمة مفعلة</label>
          </div>
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" data-bs-dismiss="modal">إلغاء</button>
        <button type="submit" class="btn btn-primary">${service ? "حفظ التعديلات" : "إضافة الخدمة"}</button>
      </div>
    </form>
  `;
}
