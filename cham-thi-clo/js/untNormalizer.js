// =====================================================
// untNormalizer.js
// Nhận diện cấu trúc UnT linh hoạt và không phụ thuộc mã đề đáp án.
// =====================================================

const ANSWERS = new Set(["A", "B", "C", "D"]);

function stripAccents(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/gi, "d")
        .trim()
        .toLowerCase();
}

function compact(value) {
    return stripAccents(value).replace(/[^a-z0-9]/g, "");
}

export function normalizeExamCode(value) {
    let code = String(value ?? "").trim();
    if (/^\d+$/.test(code)) code = code.padStart(3, "0");
    return code;
}

export function isValidSbd(value) {
    const s = String(value ?? "").trim();
    return /^\d+$/.test(s) && Number(s) > 0;
}

export function normalizeSbd(value) {
    const s = String(value ?? "").trim();
    return /^\d+$/.test(s) && Number(s) > 0 ? String(Number(s)) : "";
}

function isMissingSbd(value) {
    const s = String(value ?? "").trim();
    return !s || /^[-–—_]+$/.test(s);
}

function findHeader(data, questionCount) {
    const maxRows = Math.min(data.length, 20);

    for (let r = 0; r < maxRows; r++) {
        const row = data[r] || [];
        let sbdCol = -1;
        let examCol = -1;

        for (let c = 0; c < row.length; c++) {
            const text = compact(row[c]);
            if (text === "sbd" || text === "sobaodanh" || text === "maphach" || text === "sophach") sbdCol = c;
            if (text === "made" || text === "madethi") examCol = c;
        }

        if (sbdCol < 0 || examCol < 0) continue;

        const questionCols = [];
        for (let q = 1; q <= questionCount; q++) {
            let found = -1;
            for (let c = 0; c < row.length; c++) {
                const raw = String(row[c] ?? "").trim();
                if (/^\d+$/.test(raw) && Number(raw) === q) {
                    found = c;
                    break;
                }
            }
            if (found < 0) break;
            questionCols.push(found);
        }

        if (questionCols.length === questionCount) {
            return { headerRow: r, sbdCol, examCol, questionCols, mode: "header" };
        }
    }
    return null;
}

function answerEvidence(row, answerCols) {
    const probe = Math.min(answerCols.length, 8);
    if (!probe) return 0;
    let valid = 0;
    for (let i = 0; i < probe; i++) {
        if (ANSWERS.has(String(row?.[answerCols[i]] ?? "").trim().toUpperCase())) valid++;
    }
    return valid / probe;
}

function rowLooksLikeStudent(row, examCol, answerCols) {
    const exam = normalizeExamCode(row?.[examCol]);
    if (!exam) return false;
    return answerEvidence(row, answerCols) >= 0.5;
}

function scoreExamColumn(data, col, validExamCodes) {
    let checked = 0;
    let matches = 0;
    for (let r = 0; r < Math.min(data.length, 80); r++) {
        const raw = String(data[r]?.[col] ?? "").trim();
        if (!raw) continue;
        checked++;
        if (validExamCodes.has(normalizeExamCode(raw))) matches++;
    }
    return checked === 0 ? 0 : matches / checked;
}

function genericExamColumnScore(data, col) {
    const values = [];
    for (let r = 0; r < Math.min(data.length, 80); r++) {
        const raw = String(data[r]?.[col] ?? "").trim();
        if (/^[A-Za-z0-9_-]{1,8}$/.test(raw) && !ANSWERS.has(raw.toUpperCase())) values.push(raw);
    }
    if (values.length < 2) return 0;
    const unique = new Set(values);
    // Mã đề thường lặp lại giữa nhiều sinh viên và chỉ có ít giá trị khác nhau.
    return (values.length / Math.max(unique.size, 1)) * Math.min(values.length / 10, 1);
}

function answerRatio(data, col, validRows) {
    let checked = 0;
    let matches = 0;
    for (const r of validRows.slice(0, 50)) {
        const raw = String(data[r]?.[col] ?? "").trim().toUpperCase();
        if (!raw) continue;
        checked++;
        if (ANSWERS.has(raw)) matches++;
    }
    return checked === 0 ? 0 : matches / checked;
}

