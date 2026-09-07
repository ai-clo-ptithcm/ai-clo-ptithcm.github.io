// =====================================================
// exportMark.js - Bảng điểm theo phách BM17, giữ 5 cột CLO
// =====================================================
import {
    loadTemplateWorkbook,
    orderedCloList,
    cloDisplayName,
    resizeDataArea,
    numberToVietnamese,
    setScoreCell,
    saveWorkbook,
    sanitizeTemplateStaticContent,
    exportSbdValue
} from "./exportCommon.js";

const TEMPLATE_URL = "templates/MarksTemplate.xlsx";
const MAX_CLO = 5;

export async function buildMarkWorkbook(answerData, untData, templateBuffer = null) {
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
        throw new Error(`Mẫu Bảng điểm chỉ có ${MAX_CLO} cột CLO, nhưng file đáp án có ${cloList.length} CLO.`);
    }

    resizeDataArea(worksheet, students.length, 12);

    const examCode = Object.keys(answerData?.exams || {})[0];
    const exam = answerData?.exams?.[examCode];
    const totalQuestion = Number(answerData?.totalQuestion || 0);

    // 5 vị trí CLO C:G luôn được giữ nguyên.
    for (let i = 0; i < MAX_CLO; i++) {
        const col = 3 + i;
        const clo = cloList[i];
        worksheet.getCell(10, col).value = clo ? `Điểm \n${cloDisplayName(clo, i)}` : "Điểm \nCLO…";
        // Tỷ trọng CLO phụ thuộc từng học phần, không tự suy ra từ số câu.
        // Giảng viên điền sau theo quy định của môn.
        worksheet.getCell(11, col).value = "...";
    }

    students.forEach((student, index) => {
        const row = worksheet.getRow(12 + index);
        row.getCell(1).value = index + 1;
        row.getCell(2).value = exportSbdValue(student.sbd);

        for (let i = 0; i < MAX_CLO; i++) {
            const clo = cloList[i];
            if (clo) setScoreCell(row.getCell(3 + i), student.result?.marks?.[clo]);
            else row.getCell(3 + i).value = null;
        }

        const gpa = student.result?.marks?.GPA;
        setScoreCell(row.getCell(8), gpa);
        row.getCell(9).value = gpa === null || gpa === undefined ? null : numberToVietnamese(gpa);
        row.getCell(10).value = student.officeNote ?? null;
    });

    return workbook;
}

export async function exportMark(answerData, untData) {
    const workbook = await buildMarkWorkbook(answerData, untData);
    await saveWorkbook(workbook, "Bang-diem-phach.xlsx");
}
