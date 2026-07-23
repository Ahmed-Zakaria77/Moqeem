import { ATTACHMENT_TYPES, USER_ROLES } from "../config/constants.js";
import { compareDateAsc, compareTextAsc, escapeHtml, formatDate, getApartmentResidentName } from "../utils/helpers.js";
import { emptyState, renderResetPageButton } from "./layout.js";

function getRelationLabel(attachment, state) {
  if (attachment.relatedType === "expense") {
    const expense = state.data.expenses.find((item) => item.id === attachment.relatedId);
    return expense ? `مصروف: ${expense.title}` : "مصروف";
  }

  if (attachment.relatedType === "charge") {
    const charge = state.data.monthlyCharges.find((item) => item.id === attachment.relatedId);
    return charge ? `تحصيل: شقة ${charge.apartmentNumber}` : "تحصيل";
  }

  if (attachment.relatedType === "apartment") {
    const apartment = state.data.apartments.find((item) => item.id === attachment.relatedId);
    return apartment ? `شقة ${apartment.apartmentNumber}` : "شقة";
  }

  if (attachment.relatedType === "payment") {
    const payment = state.data.payments.find((item) => item.id === attachment.relatedId);
    if (!payment) {
      return "دفعة";
    }
    const charge = state.data.monthlyCharges.find((item) => item.id === payment.monthlyChargeId);
    return charge ? `دفعة - شقة ${charge.apartmentNumber}` : "دفعة";
  }

  return attachment.relatedType;
}

export function renderAttachmentsSection(state) {
  const attachments = [...state.data.attachments].sort((firstAttachment, secondAttachment) => {
    const dateOrder = compareDateAsc(firstAttachment.createdAt, secondAttachment.createdAt);
    if (dateOrder !== 0) {
      return dateOrder;
    }
    return compareTextAsc(firstAttachment.fileName, secondAttachment.fileName);
  });

  return `
    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">المرفقات</h2>
          <p class="text-muted mb-0">روابط المرفقات المرتبطة بالدفعات أو المصروفات أو الشقق</p>
        </div>
        ${
          state.user.role === USER_ROLES.ADMIN
            ? `<div class="section-actions">
                <button class="btn btn-primary" data-action="attachment-create">
                  <i class="fa-solid fa-link"></i>
                  إضافة رابط مرفق
                </button>
                ${renderResetPageButton("attachments")}
              </div>`
            : ""
        }
      </div>

      ${
        attachments.length
          ? `<div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>المرفق</th>
                    <th>نوع المرفق</th>
                    <th>الارتباط</th>
                    <th>تاريخ الرفع</th>
                    <th>المستخدم</th>
                    <th>الرابط</th>
                  </tr>
                </thead>
                <tbody>
                  ${attachments
                    .map(
                      (attachment) => `
                        <tr>
                          <td>
                            <div class="d-flex align-items-center gap-2">
                              ${
                                attachment.isImage
                                  ? `<img src="${escapeHtml(attachment.attachmentUrl)}" alt="${escapeHtml(attachment.fileName)}" class="attachment-thumb" loading="lazy" />`
                                  : `<span class="btn btn-sm btn-light disabled"><i class="fa-solid fa-link"></i></span>`
                              }
                              <span>${escapeHtml(attachment.fileName)}</span>
                            </div>
                          </td>
                          <td>${escapeHtml(attachment.attachmentType || "-")}</td>
                          <td>${escapeHtml(getRelationLabel(attachment, state))}</td>
                          <td>${formatDate(attachment.createdAt)}</td>
                          <td>${escapeHtml(attachment.uploadedByName || "-")}</td>
                          <td>
                            <a href="${escapeHtml(attachment.attachmentUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-primary">
                              <i class="fa-solid fa-up-right-from-square"></i>
                              فتح المرفق
                            </a>
                          </td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
          : emptyState("لا توجد مرفقات مرفوعة حتى الآن.")
      }
    </section>
  `;
}

export function getAttachmentForm(state) {
  const relationOptions = [
    ...[...state.data.apartments]
      .filter((item) => !item.isArchived)
      .sort((firstApartment, secondApartment) => compareTextAsc(firstApartment.apartmentNumber, secondApartment.apartmentNumber))
      .map((item) => ({ value: `apartment::${item.id}`, label: `شقة ${item.apartmentNumber} - ${getApartmentResidentName(item) || "-"}` })),
    ...[...state.data.expenses]
      .sort((firstExpense, secondExpense) => compareDateAsc(firstExpense.date, secondExpense.date))
      .map((item) => ({ value: `expense::${item.id}`, label: `مصروف - ${item.title}` })),
    ...[...state.data.payments]
      .sort((firstPayment, secondPayment) => compareDateAsc(firstPayment.paymentDate, secondPayment.paymentDate))
      .map((item) => {
      const charge = state.data.monthlyCharges.find((chargeItem) => chargeItem.id === item.monthlyChargeId);
      return {
        value: `payment::${item.id}`,
        label: `دفعة - شقة ${charge?.apartmentNumber || "-"} - ${item.amount} جنيه`,
      };
    }),
    ...[...state.data.monthlyCharges]
      .sort((firstCharge, secondCharge) => compareTextAsc(firstCharge.apartmentNumber, secondCharge.apartmentNumber))
      .map((item) => ({
      value: `charge::${item.id}`,
      label: `تحصيل - شقة ${item.apartmentNumber} - ${item.month}/${item.year}`,
    })),
  ];

  return `
    <form id="attachment-form">
      <div class="row g-3">
        <div class="col-md-6">
          <label class="form-label">نوع المرفق</label>
          <select class="form-select" name="attachmentType" required>
            <option value="">اختر</option>
            ${ATTACHMENT_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("")}
          </select>
        </div>
        <div class="col-md-6">
          <label class="form-label">الربط</label>
          <select class="form-select" name="relatedReference" required>
            <option value="">اختر العنصر المرتبط</option>
            ${relationOptions.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("")}
          </select>
        </div>
        <div class="col-12">
          <label class="form-label">رابط المرفق</label>
          <input class="form-control" type="url" name="attachmentUrl" placeholder="https://example.com/file.jpg" required />
          <div class="form-text">إذا كان الرابط لصورة بصيغة jpg أو jpeg أو png أو webp ستظهر معاينة مصغرة داخل النظام.</div>
        </div>
      </div>
      <div class="d-flex justify-content-end gap-2 mt-4">
        <button type="button" class="btn btn-light" data-bs-dismiss="modal">إلغاء</button>
        <button type="submit" class="btn btn-primary">حفظ الرابط</button>
      </div>
    </form>
  `;
}
