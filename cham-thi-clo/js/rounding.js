// ============================================
// rounding.js
// Version 3.0
// Part 1 / 3
// ============================================



//------------------------------------------------
// Làm tròn đến 1 chữ số thập phân
//------------------------------------------------

function round1(value){

    return Number(

        (value + Number.EPSILON)

            .toFixed(1)

    );

}





//------------------------------------------------
// Làm tròn điểm của một sinh viên
//------------------------------------------------

function roundStudent(student){

    //--------------------------------------------

    if(!student.result){

        return;

    }

    //--------------------------------------------

    const componentScore =
        student.result.componentScore;

    //--------------------------------------------

    const rounded = {};

    const errors = [];

    //--------------------------------------------

    for(const clo in componentScore){

        const original =
            componentScore[clo];

        const value =
            round1(original);

        //----------------------------------------

        rounded[clo] = value;

        //----------------------------------------

        errors.push({

            clo: clo,

            original: original,

            rounded: value,

            error:
                original - value

        });

    }

    //--------------------------------------------

    student.result.roundComponentScore =
        rounded;

    student.result.roundTotalScore =
        round1(

            student.result.totalScore

        );

    //--------------------------------------------

    adjustDifference(

        student,

        errors

    );

}
// ============================================
// rounding.js
// Version 3.0
// Part 2 / 3
// ============================================



//------------------------------------------------
// Điều chỉnh để:
// Tổng điểm CLO = Tổng điểm sau làm tròn
//------------------------------------------------

function adjustDifference(student, errors){

    const rounded =
        student.result.roundComponentScore;

    const maxScores =
        student.result.maxScores;

    const target =
        student.result.roundTotalScore;

    //--------------------------------------------
 //--------------------------------------------

    if(!maxScores){

        console.warn(

            "Missing maxScores."

        );

        return;

    }

    //--------------------------------------------

    let current = 0;

    for(const clo in rounded){

        current += rounded[clo];

    }

    current = round1(current);

    //--------------------------------------------

    let difference =
        round1(target - current);

    if(difference === 0){

        return;

    }

    //--------------------------------------------

    const increase =
        difference > 0;

    //--------------------------------------------

    let steps = Math.round(

        Math.abs(difference) * 10

    );

    //--------------------------------------------

    if(steps > errors.length){

        console.warn(

            "Không thể điều chỉnh đủ tổng điểm."

        );

        steps = errors.length;

    }

    //--------------------------------------------

    errors.sort(function(a, b){

        if(increase){

            return b.error - a.error;

        }

        return a.error - b.error;

    });

    //--------------------------------------------

    let adjusted = 0;

    //--------------------------------------------

    for(const item of errors){

        if(adjusted >= steps){

            break;

        }

        const clo = item.clo;

        const value =
            rounded[clo];

        const max =
    maxScores && maxScores[clo] != null
        ? Number(maxScores[clo])
        : Number.MAX_SAFE_INTEGER;

        //----------------------------------------

        if(increase){

            if(value + 0.1 > max){

                continue;

            }

            rounded[clo] = round1(

                value + 0.1

            );

        }

        //----------------------------------------

        else{

            if(value - 0.1 < 0){

                continue;

            }

            rounded[clo] = round1(

                value - 0.1

            );

        }

        //----------------------------------------

        adjusted++;

    }

    //--------------------------------------------

    if(adjusted < steps){

        console.warn(

            "Không đủ CLO để điều chỉnh."

        );

    }
	let finalTotal = 0;

for(const clo in rounded){

    finalTotal += rounded[clo];

}

finalTotal = round1(finalTotal);

if(finalTotal !== target){

    console.warn(

        "Rounded total mismatch.",

        finalTotal,

        target

    );

}

}
// ============================================
// rounding.js
// Version 3.0
// Part 3 / 3
// ============================================



//------------------------------------------------
// Làm tròn toàn bộ sinh viên
//------------------------------------------------

function roundAllStudents(untData){

    const students =
        untData.students;

    for(let i = 0;
        i < students.length;
        i++){

        roundStudent(

            students[i]

        );

    }

}



//------------------------------------------------
// In điểm sau làm tròn của một sinh viên
//------------------------------------------------

function printRoundedScore(student){

    if(!student.result){

        return;

    }

    console.log(

        "------------------------------"

    );

    console.log(

        "SBD :",

        student.sbd

    );

    console.log(

        "Mã đề :",

        student.examCode

    );

    console.log(

        "Điểm CLO sau làm tròn :"

    );

    console.table(

        student.result.roundComponentScore

    );

    console.log(

        "Tổng điểm :",

        student.result.roundTotalScore

    );

}



//------------------------------------------------
// In điểm sau làm tròn toàn lớp
//------------------------------------------------

function printAllRoundedScores(untData){

    untData.students.forEach(

        function(student){

            printRoundedScore(

                student

            );

        }

    );

}



//------------------------------------------------
// Làm tròn và in kết quả
//------------------------------------------------

function roundAndSummary(untData){

    roundAllStudents(

        untData

    );

    printAllRoundedScores(

        untData

    );

}

