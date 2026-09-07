// js/phach/excelWorkbook.js
function getExcelJS() {
    const ExcelJS = globalThis.ExcelJS;
    if (!ExcelJS) {
        throw new Error("Không tải được ExcelJS để đọc ảnh số phách.");
    }
    return ExcelJS;
}

export async function loadUntWorkbook(file) {
    const ExcelJS = getExcelJS();
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
    return workbook;
}