function inferStructure(data, questionCount, validExamCodes) {
    const maxCols = Math.max(0, ...data.slice(0, 80).map(row => row?.length || 0));
    let examCol = -1;
    let bestExamScore = 0;

    // Ưu tiên mã đề trùng file đáp án nếu có.
    for (let c = 0; c < maxCols; c++) {
        const score = scoreExamColumn(data, c, validExamCodes);
        if (score > bestExamScore) {
            bestExamScore = score;
            examCol = c;
        }
    }

    // Nếu mã đề UnT khác hoàn toàn file đáp án, tìm cột mã đề theo đặc trưng lặp.
    if (examCol < 0 || bestExamScore < 0.5) {
        examCol = -1;
        bestExamScore = 0;
        for (let c = 0; c < maxCols; c++) {
            const score = genericExamColumnScore(data, c);
            if (score > bestExamScore) {
                bestExamScore = score;
                examCol = c;
            }
        }
    }

    if (examCol < 0) throw new Error('Không xác định được cột "Mã đề" trong file UnT.');

    const candidateRows = [];
    for (let r = 0; r < data.length; r++) {
        if (String(data[r]?.[examCol] ?? "").trim()) candidateRows.push(r);
    }

    const questionCols = [];
    for (let c = examCol + 1; c < maxCols; c++) {
        if (answerRatio(data, c, candidateRows) >= 0.55) questionCols.push(c);
        if (questionCols.length === questionCount) break;
    }

    if (questionCols.length !== questionCount) {
        throw new Error(
            `File UnT không có đủ ${questionCount} cột câu trả lời từ 1 đến ${questionCount}.\n` +
            `Đã nhận diện được ${questionCols.length} cột câu trả lời.`
        );
    }

    const studentRows = candidateRows.filter(r => rowLooksLikeStudent(data[r], examCol, questionCols));

    let sbdCol = -1;
    let bestSbdScore = -1;
    for (let c = 0; c < examCol; c++) {
        let evidence = 0;
        let checked = 0;
        for (const r of studentRows.slice(0, 60)) {
            const raw = String(data[r]?.[c] ?? "").trim();
            if (!raw) continue;
            checked++;
            if (isValidSbd(raw)) evidence += 1;
            else if (isMissingSbd(raw)) evidence += 3;
        }
        const score = checked ? evidence / checked : 0;
        if (score > bestSbdScore || (score === bestSbdScore && c > sbdCol)) {
            bestSbdScore = score;
            sbdCol = c;
        }
    }

    if (sbdCol < 0) throw new Error('Không xác định được cột "SBD" trong file UnT.');
    if (!studentRows.length) throw new Error("Không tìm thấy dòng dữ liệu sinh viên trong file UnT.");

    return {
        headerRow: -1,
        firstStudentRow: studentRows[0],
        sbdCol,
        examCol,
        questionCols,
        mode: "inferred"
    };
}

/** Chuẩn hóa file UnT thành cấu trúc dùng chung cho grader. */
export function normalizeUntData(data, answerData) {
    if (!Array.isArray(data) || data.length === 0) throw new Error("File UnT không có dữ liệu.");

    const questionCount = Number(answerData?.totalQuestion || 0);
    if (!questionCount) throw new Error("Không xác định được số câu từ file đáp án.");

    const validExamCodes = new Set(Object.keys(answerData?.exams || {}).map(normalizeExamCode));
    const header = findHeader(data, questionCount);
    const structure = header
        ? { ...header, firstStudentRow: header.headerRow + 1 }
        : inferStructure(data, questionCount, validExamCodes);

    const students = [];
    const examCount = {};

    for (let r = structure.firstStudentRow; r < data.length; r++) {
        const row = data[r] || [];
        if (!rowLooksLikeStudent(row, structure.examCol, structure.questionCols)) continue;

        const examCode = normalizeExamCode(row[structure.examCol]);
        const answers = structure.questionCols.map(c => String(row[c] ?? "").trim().toUpperCase());
        const rawSbd = String(row[structure.sbdCol] ?? "").trim();
        const sbd = isValidSbd(rawSbd) ? String(Number(rawSbd)) : "";

        students.push({
            sourceRow: r,
            excelRow: r + 1,
            sbd,
            rawSbd,
            examCode,
            originalExamCode: examCode,
            answers
        });
        examCount[examCode] = (examCount[examCode] || 0) + 1;
    }

    if (!students.length) {
        throw new Error("Không tìm thấy bài làm sinh viên hợp lệ trong file UnT.");
    }

    return { totalStudent: students.length, questionCount, examCount, students, structure };
}

export function rebuildExamCount(untData) {
    const examCount = {};
    for (const student of untData?.students || []) {
        const code = normalizeExamCode(student.examCode);
        examCount[code] = (examCount[code] || 0) + 1;
    }
    untData.examCount = examCount;
    return examCount;
}

export function validateStudentIds(untData) {
    const seen = new Map();
    const duplicates = [];
    const missing = [];

    for (const student of untData?.students || []) {
        const sbd = String(student.sbd ?? "").trim();
        if (!isValidSbd(sbd)) {
            missing.push(student);
            continue;
        }
        if (seen.has(sbd)) duplicates.push([seen.get(sbd), student]);
        else seen.set(sbd, student);
    }

    if (missing.length) throw new Error(`Còn ${missing.length} dòng chưa có SBD hợp lệ.`);
    // SBD trùng là cảnh báo có thể được giảng viên bỏ qua ở bước xác nhận.
    if (duplicates.length) return { ok: true, duplicates };
    return true;
}
