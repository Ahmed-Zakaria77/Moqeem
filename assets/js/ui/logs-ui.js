import { compareDateAsc, escapeHtml, formatDateTime } from "../utils/helpers.js";
import { emptyState } from "./layout.js";

export function renderLogsSection(state) {
  const activityLogs = [...state.data.activityLogs].sort((firstLog, secondLog) =>
    compareDateAsc(firstLog.createdAt, secondLog.createdAt),
  );

  return `
    <section class="section-card">
      <div class="section-card__header">
        <div>
          <h2 class="h5 mb-1">سجل التعديلات</h2>
          <p class="text-muted mb-0">هذا القسم يظهر للأدمن فقط</p>
        </div>
      </div>

      ${
        activityLogs.length
          ? `<div class="table-responsive">
              <table class="table table-hover">
                <thead>
                  <tr>
                    <th>العملية</th>
                    <th>القسم</th>
                    <th>الوصف</th>
                    <th>المستخدم</th>
                    <th>التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  ${activityLogs
                    .map(
                      (log) => `
                        <tr>
                          <td>${escapeHtml(log.action)}</td>
                          <td>${escapeHtml(log.section)}</td>
                          <td>${escapeHtml(log.description)}</td>
                          <td>${escapeHtml(log.userName || "-")}</td>
                          <td>${formatDateTime(log.createdAt)}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>`
          : emptyState("لا توجد عمليات مسجلة بعد.")
      }
    </section>
  `;
}
