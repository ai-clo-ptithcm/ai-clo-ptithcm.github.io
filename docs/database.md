# Database Design — AI-CLO PTIT HCM

Tài liệu thiết kế cơ sở dữ liệu cho hệ thống **AI-CLO PTIT HCM**.

**Version:** 1.0
**Database:** Supabase PostgreSQL
**Project:** AI-CLO PTIT HCM

---

## 1. Mục tiêu

Database phải hỗ trợ:

* Quản lý người dùng.
* Phân quyền Student / Teacher / Admin.
* Quản lý học phần.
* Quản lý các khóa học/lớp học theo từng học kỳ.
* Quản lý sinh viên và giảng viên trong từng khóa học.
* Quản lý ngân hàng câu hỏi.
* Phân loại câu hỏi theo chương, chủ đề, CLO và độ khó.
* Tạo và quản lý đề thi.
* Sau này tích hợp AI.

---

# 2. Các khái niệm chính

Hệ thống phân biệt rõ các khái niệm sau:

### 2.1. Học phần (Subject)

Là môn học mang tính học thuật.

Ví dụ:

```text
Giải tích 1
Đại số tuyến tính
Giải tích 2
```

Một học phần có thể được mở thành nhiều khóa học khác nhau.

---

### 2.2. Khóa học (Course)

Là một lớp/học phần được tổ chức cụ thể trong một học kỳ.

Ví dụ:

```text
Giải tích 1_Nhóm 01_HK1_2026-2027
Giải tích 1_Nhóm 02_HK1_2026-2027
Giải tích 1_Nhóm 01_HK2_2026-2027
```

Một `Course` thuộc về đúng một `Subject`.

Quan hệ:

```text
Subject
   │
   ├── Course 01
   ├── Course 02
   └── Course 03
```

---

### 2.3. Ngân hàng câu hỏi (Question Bank)

Ngân hàng câu hỏi chứa các câu hỏi được giảng viên xây dựng để sử dụng trong các đề thi.

Câu hỏi được phân loại theo:

```text
Subject
 └── Chapter
      └── Topic

Question
 ├── CLO
 └── Difficulty
```

Ngân hàng câu hỏi **không đồng nhất với một Course cụ thể**.

Ví dụ câu hỏi thuộc ngân hàng của `Giải tích 1` có thể được sử dụng cho nhiều khóa học:

```text
Question Bank
      │
      ├── Giải tích 1_Nhóm 01
      ├── Giải tích 1_Nhóm 02
      └── Giải tích 1_Nhóm 03
```

---

# 3. Các bảng chính

Database v1 dự kiến gồm:

```text
profiles
subjects
courses
course_members
chapters
topics
clos
difficulties
questions
question_options
exams
exam_questions
```

Sau này có thể bổ sung:

```text
ai_logs
question_reviews
exam_results
```

---

# 4. Bảng `profiles`

Lưu thông tin người dùng của hệ thống.

Authentication được thực hiện bằng **Supabase Auth**.

Bảng `profiles` lưu thông tin mở rộng của người dùng.

| Field        | Type      | Ý nghĩa                                   |
| ------------ | --------- | ----------------------------------------- |
| `id`         | UUID      | ID người dùng, liên kết với Supabase Auth |
| `full_name`  | TEXT      | Họ và tên                                 |
| `email`      | TEXT      | Email                                     |
| `role`       | TEXT      | `admin`, `teacher`, `student`             |
| `created_at` | TIMESTAMP | Ngày tạo                                  |
| `updated_at` | TIMESTAMP | Ngày cập nhật                             |

Ví dụ:

```text
Nguyễn Văn Nam
role = admin
```

```text
Nguyễn Thị Hoa
role = teacher
```

```text
Trần Văn A
role = student
```

---

# 5. Bảng `subjects`

Lưu thông tin học phần.

Ví dụ:

```text
Giải tích 1
Đại số tuyến tính
Giải tích 2
```

