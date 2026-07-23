import { USER_ROLES } from "../config/constants.js";
import { compareTextAsc, escapeHtml, getApartmentResidentName } from "../utils/helpers.js";
import { emptyState, renderResetPageButton } from "./layout.js";

export function renderResidentsSection(state) {
  const apartmentsMap = Object.fromEntries(state.data.apartments.map((item) => [item.id, item]));
  const residents = state.data.residents
    .filter((item) => apartmentsMap[item.apartmentId] && !apartmentsMap[item.apartmentId].isArchived)
    .sort((firstResident, secondResident) => {
      const apartmentOrder = compareTextAsc(
        apartmentsMap[firstResident.apartmentId]?.apartmentNumber,
        apartmentsMap[secondResident.apartmentId]?.apartmentNumber,
      );

      if (apartmentOrder !== 0) {
        return apartmentOrder;
      }

      return compareTextAsc(firstResident.name, secondResident.name);
    });

  return `
    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">قائمة السكان</h2>
          <p class="text-muted mb-0">يمكن ربط أكثر من ساكن بالشقة الواحدة</p>
        </div>
        ${
          state.user.role === USER_ROLES.ADMIN
            ? `<div class="section-actions">
                <button class="btn btn-primary" data-action="resident-create">
                  <i class="fa-solid fa-user-plus"></i>
                  إضافة ساكن
                </button>
                ${renderResetPageButton("residents")}
              </div>`
            : ""
        }
      </div>

      ${
        residents.length
          ? `<div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>الشقة</th>
                    <th>واتساب</th>
                    <th>سيارة</th>
                    <th>بيانات السيارة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  ${residents
                    .map(
                      (resident) => `
                        <tr>
                          <td>${escapeHtml(resident.name)}</td>
                          <td>${escapeHtml(apartmentsMap[resident.apartmentId]?.apartmentNumber || "-")}</td>
                          <td>${escapeHtml(resident.whatsapp || "-")}</td>
                          <td>${resident.hasCar ? "نعم" : "لا"}</td>
                          <td>${resident.hasCar ? `${escapeHtml(resident.carType || "-")} / ${escapeHtml(resident.carNumber || "-")}` : "-"}</td>
                          <td>
                            ${
                              state.user.role === USER_ROLES.ADMIN
                                ? `<div class="d-flex gap-2">
                                    <button class="btn btn-sm btn-outline-secondary" data-action="resident-edit" data-id="${resident.id}">
                                      <i class="fa-solid fa-pen"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-danger" data-action="resident-delete" data-id="${resident.id}">
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
          : emptyState("لا توجد بيانات سكان حتى الآن.")
      }
    </section>
  `;
}

export function getResidentForm(apartments, resident = null) {
  const activeApartments = apartments
    .filter((item) => !item.isArchived)
    .sort((firstApartment, secondApartment) => compareTextAsc(firstApartment.apartmentNumber, secondApartment.apartmentNumber));
  return `
    <form id="resident-form">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">الشقة</label>
          <select class="form-select" name="apartmentId" required>
            <option value="">اختر الشقة</option>
            ${activeApartments
              .map(
                (apartment) => `
                  <option value="${apartment.id}" ${resident?.apartmentId === apartment.id ? "selected" : ""}>
                    شقة ${escapeHtml(apartment.apartmentNumber)} - ${escapeHtml(getApartmentResidentName(apartment) || "-")}
                  </option>
                `,
              )
              .join("")}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">الاسم</label>
          <input class="form-control" name="name" value="${escapeHtml(resident?.name || "")}" required />
        </div>
        <div class="col-md-6">
          <label class="form-label">رقم واتساب</label>
          <input class="form-control" name="whatsapp" value="${escapeHtml(resident?.whatsapp || "")}" />
        </div>
        <div class="col-md-6 d-flex align-items-end">
          <div class="form-check">
            <input class="form-check-input" type="checkbox" name="hasCar" id="resident-has-car" ${resident?.hasCar ? "checked" : ""} />
            <label class="form-check-label" for="resident-has-car">لديه سيارة</label>
          </div>
        </div>
        <div class="col-md-6">
          <label class="form-label">نوع السيارة</label>
          <input class="form-control" name="carType" value="${escapeHtml(resident?.carType || "")}" />
        </div>
        <div class="col-md-6">
          <label class="form-label">رقم السيارة</label>
          <input class="form-control" name="carNumber" value="${escapeHtml(resident?.carNumber || "")}" />
        </div>
        <div class="col-12">
          <label class="form-label">ملاحظات</label>
          <textarea class="form-control" name="notes" rows="3">${escapeHtml(resident?.notes || "")}</textarea>
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" data-bs-dismiss="modal">إلغاء</button>
        <button type="submit" class="btn btn-primary">${resident ? "حفظ التعديلات" : "إضافة الساكن"}</button>
      </div>
    </form>
  `;
}
