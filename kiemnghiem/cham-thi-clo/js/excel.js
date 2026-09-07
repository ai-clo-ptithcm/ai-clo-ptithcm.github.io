// =========================================
// excel.js
// Version 4.1 - Local SheetJS + đáp án dọc/ngang
// =========================================

function getXLSX() {
    const lib = globalThis.XLSX;
    if (!lib) {
        throw new Error("Không tải được thư viện đọc Excel (SheetJS). Vui lòng kiểm tra thư mục libs.");
    }
    return lib;
}

/** Đọc File/Blob Excel thành SheetJS Workbook. */
export async function readExcel(file) {
    const XLSX = getXLSX();
    const arrayBuffer = await file.arrayBuffer();
    return XLSX.read(arrayBuffer, { type: "array" });
}

/** Chuyển worksheet đầu tiên (hoặc sheet được chỉ định) thành mảng 2D. */
export function sheetToArray(workbook, sheetName) {
    const XLSX = getXLSX();
    const targetSheetName = sheetName || workbook.SheetNames?.[0];
    const sheet = workbook.Sheets?.[targetSheetName];

    if (!sheet) throw new Error("Không tìm thấy sheet: " + targetSheetName);

    return XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: true
    });
}

function normalizeExamCode(value) {
    let code = String(value ?? "").trim();
    if (/^\d+$/.test(code)) code = code.padStart(3, "0");
    return code;
}

function newExam() {
    return { totalQuestion: 0, cloCount: {}, questions: {} };
}

function finalizeAnswerData({ sheetName, layout, exams }) {
    const examCodes = Object.keys(exams);
    if (!examCodes.length) throw new Error("Không tìm thấy mã đề trong file đáp án.");

    let useCLO = false;
    for (const code of examCodes) {
        if (Object.values(exams[code].questions).some(q => String(q.clo ?? "").trim() !== "")) {
            useCLO = true;
            break;
        }
    }

    if (useCLO) {
        for (const code of examCodes) {
            const missing = [];
            for (const [questionNum, q] of Object.entries(exams[code].questions)) {
                if (String(q.clo ?? "").trim() === "") missing.push(questionNum);
            }
            if (missing.length) {
                throw new Error(`Mã đề ${code} thiếu CLO ở câu:\n\n${missing.join(", ")}`);
            }
        }
    }

    const totalQuestion = exams[examCodes[0]].totalQuestion;
    for (const code of examCodes) {
        if (exams[code].totalQuestion !== totalQuestion) {
            const detail = examCodes.map(c => `${c}: ${exams[c].totalQuestion} câu`).join("\n");
            throw new Error("Số câu giữa các mã đề không đồng nhất.\n\n" + detail);
        }
    }

    return { sheetName, layout, totalQuestion, useCLO, exams };
}

function parseVerticalAnswer(data, sheetName) {
    if (data.length < 2) throw new Error("File đáp án không chứa đủ dòng dữ liệu.");
    const header = data[0] || [];
    if (String(header[0] ?? "").trim().toLowerCase() !== "câu") {
        throw new Error('Ô đầu tiên phải là "Câu".');
    }

    const exams = {};
    const columnMap = {};

    for (let c = 1; c < header.length; c += 2) {
        const rawCode = String(header[c] ?? "").trim();
        if (!rawCode || rawCode.toUpperCase() === "CLO") continue;

        const cloHeader = String(header[c + 1] ?? "").trim().toUpperCase();
        if (cloHeader !== "" && cloHeader !== "CLO") {
            throw new Error("Sau mỗi mã đề phải là một cột CLO.");
        }

        const examCode = normalizeExamCode(rawCode);
        if (exams[examCode]) throw new Error(`Mã đề ${examCode} xuất hiện nhiều lần trong file đáp án.`);
        exams[examCode] = newExam();
        columnMap[examCode] = { answerColumn: c, cloColumn: c + 1 };
    }

    if (!Object.keys(exams).length) throw new Error("Không tìm thấy mã đề theo dạng dọc.");

    const questionRows = [];
    for (let r = 1; r < data.length; r++) {
        const q = Number(data[r]?.[0]);
        if (Number.isInteger(q) && q > 0) questionRows.push({ q, row: data[r] });
    }
    questionRows.sort((a, b) => a.q - b.q);
    if (!questionRows.length) throw new Error("Không có câu hỏi hợp lệ theo dạng dọc.");

    for (let i = 0; i < questionRows.length; i++) {
        const expected = i + 1;
        if (questionRows[i].q !== expected) {
            throw new Error(`File đáp án phải có đủ câu liên tục từ 1 đến N. Thiếu hoặc sai số câu ${expected}.`);
        }
    }

    for (const { q: questionNum, row } of questionRows) {
        for (const code of Object.keys(exams)) {
            const info = exams[code];
            const cols = columnMap[code];
            const answer = String(row?.[cols.answerColumn] ?? "").trim().toUpperCase();
            const clo = String(row?.[cols.cloColumn] ?? "").trim();

            if (!answer) throw new Error(`Mã đề ${code} thiếu đáp án ở câu ${questionNum}.`);
            if (!["A", "B", "C", "D"].includes(answer)) {
                throw new Error(`Đáp án không hợp lệ.\n\nMã đề: ${code}\nCâu: ${questionNum}\nĐáp án: ${answer}`);
            }

            info.totalQuestion++;
            if (clo !== "") info.cloCount[clo] = (info.cloCount[clo] || 0) + 1;
            info.questions[questionNum] = { answer, clo };
        }
    }

    return finalizeAnswerData({ sheetName, layout: "vertical", exams });
}

