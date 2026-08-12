# Development Guide — AI-CLO PTIT HCM

Tài liệu hướng dẫn các thành viên phát triển dự án **AI-CLO PTIT HCM**.

## 1. Thành viên và nhiệm vụ

| Thành viên | Vai trò | Phụ trách chính |
|---|---|---|
| **Nam** | Project Lead | Kiến trúc, Supabase, Database, Course, Integration, Review |
| **Hòa** | Dev1 | Authentication, User, Permission |
| **Tiến** | Dev2 | Question Bank, AI Question |

---

## 2. Cấu trúc web

```text
ai-clo-ptithcm/
│
├── index.html
├── pages/
│   ├── auth/login.html
│   ├── courses/index.html
│   ├── courses/detail.html
│   ├── questions/index.html
│   ├── questions/detail.html
│   ├── questions/edit.html
│   ├── ai/index.html
│   ├── user/profile.html
│   └── about/index.html
├── css/style.css
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── courses.js
│   ├── questions.js
│   └── supabase.js
├── assets/
└── docs/
    ├── database.md
    ├── contribution.md
    └── development.md
```

---

# 3. Nam — Project Lead

Phụ trách:

```text
js/supabase.js
js/app.js
pages/courses/
docs/
database/migrations/
```

Nhiệm vụ:

- Kiến trúc hệ thống.
- Supabase project.
- Database schema và migration.
- RLS.
- Storage.
- Môn học.
- CLO.
- Chương.
- Chủ đề.
- Tích hợp các module.
- Review Pull Request và merge `main`.

Nam quyết định các thay đổi ảnh hưởng đến database hoặc kiến trúc chung.

---

# 4. Hòa — Dev1

## Phạm vi

```text
Authentication
User
Permission
```

## File chính

```text
pages/auth/
pages/user/
js/auth.js
```

Hòa xây dựng:

- Login.
- Logout.
- Session.
- Lấy user hiện tại.
- Lấy profile.
- Xác định role.
- Redirect theo role.
- User profile.
- Giao diện quyền người dùng.

Flow:

```text
Login
  ↓
Supabase Auth
  ↓
auth.users
  ↓
profiles
  ↓
role
  ↓
Giao diện tương ứng
```

Role:

```text
admin
teacher
student
```

### Bảng Supabase chính

```text
profiles
subject_members
subjects
```

Hòa không tự ý sửa `js/supabase.js`, `js/app.js` nếu chưa trao đổi với Nam.

---

# 5. Tiến — Dev2

## Phạm vi

```text
Question Bank
AI Question
```

## File chính

```text
pages/questions/
pages/ai/
js/questions.js
```

Tiến xây dựng:

- Danh sách câu hỏi.
- Tìm kiếm/lọc.
- Thêm câu hỏi.
- Sửa câu hỏi.
- Xem câu hỏi.
- Inactive câu hỏi.
- Question options.
- LaTeX.
- Upload hình ảnh.
- AI tạo câu hỏi.
- Duyệt câu hỏi AI.

### Bảng Supabase chính

```text
questions
question_options
subjects
chapters
topics
clos
```

Quan hệ:

```text
subjects
   │
   ├── clos
   └── chapters
          └── topics
                 ↓
             questions
                 ↓
        question_options
```

Một câu hỏi:

```text
questions
├── subject_id
├── chapter_id
├── topic_id
├── clo_id
├── content
├── explanation
├── correct_answer
├── created_by
└── status
```

---

# 6. Quy tắc Question Bank

Mỗi câu:

- Thuộc đúng một Môn học.
- Thuộc đúng một Chương.
- Có đúng một Chủ đề.
- Có đúng một CLO.
- Có đúng bốn phương án A/B/C/D.
- Chỉ có một đáp án đúng.
- Có thể có hình ảnh.
- Có thể có LaTeX.
- Có `explanation`.
- Không có Difficulty.

Nếu không cần phân loại Topic cụ thể:

```text
Topic = Khác
```

Không dùng `Topic = NULL`.

Trạng thái:

```text
active
inactive
```

`inactive` không được random vào bài kiểm tra mới nhưng không xóa vật lý.