| Field         | Type      | Ý nghĩa      |
| ------------- | --------- | ------------ |
| `id`          | UUID      | ID học phần  |
| `code`        | TEXT      | Mã học phần  |
| `name`        | TEXT      | Tên học phần |
| `description` | TEXT      | Mô tả        |
| `created_at`  | TIMESTAMP | Ngày tạo     |

Ví dụ:

```text
code = MATH101
name = Giải tích 1
```

---

# 6. Bảng `courses`

Lưu các khóa học/lớp học cụ thể.

| Field           | Type      | Ý nghĩa      |
| --------------- | --------- | ------------ |
| `id`            | UUID      | ID khóa học  |
| `subject_id`    | UUID      | Học phần     |
| `name`          | TEXT      | Tên khóa học |
| `group_name`    | TEXT      | Nhóm/lớp     |
| `semester`      | TEXT      | Học kỳ       |
| `academic_year` | TEXT      | Năm học      |
| `created_at`    | TIMESTAMP | Ngày tạo     |

Ví dụ:

```text
subject_id  = Giải tích 1
group_name  = Nhóm 01
semester    = HK1
academic_year = 2026-2027
```

Tên hiển thị:

```text
Giải tích 1_Nhóm 01_HK1_2026-2027
```

---

# 7. Bảng `course_members`

Xác định người dùng tham gia khóa học nào.

Một khóa học có nhiều sinh viên.

Một sinh viên có thể tham gia nhiều khóa học.

Do đó cần bảng trung gian.

| Field        | Type      | Ý nghĩa                  |
| ------------ | --------- | ------------------------ |
| `id`         | UUID      | ID                       |
| `course_id`  | UUID      | Khóa học                 |
| `user_id`    | UUID      | Người dùng               |
| `role`       | TEXT      | `teacher` hoặc `student` |
| `created_at` | TIMESTAMP | Ngày tham gia            |

Quan hệ:

```text
Course
   │
   ├── Teacher
   ├── Student
   ├── Student
   └── Student
```

---

# 8. Bảng `chapters`

Lưu các chương của một học phần.

| Field            | Type    | Ý nghĩa    |
| ---------------- | ------- | ---------- |
| `id`             | UUID    | ID         |
| `subject_id`     | UUID    | Học phần   |
| `name`           | TEXT    | Tên chương |
| `chapter_number` | INTEGER | Số chương  |
| `description`    | TEXT    | Mô tả      |

Ví dụ:

```text
Giải tích 1
├── Chương 1: Hàm số
├── Chương 2: Đạo hàm
├── Chương 3: Tích phân
└── Chương 4: Chuỗi
```

---

# 9. Bảng `topics`

Lưu chủ đề/categorization của câu hỏi.

| Field         | Type | Ý nghĩa    |
| ------------- | ---- | ---------- |
| `id`          | UUID | ID         |
| `chapter_id`  | UUID | Chương     |
| `name`        | TEXT | Tên chủ đề |
| `description` | TEXT | Mô tả      |

Ví dụ:

```text
Chương 2: Đạo hàm
├── Định nghĩa đạo hàm
├── Quy tắc tính đạo hàm
├── Cực trị
└── Khảo sát hàm số
```

---

# 10. Bảng `clos`

Lưu chuẩn đầu ra học phần.

| Field         | Type | Ý nghĩa        |
| ------------- | ---- | -------------- |
| `id`          | UUID | ID             |
| `subject_id`  | UUID | Học phần       |
| `code`        | TEXT | Mã CLO         |
| `name`        | TEXT | Tên/mô tả CLO  |
| `description` | TEXT | Mô tả chi tiết |

Ví dụ:

```text
CLO1
CLO2
CLO3
```

Một CLO thuộc về một học phần.

---

# 11. Bảng `difficulties`

Lưu các mức độ khó.

| Field         | Type | Ý nghĩa   |
| ------------- | ---- | --------- |
| `id`          | UUID | ID        |
| `code`        | TEXT | Mã độ khó |
| `name`        | TEXT | Tên       |
| `description` | TEXT | Mô tả     |

