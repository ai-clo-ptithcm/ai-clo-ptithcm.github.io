// ============================================
// grader.js
// Version 3.1 - Renamed detail to questionDetail
// ============================================

export function gradeAllStudents(answerData, untData) {
    const students = untData?.students || [];

    for (const student of students) {
        gradeStudent(student, answerData);
    }
}

export function gradeStudent(student, answerData) {
    const exam = answerData?.exams?.[student.examCode];

    if (!exam) {
        student.result = {
            error: "Không tìm thấy mã đề"
        };
        return;
    }

    let correct = 0;
    let wrong = 0;
    const questionDetail = [];
    const totalQuestion = exam.totalQuestion || 0;

    for (let q = 1; q <= totalQuestion; q++) {
        const item = gradeQuestion(student, exam, q);
        questionDetail.push(item);

        if (item.correct) {
            correct++;
        } else {
            wrong++;
        }
    }

    // Đổi tên detail thành questionDetail để tránh trùng lặp dữ liệu với score.js
    student.result = {
        correct: correct,
        wrong: wrong,
        total: totalQuestion,
        questionDetail: questionDetail
    };

    student.result.clo = countCorrectByCLO(student, exam);
}

function gradeQuestion(student, exam, questionNumber) {
    const key = exam.questions?.[questionNumber];

    if (!key) {
        return {
            question: questionNumber,
            studentAnswer: "",
            correctAnswer: "",
            clo: "",
            correct: false,
            error: "Không tìm thấy đáp án"
        };
    }

    let studentAnswer = "";
    if (student.answers && questionNumber - 1 < student.answers.length) {
        studentAnswer = String(student.answers[questionNumber - 1]).trim().toUpperCase();
    }

    const correctAnswer = String(key.answer).trim().toUpperCase();

    const validAnswers = ["A", "B", "C", "D"];
    if (!validAnswers.includes(studentAnswer)) {
        studentAnswer = "";
    }

    return {
        question: questionNumber,
        studentAnswer: studentAnswer,
        correctAnswer: correctAnswer,
        clo: key.clo,
        correct: studentAnswer === correctAnswer
    };
}

function countCorrectByCLO(student, exam) {
    const result = {};

    if (!student.result) {
        return result;
    }

    for (const clo in exam.cloCount) {
        result[clo] = {
            questionCount: exam.cloCount[clo],
            correctCount: 0
        };
    }

    // Sửa đường dẫn truy cập thành questionDetail
    student.result.questionDetail.forEach((item) => {
        if (item.correct && result[item.clo]) {
            result[item.clo].correctCount++;
        }
    });

    return result;
}

// Các hàm tiện ích
export function isGraded(student) {
    return student.result != null && !student.result.error;
}

export function countGradedStudents(untData) {
    return (untData?.students || []).filter(isGraded).length;
}

export function countCorrect(questionDetail) {
    return (questionDetail || []).filter(item => item.correct).length;
}

export function countWrong(questionDetail) {
    return (questionDetail || []).filter(item => !item.correct).length;
}

export function getCorrectQuestions(student) {
    if (!student?.result?.questionDetail) return [];
    return student.result.questionDetail.filter(item => item.correct);
}

export function getWrongQuestions(student) {
    if (!student?.result?.questionDetail) return [];
    return student.result.questionDetail.filter(item => !item.correct);
}

export function printStudentResult(student) {
    if (!student.result) return;
    console.log("--------------------------------");
    console.log("SBD :", student.sbd);
    console.log("Mã đề :", student.examCode);
    console.log("Đúng :", student.result.correct);
    console.log("Sai :", student.result.wrong);
    console.table(student.result.questionDetail);
}