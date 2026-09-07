import { normalizeExamCode, rebuildExamCount } from "./untNormalizer.js";

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function suggestMapping(untCode, answerCodes, used) {
    const normalized = normalizeExamCode(untCode);
    if (answerCodes.includes(normalized)) return normalized;

    // Ưu tiên cùng 2 chữ số cuối: 001 -> 101, 002 -> 102, ...
    const suffix = normalized.slice(-2);
    const suffixMatches = answerCodes.filter(code => code.slice(-2) === suffix && !used.has(code));
    if (suffixMatches.length === 1) return suffixMatches[0];

    const available = answerCodes.filter(code => !used.has(code));
    if (available.length === 1) return available[0];
    return available[0] || answerCodes[0] || "";
}

export function getExamCodeMismatch(answerData, untData) {
    const answerCodes = Object.keys(answerData?.exams || {}).map(normalizeExamCode).sort();
    const answerSet = new Set(answerCodes);
    const counts = {};

    for (const student of untData?.students || []) {
        const code = normalizeExamCode(student.examCode);
        if (!answerSet.has(code)) counts[code] = (counts[code] || 0) + 1;
    }

    return {
        answerCodes,
        mismatchCodes: Object.keys(counts).sort(),
        counts,
        studentCount: Object.values(counts).reduce((sum, n) => sum + n, 0)
    };
}

export function reviewExamCodeMapping({ container, answerData, untData }) {
    const mismatch = getExamCodeMismatch(answerData, untData);
    if (!mismatch.studentCount) return Promise.resolve({});

    return new Promise((resolve, reject) => {
        const used = new Set();
        const mappingRows = mismatch.mismatchCodes.map(code => {
            const suggested = suggestMapping(code, mismatch.answerCodes, used);
            if (suggested) used.add(suggested);
            const options = mismatch.answerCodes.map(answerCode =>
                `<option value="${escapeHtml(answerCode)}" ${answerCode === suggested ? "selected" : ""}>${escapeHtml(answerCode)}</option>`
            ).join("");
            return `
                <tr>
                    <td><b>${escapeHtml(code)}</b></td>
                    <td>${mismatch.counts[code]}</td>
                    <td class="mapping-arrow">→</td>
                    <td><select class="exam-map-select" data-unt-code="${escapeHtml(code)}">${options}</select></td>
                </tr>`;
        }).join("");

        container.innerHTML = `
            <div class="result-box review-panel exam-code-review">
                <div class="result-head">
                    <div>
                        <span class="section-kicker">KIỂM TRA MÃ ĐỀ</span>
                        <h2 class="result-title">Có ${mismatch.studentCount} sinh viên làm mã đề khác với file đáp án!</h2>
                    </div>
                    <span class="warning-pill">Cần xác nhận</span>
                </div>
                <p class="review-description">Nếu giảng viên chỉ ghi khác cách đánh số mã đề, hãy xác nhận mã tương ứng bên dưới. Ví dụ: <b>001 (UnT) → 101 (file đáp án)</b>. Hệ thống chỉ dùng ánh xạ này để chấm, không sửa file gốc.</p>
                <div class="table-wrapper compact-review-table">
                    <table>
                        <thead><tr><th>Mã đề trong UnT</th><th>Số sinh viên</th><th></th><th>Mã đề dùng để chấm</th></tr></thead>
                        <tbody>${mappingRows}</tbody>
                    </table>
                </div>
                <div class="review-actions">
                    <button type="button" class="secondary-action" id="cancelExamMapping">Hủy</button>
                    <button type="button" class="primary-inline-action" id="confirmExamMapping">Xác nhận mã đề và chấm tiếp</button>
                </div>
            </div>`;

        container.querySelector("#confirmExamMapping")?.addEventListener("click", () => {
            const mapping = {};
            container.querySelectorAll(".exam-map-select").forEach(select => {
                mapping[select.dataset.untCode] = normalizeExamCode(select.value);
            });

            for (const student of untData.students) {
                const original = normalizeExamCode(student.examCode);
                student.originalExamCode = student.originalExamCode || original;
                if (mapping[original]) student.examCode = mapping[original];
            }
            rebuildExamCount(untData);
            untData.examCodeMapping = mapping;
            resolve(mapping);
        });

        container.querySelector("#cancelExamMapping")?.addEventListener("click", () => {
            const error = new Error("Đã hủy xác nhận mã đề. Chưa thực hiện chấm bài.");
            error.name = "UserCancelledError";
            reject(error);
        });
    });
}
