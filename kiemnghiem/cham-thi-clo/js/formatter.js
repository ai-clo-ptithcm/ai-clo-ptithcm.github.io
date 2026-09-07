// ======================================================
// formatter.js
// Định dạng chung cho các file Excel xuất từ exam-clo
// ======================================================

// ---------------------------
// Font
// ---------------------------

const DEFAULT_FONT = {
    name: "Times New Roman",
    size: 12
};

// ---------------------------
// Header
// ---------------------------

const HEADER_FONT = {
    name: "Times New Roman",
    size: 12,
    bold: true
};

const HEADER_FILL = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
        argb: "D9EAD3"
    }
};

// ---------------------------
// Border
// ---------------------------

const THIN_BORDER = {
    top: {
        style: "thin"
    },
    left: {
        style: "thin"
    },
    bottom: {
        style: "thin"
    },
    right: {
        style: "thin"
    }
};

// ---------------------------
// Alignment
// ---------------------------

const DEFAULT_ALIGNMENT = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true
};

// ======================================================
// Áp dụng font
// ======================================================

function applyFont(worksheet) {
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.font = DEFAULT_FONT;
        });
    });
}

// ======================================================
// Định dạng Header
// ======================================================

function applyHeaderStyle(worksheet) {
    const header = worksheet.getRow(1);
    header.eachCell((cell) => {
        cell.font = HEADER_FONT;
        cell.fill = HEADER_FILL;
    });
}

// ======================================================
// Áp dụng Border
// ======================================================

function applyBorder(worksheet) {
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.border = THIN_BORDER;
        });
    });
}

// ======================================================
// Áp dụng căn lề
// ======================================================

function applyAlignment(worksheet) {
    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.alignment = DEFAULT_ALIGNMENT;
        });
    });
}

// ======================================================
// AutoFit chiều rộng cột
// ======================================================

function autoFitColumns(worksheet) {
    worksheet.columns.forEach((column) => {
        let maxLength = 10;
        column.eachCell({ includeEmpty: true }, (cell) => {
            const value = cell.value == null ? "" : cell.value.toString();
            maxLength = Math.max(maxLength, value.length);
        });
        column.width = Math.min(maxLength + 2, 40);
    });
}

// ======================================================
// Kiểm tra cột điểm (GPA, CLO1, CLO2, CLO3...)
// ======================================================

function isScoreColumn(header) {
    if (!header) return false;
    const text = header.toString().trim().toUpperCase();
    if (text === "GPA") return true;
    return /^CLO\d+$/.test(text);
}

// ======================================================
// Định dạng số cho các cột điểm (VD: 7 -> 7.0)
// ======================================================

function applyNumberFormat(worksheet) {
    worksheet.getRow(1).eachCell((cell) => {
        if (!isScoreColumn(cell.value)) return;

        const column = worksheet.getColumn(cell.col);
        column.eachCell((scoreCell, rowNumber) => {
            if (rowNumber === 1) return;
            if (typeof scoreCell.value === "number") {
                scoreCell.numFmt = "0.0";
            }
        });
    });
}

// ======================================================
// Định dạng toàn bộ Worksheet (Export duy nhất hàm này)
// ======================================================

export function formatWorksheet(worksheet) {
    applyFont(worksheet);
    applyHeaderStyle(worksheet);
    applyBorder(worksheet);
    applyAlignment(worksheet);
    applyNumberFormat(worksheet);
    autoFitColumns(worksheet);
}