function parseHorizontalAnswer(data, sheetName) {
    if (data.length < 2) throw new Error("File đáp án không chứa đủ dòng dữ liệu.");
    const header = data[0] || [];
    if (String(header[0] ?? "").trim().toLowerCase() !== "câu") {
        throw new Error('Ô đầu tiên phải là "Câu".');
    }

    const questionNumbers = [];
    for (let c = 1; c < header.length; c++) {
        const raw = String(header[c] ?? "").trim();
        if (!raw) break;
        const q = Number(raw);
        if (!Number.isInteger(q) || q <= 0) break;
        questionNumbers.push(q);
    }
    if (!questionNumbers.length) throw new Error("Không tìm thấy dãy số câu theo hàng ngang.");
    for (let i = 0; i < questionNumbers.length; i++) {
        if (questionNumbers[i] !== i + 1) {
            throw new Error(`Hàng đầu của đáp án ngang phải là Câu | 1 | 2 | ... | N. Sai tại câu ${i + 1}.`);
        }
    }

    const exams = {};
    let r = 1;
    while (r < data.length) {
        const rawCode = String(data[r]?.[0] ?? "").trim();
        if (!rawCode) { r++; continue; }
        if (rawCode.toUpperCase() === "CLO") {
            throw new Error(`Dòng ${r + 1} bắt đầu bằng CLO nhưng thiếu dòng mã đề ngay phía trên.`);
        }

        const examCode = normalizeExamCode(rawCode);
        if (exams[examCode]) throw new Error(`Mã đề ${examCode} xuất hiện nhiều lần trong file đáp án.`);

        const answerRow = data[r] || [];
        const nextRow = data[r + 1] || [];
        const hasCloRow = String(nextRow?.[0] ?? "").trim().toUpperCase() === "CLO";
        const info = newExam();

        for (let i = 0; i < questionNumbers.length; i++) {
            const q = questionNumbers[i];
            const answer = String(answerRow[i + 1] ?? "").trim().toUpperCase();
            const clo = hasCloRow ? String(nextRow[i + 1] ?? "").trim() : "";

            if (!answer) throw new Error(`Mã đề ${examCode} thiếu đáp án ở câu ${q}.`);
            if (!["A", "B", "C", "D"].includes(answer)) {
                throw new Error(`Đáp án không hợp lệ.\n\nMã đề: ${examCode}\nCâu: ${q}\nĐáp án: ${answer}`);
            }

            info.totalQuestion++;
            if (clo !== "") info.cloCount[clo] = (info.cloCount[clo] || 0) + 1;
            info.questions[q] = { answer, clo };
        }

        exams[examCode] = info;
        r += hasCloRow ? 2 : 1;
    }

    if (!Object.keys(exams).length) throw new Error("Không tìm thấy mã đề theo dạng ngang.");
    return finalizeAnswerData({ sheetName, layout: "horizontal", exams });
}

/**
 * Phân tích Workbook đáp án theo đúng 2 cấu trúc chuẩn của hệ thống:
 * - Dạng dọc: Câu | mã đề | CLO | mã đề | CLO | ...
 * - Dạng ngang: Câu | 1 | 2 | ... | N; mỗi mã đề một hàng, hàng sau là CLO.
 *
 * Nếu workbook có cả hai sheet hợp lệ, ưu tiên dạng dọc vì cấu trúc cặp cột
 * mã đề/CLO rõ ràng hơn. Không gộp dữ liệu từ hai sheet.
 */
export function readAnswerWorkbook(workbook) {
    const sheetNames = workbook.SheetNames || [];
    if (!sheetNames.length) throw new Error("File đáp án không có sheet.");

    const verticalCandidates = [];
    const horizontalCandidates = [];
    const errors = [];

    for (const sheetName of sheetNames) {
        const data = sheetToArray(workbook, sheetName);
        if (!data.length) continue;
        if (String(data[0]?.[0] ?? "").trim().toLowerCase() !== "câu") continue;

        const header = data[0] || [];
        const looksVertical = String(header[2] ?? "").trim().toUpperCase() === "CLO";
        const looksHorizontal = Number(header[1]) === 1 && Number(header[2]) === 2;

        if (looksVertical) {
            try {
                verticalCandidates.push(parseVerticalAnswer(data, sheetName));
            } catch (err) {
                errors.push(`${sheetName} (dọc): ${err.message}`);
            }
            continue;
        }

        if (looksHorizontal) {
            try {
                horizontalCandidates.push(parseHorizontalAnswer(data, sheetName));
            } catch (err) {
                errors.push(`${sheetName} (ngang): ${err.message}`);
            }
        }
    }

    if (verticalCandidates.length) return verticalCandidates[0];
    if (horizontalCandidates.length) return horizontalCandidates[0];

    throw new Error(
        "Không nhận diện được file đáp án chuẩn. Cần có sheet dạng dọc hoặc dạng ngang của hệ thống.\n\n" +
        (errors.slice(0, 6).join("\n") || 'Ô đầu tiên của sheet đáp án phải là "Câu".')
    );
}
