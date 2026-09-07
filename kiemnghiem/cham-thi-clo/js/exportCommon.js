// =====================================================
// exportCommon.js - helpers dùng chung cho 2 mẫu BM17
// =====================================================

export function getExcelJS() {
    const ExcelJS = globalThis.ExcelJS;
    if (!ExcelJS) throw new Error("Không tải được ExcelJS. Vui lòng kiểm tra thư mục libs.");
    return ExcelJS;
}

export async function loadTemplateWorkbook(templateUrl) {
    const ExcelJS = getExcelJS();
    const response = await fetch(templateUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`Không tải được mẫu Excel: ${templateUrl}`);
    const buffer = await response.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    return workbook;
}

export function orderedCloList(answerData) {
    const examCode = Object.keys(answerData?.exams || {})[0];
    const clos = Object.keys(answerData?.exams?.[examCode]?.cloCount || {});
    return clos.sort((a, b) => {
        const na = Number(String(a).match(/\d+(?:\.\d+)?/)?.[0]);
        const nb = Number(String(b).match(/\d+(?:\.\d+)?/)?.[0]);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a).localeCompare(String(b), "vi");
    });
}

export function cloDisplayName(clo, fallbackIndex) {
    const raw = String(clo ?? "").trim();
    const withoutPrefix = raw.replace(/^CLO\s*/i, "");
    return `CLO${withoutPrefix || fallbackIndex + 1}`;
}

function findFooterRow(worksheet) {
    let footerRow = -1;
    worksheet.eachRow({ includeEmpty: true }, row => {
        if (footerRow > 0) return;
        const text = String(row.getCell(2).value ?? "").trim().toLowerCase();
        if (text.startsWith("số bài:") || text.startsWith("so bai:")) footerRow = row.number;
    });
    if (footerRow < 0) throw new Error("Mẫu Excel không tìm thấy vùng 'Số bài'.");
    return footerRow;
}

function cloneStyle(style) {
    if (!style) return {};
    if (typeof structuredClone === "function") return structuredClone(style);
    return JSON.parse(JSON.stringify(style));
}

function copyDataRowStyle(worksheet, sourceRowNumber, targetRowNumber, colCount = 10) {
    const sourceRow = worksheet.getRow(sourceRowNumber);
    const targetRow = worksheet.getRow(targetRowNumber);
    targetRow.height = sourceRow.height;

    for (let c = 1; c <= colCount; c++) {
        const source = sourceRow.getCell(c);
        const target = targetRow.getCell(c);
        target.style = cloneStyle(source.style);
        if (source.numFmt) target.numFmt = source.numFmt;
        target.alignment = cloneStyle(source.alignment);
        target.border = cloneStyle(source.border);
        target.fill = cloneStyle(source.fill);
        target.font = cloneStyle(source.font);
    }
}

/**
 * Template có dữ liệu mẫu từ row 12 đến trước 1 dòng trắng + footer.
 * Hàm co/giãn đúng số sinh viên, vẫn giữ footer ở phía dưới.
 */
function shiftRangeRows(range, delta) {
    return String(range).replace(/([A-Z]+)(\d+)/g, (_, col, row) => `${col}${Number(row) + delta}`);
}

function firstRowOfRange(range) {
    const match = String(range).match(/[A-Z]+(\d+)/);
    return match ? Number(match[1]) : -1;
}

/**
 * Template có dữ liệu mẫu từ row 12 đến trước 1 dòng trắng + footer.
 * Co/giãn vùng dữ liệu và chủ động dịch các merge ở footer để Excel không lỗi merge.
 */
export function resizeDataArea(worksheet, studentCount, firstDataRow = 12) {
    if (studentCount < 0) studentCount = 0;

    const footerRow = findFooterRow(worksheet);
    const blankRowBeforeFooter = 1;
    const templateDataCount = footerRow - firstDataRow - blankRowBeforeFooter;
    if (templateDataCount < 1) throw new Error("Mẫu Excel không có vùng dữ liệu hợp lệ.");

    const delta = studentCount - templateDataCount;
    const footerMerges = [...(worksheet.model?.merges || [])]
        .filter(range => firstRowOfRange(range) >= footerRow);

    // ExcelJS không tự dịch merge khi spliceRows, nên unmerge rồi merge lại sau khi dịch hàng.
    for (const range of footerMerges) {
        try { worksheet.unMergeCells(range); } catch (_) { /* ignore */ }
    }

    if (studentCount < templateDataCount) {
        worksheet.spliceRows(firstDataRow + studentCount, templateDataCount - studentCount);
    } else if (studentCount > templateDataCount) {
        const extra = studentCount - templateDataCount;
        const insertAt = firstDataRow + templateDataCount;
        worksheet.spliceRows(insertAt, 0, ...Array.from({ length: extra }, () => []));
        const sourceStyleRow = insertAt - 1;
        for (let i = 0; i < extra; i++) {
            copyDataRowStyle(worksheet, sourceStyleRow, insertAt + i, 10);
        }
    }

    for (const range of footerMerges) {
        const shifted = shiftRangeRows(range, delta);
        try { worksheet.mergeCells(shifted); } catch (err) { console.warn("Không merge lại được", shifted, err); }
    }

    return {
        firstDataRow,
        lastDataRow: studentCount ? firstDataRow + studentCount - 1 : firstDataRow - 1,
        footerRow: findFooterRow(worksheet)
    };
}

export function sanitizeTemplateStaticContent(worksheet) {
    // Loại dữ liệu minh họa cụ thể khỏi mẫu, giữ nguyên bố cục BM17.
    for (let r = 1; r <= Math.min(worksheet.rowCount, 80); r++) {
        for (let c = 1; c <= 10; c++) {
            const cell = worksheet.getCell(r, c);
            const text = String(cell.value ?? "").trim();
            if (/^Ngày thi:/i.test(text) && /\d/.test(text)) {
                cell.value = "Ngày thi: …";
            }
            if (text === "Phan Hoàng Nam" || text === "Đỗ Ngọc Yến") {
                cell.value = null;
            }
        }
    }
}

export function numberToVietnamese(score) {
    if (score == null || Number.isNaN(Number(score))) return "";
    const fixed = Number(score).toFixed(1);
    const [a, b] = fixed.split(".");
    const words = ["Không", "Một", "Hai", "Ba", "Bốn", "Năm", "Sáu", "Bảy", "Tám", "Chín", "Mười"];
    const whole = Number(a);
    const decimal = Number(b);
    const wholeText = whole >= 0 && whole <= 10 ? words[whole] : a;
    const decimalText = decimal >= 0 && decimal <= 9 ? words[decimal].toLowerCase() : b;
    return `${wholeText} phẩy ${decimalText}`;
}


export function exportSbdValue(value) {
    const raw = String(value ?? "").trim();
    if (/^\d+$/.test(raw)) {
        const numeric = Number(raw);
        if (Number.isSafeInteger(numeric)) return numeric;
    }
    return raw;
}

export function setScoreCell(cell, value) {
    if (value == null || value === "" || Number.isNaN(Number(value))) {
        cell.value = null;
        return;
    }
    cell.value = Number(value);
    cell.numFmt = "0.0";
}

export async function saveWorkbook(workbook, filename) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