Ví dụ:

```text
D1 — Dễ
D2 — Trung bình
D3 — Khó
```

Có thể thay đổi cách phân loại sau này mà không phải sửa cấu trúc `questions`.

---

# 12. Bảng `questions`

Đây là bảng trung tâm của ngân hàng câu hỏi.

Mỗi câu hỏi hiện tại có:

* Một học phần.
* Một chương.
* Một chủ đề.
* Một CLO.
* Một độ khó.
* Một người tạo.

| Field           | Type      | Ý nghĩa             |
| --------------- | --------- | ------------------- |
| `id`            | UUID      | ID câu hỏi          |
| `subject_id`    | UUID      | Học phần            |
| `chapter_id`    | UUID      | Chương              |
| `topic_id`      | UUID      | Chủ đề              |
| `clo_id`        | UUID      | CLO                 |
| `difficulty_id` | UUID      | Độ khó              |
| `created_by`    | UUID      | Người tạo           |
| `question_type` | TEXT      | Loại câu hỏi        |
| `content`       | TEXT      | Nội dung            |
| `explanation`   | TEXT      | Lời giải/giải thích |
| `status`        | TEXT      | Trạng thái          |
| `created_at`    | TIMESTAMP | Ngày tạo            |
| `updated_at`    | TIMESTAMP | Ngày cập nhật       |

### Nguyên tắc hiện tại

**Mỗi câu hỏi chỉ có:**

```text
1 CLO
1 Difficulty
1 Chapter
1 Topic
```

Đây là thiết kế đã thống nhất cho phiên bản hiện tại.

---

# 13. Bảng `question_options`

Lưu các phương án trả lời của câu hỏi trắc nghiệm.

| Field          | Type    | Ý nghĩa             |
| -------------- | ------- | ------------------- |
| `id`           | UUID    | ID                  |
| `question_id`  | UUID    | Câu hỏi             |
| `option_label` | TEXT    | A/B/C/D             |
| `content`      | TEXT    | Nội dung phương án  |
| `is_correct`   | BOOLEAN | Có phải đáp án đúng |
| `option_order` | INTEGER | Thứ tự              |

Ví dụ:

```text
Question 001

A. 0       false
B. 2       true
C. 3       false
D. 4       false
```

Thiết kế này cho phép sau này hỗ trợ nhiều loại câu hỏi hơn.

---

# 14. Bảng `exams`

Lưu thông tin các đề thi được tạo.

| Field            | Type      | Ý nghĩa   |
| ---------------- | --------- | --------- |
| `id`             | UUID      | ID đề     |
| `course_id`      | UUID      | Khóa học  |
| `created_by`     | UUID      | Người tạo |
| `name`           | TEXT      | Tên đề    |
| `question_count` | INTEGER   | Số câu    |
| `created_at`     | TIMESTAMP | Ngày tạo  |

Ví dụ:

```text
Giữa kỳ Giải tích 1
Course:
Giải tích 1_Nhóm 01_HK1_2026-2027
```

---

# 15. Bảng `exam_questions`

Bảng trung gian giữa đề thi và câu hỏi.

Một đề có nhiều câu hỏi.

Một câu hỏi có thể được sử dụng trong nhiều đề.

| Field            | Type    | Ý nghĩa        |
| ---------------- | ------- | -------------- |
| `id`             | UUID    | ID             |
| `exam_id`        | UUID    | Đề thi         |
| `question_id`    | UUID    | Câu hỏi        |
| `question_order` | INTEGER | Vị trí câu hỏi |
| `points`         | NUMERIC | Điểm           |

Quan hệ:

```text
Exam
 │
 ├── Question 01
 ├── Question 02
 ├── Question 03
 └── ...
```

---

# 16. Quan hệ tổng thể

```text
                         profiles
                            │
             ┌──────────────┼──────────────┐
             │              │              │
          Teacher         Student        Admin
             │              │
             └──────┬───────┘
                    │
             course_members
                    │
                    ▼
                  courses
                    │
                    ▼
                 subjects
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
      chapters     CLOs     Questions
          │                   │
          ▼                   ├── difficulty
       topics                 ├── question_options
                              │
                              ▼
                            exams
                              │
                              ▼
                       exam_questions
```

