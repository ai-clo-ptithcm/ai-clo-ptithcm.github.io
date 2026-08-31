// ============================================
// score.js
// Version 5.4 - Polished & Edge-Case Robust CLO Adjustment Logic
// ============================================

export function calculateAllScores(answerData, untData, maxScores) {
    const students = untData?.students || [];

    for (const student of students) {
        calculateStudentScore(student, answerData, maxScores);
    }
}

export function calculateStudentScore(student, answerData, maxScores) {
    if (!student.result) {
        return;
    }

    const exam = answerData?.exams?.[student.examCode];
    if (!exam) {
        return;
    }

    const useCLO = answerData.useCLO === true;
    // Mỗi mã đề có thể có phân bố CLO khác nhau. Vì vậy điểm tối đa
    // của từng CLO phải tính theo chính mã đề của sinh viên, không dùng
    // cơ cấu CLO của mã đề đầu tiên làm chuẩn chung.
    const examMaxScores = {};
    for (const clo in (exam.cloCount || {})) {
        examMaxScores[clo] = exam.totalQuestion > 0
            ? (Number(exam.cloCount[clo] || 0) / exam.totalQuestion) * 10
            : 0;
    }

    const cloStatistic = student.result.clo || {};
    const marks = {};
    const detail = {}; // Nơi lưu điểm số chi tiết cho từng CLO

    const totalCorrect = student.result.correct;
    const totalQuestion = student.result.total;

    // 1. GPA
    const gpa = calculateGPA(totalCorrect, totalQuestion);

    // Nếu không sử dụng CLO thì chỉ lưu GPA
if (!useCLO) {
    student.result = {
        ...student.result,
        marks: {
            GPA: gpa
        },
        detail: {}
    };
    return;
}

    // 2. Tính từng CLO
    for (const clo in cloStatistic) {
        const correctQuestion = cloStatistic[clo].correctCount;
        const questionCount = cloStatistic[clo].questionCount;

        marks[clo] = calculateMarkScore(correctQuestion, questionCount);

        detail[clo] = {
            correctCount: correctQuestion,
            score: calculateDetailScore(
                correctQuestion,
                questionCount,
                examMaxScores[clo]
            )
        };
    }

    // 3. Hiệu chỉnh
    adjustDetailScore(detail, gpa, examMaxScores);

    // 4. Lưu kết quả mà KHÔNG đè lên questionDetail
    student.result = {
        ...student.result, // Giữ nguyên questionDetail, correct, wrong, total
        marks: {
            ...marks,
            GPA: gpa
        },
        detail: JSON.parse(JSON.stringify(detail)) // Chi tiết điểm CLO
    };
}

function calculateMarkScore(correctQuestion, totalQuestion) {
    if (totalQuestion <= 0) return 0;
    return Math.round((correctQuestion * 10 / totalQuestion) * 10) / 10;
}

function calculateGPA(correctQuestion, totalQuestion) {
    if (totalQuestion <= 0) return 0;
    return Math.round((correctQuestion * 10 / totalQuestion) * 10) / 10;
}

function calculateDetailScore(correctQuestion, totalQuestion, maxScore) {
    if (totalQuestion <= 0) return 0;
    return Math.round((correctQuestion * maxScore / totalQuestion) * 10) / 10;
}

function adjustDetailScore(detail, gpa, maxScores) {
    const clos = Object.keys(detail);

    // Vòng lặp liên tục điều chỉnh từng nấc 0.1 cho đến khi delta === 0 hoặc không còn CLO nào hợp lệ
    while (true) {

        // 1. Tính tổng điểm CLO hiện tại
        let total = 0;
        for (const clo of clos) {
            total += detail[clo].score;
        }

        // Làm tròn delta về 1 chữ số thập phân để tránh lỗi số thực (floating point issue)
        let delta = Number((gpa - total).toFixed(1));

        // Nếu tổng CLO đã bằng GPA thì hoàn tất
        if (delta === 0) return;

        let changed = false;

        // ==========================
        // TH1: Cần cộng thêm (delta > 0)
        // ==========================
        if (delta > 0) {

            // Duyệt từ CLO_n về CLO_1
            for (let i = clos.length - 1; i >= 0; i--) {

                const clo = clos[i];
                const current = detail[clo].score;
                const max = Number(maxScores[clo]);

                // CLO <= 0 thì KHÔNG được cộng (chặn an toàn tuyệt đối sai số số thực)
                if (current <= 0) continue;

                // CLO đã đạt điểm tối đa thì KHÔNG được cộng
                if (current >= max) continue;

                // Cộng thêm 0.1
                detail[clo].score = Number((current + 0.1).toFixed(1));
                changed = true;
                break; // Thoát vòng lặp duyệt để tính lại delta cho bước tiếp theo
            }
        }

        // ==========================
        // TH2: Cần trừ bớt (delta < 0)
        // ==========================
        else {

            // Duyệt từ CLO_n về CLO_1
            for (let i = clos.length - 1; i >= 0; i--) {

                const clo = clos[i];
                const current = detail[clo].score;

                // Chỉ cần current > 0 là ĐƯỢC PHÉP TRỪ (kể cả khi đang ở maxScore)
                if (current <= 0) continue;

                // Trừ đi 0.1
                detail[clo].score = Number((current - 0.1).toFixed(1));
                changed = true;
                break; // Thoát vòng lặp duyệt để tính lại delta cho bước tiếp theo
            }
        }

        // Nếu qua cả 2 nhánh mà không có CLO nào thay đổi được nữa (ví dụ bị giới hạn)
        // thì dừng để tránh vòng lặp vô tận
        if (!changed) return;
    }
}