Các giảng viên trong cùng Môn học có quyền ngang nhau đối với Question Bank.

`created_by` chỉ ghi nhận người tạo ban đầu.

---

# 7. AI Question

Workflow:

```text
Giảng viên
    ↓
Nhập yêu cầu
    ↓
AI tạo câu hỏi
    ↓
Giảng viên kiểm tra
    ↓
Duyệt
    ↓
Question Bank
```

AI không tự đưa câu hỏi vào ngân hàng khi chưa được giảng viên duyệt.

Sau khi duyệt:

```text
status = active
```

---

# 8. Hình ảnh và LaTeX

Giảng viên upload hình trực tiếp.

```text
Giảng viên
    ↓
Supabase Storage
    ↓
image_path
    ↓
Question
```

Không lưu binary ảnh trực tiếp trong PostgreSQL.

Hình có thể nằm trong:

- Nội dung câu hỏi.
- A.
- B.
- C.
- D.

LaTeX được nhập trực tiếp và render khi hiển thị.

---

# 9. Supabase chung

Cả ba người dùng cùng một project:

```text
ai-clo-ptithcm
```

Project URL:

```text
https://rraooqedkpyhokattwdz.supabase.co
```

Frontend được phép dùng:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

Không đưa vào GitHub/frontend:

```text
Database password
service_role key
secret key
```

---

# 10. RLS

Database đã bật Row Level Security.

Nguyên tắc:

```text
Admin
→ toàn hệ thống

Teacher
→ dữ liệu của các Môn học được gán

Student
→ dữ liệu của các Môn học được gán
→ kết quả của chính mình
```

RLS là lớp bảo vệ dữ liệu ở PostgreSQL.

Frontend không được coi việc ẩn/hiện giao diện là cơ chế bảo mật duy nhất.

---

# 11. Database và migration

Database dùng chung.

Hòa và Tiến không tự ý thay đổi schema production.

Nếu cần thay đổi:

```text
Dev
 ↓
Đề xuất
 ↓
Nam review
 ↓
Migration
 ↓
Test
 ↓
Apply
```

Không tự ý chạy các thay đổi nguy hiểm như:

```sql
DROP TABLE ...
ALTER TABLE ...
DROP COLUMN ...
```

trên database chung.

---

# 12. GitHub workflow

## Hòa

```bash
git checkout main
git pull
git checkout -b feature/auth-user
```

## Tiến

```bash
git checkout main
git pull
git checkout -b feature/question-bank
```

Quy trình:

```text
Code
 ↓
Test
 ↓
Commit
 ↓
Push
 ↓
Pull Request
 ↓
Nam review
 ↓
Merge main
```

Không push trực tiếp vào `main`.

---

# 13. File dùng chung

Các file có thể ảnh hưởng nhiều module:

```text
index.html
css/style.css
js/app.js
js/supabase.js
```

Nếu cần thay đổi lớn, trao đổi với Nam trước.

---

# 14. Giai đoạn phát triển đầu tiên

### Nam

```text
Supabase connection
Authentication foundation
Course
CLO
Chapter
Topic
Database integration
```

### Hòa

```text
Login
Logout
Session
Profile
Role
User UI
Permission UI
```

### Tiến

```text
Question list
Question CRUD
Question options
LaTeX
Image upload
Question Bank UI
```

---

# 15. Giai đoạn tiếp theo

### Nam

```text
Exam
Random đề
CLO Assessment
Result
```

### Hòa

```text
Student/Teacher UI
User management
```

### Tiến

```text
AI Question
AI Question Review
Question selection/filtering
```

---

# 16. Nguyên tắc chung

1. Database dùng chung.
2. Schema do Nam quản lý.
3. RLS bảo vệ dữ liệu.
4. Hòa phụ trách Authentication/User.
5. Tiến phụ trách Question Bank/AI Question.
6. Cả hai dùng cùng Supabase.
7. Không commit secret.
8. Không push trực tiếp `main`.
9. Không tự ý sửa schema.
10. Pull Request phải được review trước khi merge.
11. Code đơn giản và module hóa.
12. Không phá vỡ chức năng đang hoạt động.

**Version:** 1.0  
**Project:** AI-CLO PTIT HCM