Một cách nhìn khác:

```text
Subject
│
├── Chapters
│    └── Topics
│
├── CLOs
│
├── Question Bank
│    └── Questions
│         ├── CLO
│         ├── Difficulty
│         ├── Chapter
│         ├── Topic
│         └── Options
│
└── Courses
     ├── Teacher
     └── Students
```

---

# 17. Quy tắc sở hữu dữ liệu

### Teacher

Có thể:

* Tạo câu hỏi.
* Sửa câu hỏi do mình quản lý.
* Xem ngân hàng câu hỏi được cấp quyền.
* Tạo đề.
* Quản lý khóa học được phân công.

### Student

Có thể:

* Xem khóa học mình tham gia.
* Xem nội dung được công khai.
* Làm đề.
* Xem kết quả được cho phép.
* Sử dụng các chức năng AI dành cho sinh viên.

Không được:

* Sửa câu hỏi.
* Xóa câu hỏi.
* Quản lý CLO.
* Quản lý ngân hàng câu hỏi.

### Admin

Có toàn quyền quản lý hệ thống.

---

# 18. Row Level Security

Khi triển khai trên Supabase, database phải sử dụng **Row Level Security (RLS)**.

Không được chỉ dựa vào JavaScript để bảo vệ dữ liệu.

Ví dụ:

```text
Frontend
   ↓
Supabase
   ↓
RLS kiểm tra quyền
   ↓
Cho phép / từ chối
```

Các chính sách RLS sẽ được thiết kế riêng khi bắt đầu triển khai Supabase.

---

# 19. Dữ liệu không được lưu trực tiếp trong code

Không lưu:

```text
password
API key
Supabase service role key
secret key
```

trong các file:

```text
*.html
*.js
```

Thông tin nhạy cảm phải được quản lý bằng cơ chế phù hợp của Supabase hoặc môi trường triển khai.

---

# 20. Nguyên tắc mở rộng

Database v1 được thiết kế để sau này có thể bổ sung:

```text
question_reviews
    ↓
Giảng viên duyệt câu hỏi

ai_logs
    ↓
Lưu lịch sử sử dụng AI

exam_versions
    ↓
Các mã đề A/B/C/D

exam_results
    ↓
Kết quả sinh viên

question_statistics
    ↓
Thống kê câu hỏi

attachments
    ↓
Hình ảnh / tài liệu / media

question_tags
    ↓
Các tag bổ sung
```

Không thêm các bảng này cho đến khi chức năng thực sự cần.

---

# 21. Nguyên tắc quan trọng

Database phải phản ánh nghiệp vụ thực tế:

```text
Học phần ≠ Khóa học
Khóa học ≠ Ngân hàng câu hỏi
Ngân hàng câu hỏi ≠ Đề thi
Người dùng ≠ Thành viên khóa học
```

Ví dụ:

```text
Học phần:
Giải tích 1
       │
       ├── Khóa học 01
       │   └── Nhóm 01 — HK1
       │
       ├── Khóa học 02
       │   └── Nhóm 02 — HK1
       │
       └── Khóa học 03
           └── Nhóm 01 — HK2
```

Trong khi đó:

```text
Ngân hàng câu hỏi Giải tích 1
       │
       ├── Câu hỏi 001
       ├── Câu hỏi 002
       ├── Câu hỏi 003
       └── ...
```

Các câu hỏi có thể được sử dụng để tạo đề cho nhiều `Course` khác nhau.

---

## 22. Trạng thái tài liệu

Đây là **Database Design v1.0**.

Mọi thay đổi lớn về cấu trúc database phải được cập nhật trong tài liệu này trước hoặc đồng thời với việc thay đổi database thực tế.

**Project:** AI-CLO PTIT HCM
**Database:** Supabase PostgreSQL
**Version:** 1.0

