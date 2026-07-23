import { USER_ROLES, USER_STATUSES } from "../config/constants.js";
import { compareDateAsc, compareTextAsc, escapeHtml, formatDateTime, getApartmentResidentName, getUserStatusMeta } from "../utils/helpers.js";
import { emptyState } from "./layout.js";

export function renderRequestsSection(state) {
  const pendingUsers = state.data.users
    .filter((item) => item.role === USER_ROLES.USER && item.status === USER_STATUSES.PENDING)
    .sort((firstUser, secondUser) => {
      const dateOrder = compareDateAsc(firstUser.createdAt, secondUser.createdAt);
      if (dateOrder !== 0) {
        return dateOrder;
      }
      return compareTextAsc(firstUser.name, secondUser.name);
    });

  return `
    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">طلبات التسجيل الجديدة</h2>
          <p class="text-muted mb-0">الحسابات الجديدة تظل معلقة حتى يراجعها الأدمن</p>
        </div>
      </div>

      ${
        pendingUsers.length
          ? `<div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>اسم المستخدم</th>
                    <th>الموبايل</th>
                    <th>الحالة</th>
                    <th>تاريخ الطلب</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  ${pendingUsers
                    .map((user) => {
                      const status = getUserStatusMeta(user.status);
                      return `
                        <tr>
                          <td>${escapeHtml(user.name)}</td>
                          <td>${escapeHtml(user.username || "-")}</td>
                          <td>${escapeHtml(user.phone || "-")}</td>
                          <td><span class="badge badge-soft ${status.className}">${status.label}</span></td>
                          <td>${formatDateTime(user.createdAt)}</td>
                          <td>
                            <div class="d-flex gap-2">
                              <button class="btn btn-sm btn-outline-success" data-action="request-approve" data-id="${user.id}">
                                <i class="fa-solid fa-check"></i>
                              </button>
                              <button class="btn btn-sm btn-outline-danger" data-action="request-reject" data-id="${user.id}">
                                <i class="fa-solid fa-xmark"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      `;
                    })
                    .join("")}
                </tbody>
              </table>
            </div>`
          : emptyState("لا توجد طلبات تسجيل معلقة حاليًا.")
      }
    </section>
  `;
}

export function getApproveRequestForm(userRecord, apartments) {
  const activeApartments = apartments
    .filter((item) => !item.isArchived)
    .sort((firstApartment, secondApartment) => compareTextAsc(firstApartment.apartmentNumber, secondApartment.apartmentNumber));

  return `
    <form id="approve-request-form">
      <div class="summary-strip">
        <div class="summary-chip">
          <small>الاسم</small>
          <strong>${escapeHtml(userRecord.name)}</strong>
        </div>
        <div class="summary-chip">
          <small>اسم المستخدم</small>
          <strong>${escapeHtml(userRecord.username || "-")}</strong>
        </div>
        <div class="summary-chip">
          <small>الموبايل</small>
          <strong>${escapeHtml(userRecord.phone || "-")}</strong>
        </div>
      </div>
      <div class="mb-3">
        <label class="form-label">ربط الحساب بالشقة</label>
        <select class="form-select" name="apartmentId" required>
          <option value="">اختر الشقة المناسبة</option>
          ${activeApartments
            .map(
              (apartment) => `
                <option value="${apartment.id}">
                  شقة ${escapeHtml(apartment.apartmentNumber)} - ${escapeHtml(getApartmentResidentName(apartment) || "-")}
                </option>
              `,
            )
            .join("")}
        </select>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" data-bs-dismiss="modal">إلغاء</button>
        <button type="submit" class="btn btn-success">قبول وتفعيل الحساب</button>
      </div>
    </form>
  `;
}
