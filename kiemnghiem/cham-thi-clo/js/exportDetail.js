// =====================================================
// exportDetail.js - Bảng điểm chi tiết BM17, 3 nhóm CLO
// Mỗi CLO gồm 2 cột: Số câu đúng + Điểm đóng góp.
// =====================================================
import {
    loadTemplateWorkbook,
    orderedCloList,
    cloDisplayName,
    resizeDataArea,
    setScoreCell,
    saveWorkbook,
    sanitizeTemplateStaticContent,
    exportSbdValue
} from "./exportCommon.js";

const TEMPLATE_URL = "templates/DetailTemplate.xlsx";
const MAX_CLO = 3;

export async function buildDetailWorkbook(answerData, untData, templateBuffer = null) {
    let workbook;
    if (templateBuffer) {
        const ExcelJS = globalThis.ExcelJS;
        if (!ExcelJS) throw new Error("Không tải được ExcelJS.");
        workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(templateBuffer);
    } else {
        workbook = await loadTemplateWorkbook(TEMPLATE_URL);
    }

    const worksheet = workbook.worksheets[0];
    sanitizeTemplateStaticContent(worksheet);
    const students = untData?.exportStudents || (untData?.students || []).filter(s => s.result && !s.result.error);
    const cloList = orderedCloList(answerData);

    if (cloList.length > MAX_CLO) {
        throw new Error(
            `Mẫu Bảng điểm chi tiết chỉ có ${MAX_CLO} nhóm CLO, nhưng file đáp án có ${cloList.length} CLO. ` +
            "Không xuất để tránh làm mất dữ liệu CLO."
        );
    }

    resizeDataArea(worksheet, students.length, 12);

    const examCode = Object.keys(answerData?.exams || {})[0];
    const exam = answerData?.exams?.[examCode];

    for (let i = 0; i < MAX_CLO; i++) {
        const clo = cloList[i];
        const startCol = 3 + i * 2;
        worksheet.getCell(10, startCol).value = clo
            ? `${cloDisplayName(clo, i)}: ${exam?.cloCount?.[clo] || 0} câu`
            : `CLO${i + 1}: ... câu`;
    }

    students.forEach((student, index) => {
        const row = worksheet.getRow(12 + index);
        row.getCell(1).value = index + 1;
        row.getCell(2).value = exportSbdValue(student.sbd);

        for (let i = 0; i < MAX_CLO; i++) {
            const clo = cloList[i];
            const correctCol = 3 + i * 2;
            const scoreCol = correctCol + 1;

            if (clo) {
                row.getCell(correctCol).value = student.result ? Number(student.result.clo?.[clo]?.correctCount || 0) : null;
                setScoreCell(row.getCell(scoreCol), student.result?.detail?.[clo]?.score);
            } else {
                row.getCell(correctCol).value = null;
                row.getCell(scoreCol).value = null;
            }
        }

        setScoreCell(row.getCell(9), student.result?.marks?.GPA);
        row.getCell(10).value = student.officeNote ?? null;
    });

    return workbook;
}

export async function exportDetail(answerData, untData) {
    const workbook = await buildDetailWorkbook(answerData, untData);
    await saveWorkbook(workbook, "Bang-diem-chi-tiet.xlsx");
}
