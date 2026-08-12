# Contribution Guide — AI-CLO PTIT HCM

Tài liệu quy định cách các thành viên cùng phát triển dự án **AI-CLO PTIT HCM** trên GitHub.

---

## 1. Thành viên

| Thành viên | Vai trò | Phụ trách chính |
|---|---|---|
| **Nam** | Project Lead | Kiến trúc, Supabase, Database, Course, Integration, Review/Merge |
| **Hòa** | Dev1 | Authentication, User, Permission |
| **Tiến** | Dev2 | Question Bank, AI Question |

Các thành viên có thể hỗ trợ nhau khi cần, nhưng ưu tiên phạm vi phụ trách chính để tránh xung đột code.

---

## 2. Repository

Repository chính:

```text
ai-clo-ptithcm
```

Nhánh:

```text
main
```

là phiên bản ổn định.

**Không push trực tiếp vào `main`.**

Mọi thay đổi phải thực hiện trên branch riêng và thông qua Pull Request.

---

## 3. Tài liệu bắt buộc

Trước khi bắt đầu code, mỗi thành viên cần đọc:

```text
docs/
├── contribution.md
├── development.md
└── database.md
```

### `contribution.md`

Quy định GitHub và quy trình làm việc.

### `development.md`

Phân công Dev1/Dev2, file phụ trách và phạm vi chức năng.

### `database.md`

Cấu trúc Supabase PostgreSQL và các quy tắc dữ liệu.

---

## 4. Branch

Tên branch:

```text
feature/<ten-chuc-nang>
fix/<ten-loi>
docs/<ten-tai-lieu>
refactor/<ten-chuc-nang>
```

Ví dụ:

```text
feature/auth-user
feature/question-bank
feature/latex
feature/image-upload
feature/ai-question
fix/login
docs/database
```

Mỗi thành viên tạo branch từ `main` mới nhất.

---

## 5. Phân công code

### Nam — Project Lead

Phụ trách chính:

```text
js/supabase.js
js/app.js
pages/courses/
docs/
database/migrations/
```

Nam chịu trách nhiệm:

- Kiến trúc hệ thống.
- Supabase.
- Database schema.
- Migration.
- RLS.
- Storage.
- Môn học.
- CLO.
- Chương.
- Chủ đề.
- Tích hợp các module.
- Review và merge Pull Request.

### Hòa — Dev1

Phụ trách:

```text
pages/auth/
pages/user/
js/auth.js
```

Chức năng:

- Login.
- Logout.
- Session.
- Current user.
- Profile.
- Role.
- Permission UI.
- User-related functions.

Bảng Supabase chính:

```text
profiles
subject_members
subjects
```

### Tiến — Dev2

Phụ trách:

```text
pages/questions/
pages/ai/
js/questions.js
```

Chức năng:

- Question Bank.
- Question CRUD.
- Question options.
- Search/filter.
- LaTeX.
- Image upload.
- AI tạo câu hỏi.
- Duyệt câu hỏi AI.

Bảng Supabase chính:

```text
questions
question_options
subjects
chapters
topics
clos
```

---

## 6. Quy tắc phối hợp database

Cả nhóm sử dụng **một Supabase project chung**:

```text
ai-clo-ptithcm
```

Không tạo database riêng cho từng Dev.

### Nam

Nam quản lý:

```text
schema
migration
RLS
Storage
database integrity
```

### Hòa/Tiến

Hòa và Tiến có thể:

- Đọc cấu trúc database.
- Sử dụng các bảng thuộc module của mình.
- Test dữ liệu.
- Đề xuất thay đổi database.

Không tự ý thay đổi schema hoặc RLS trên database chung.

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

---

## 7. Supabase credentials

Frontend có thể sử dụng:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

Không được commit lên GitHub:

```text
Database password
service_role key
secret key
```

Không gửi mật khẩu tài khoản cá nhân cho thành viên khác.

Không đưa secret vào:

```text
HTML
JavaScript
CSS
GitHub repository
```

---

## 8. Quy tắc commit

Commit message sử dụng các tiền tố:

```text
feat:      thêm chức năng
fix:       sửa lỗi
style:     thay đổi giao diện
refactor:  tổ chức lại code
docs:      cập nhật tài liệu
test:      thêm/sửa test
```

Ví dụ:

```text
feat: add login page
feat: add question form
feat: add LaTeX rendering
feat: add question image upload
fix: fix login validation
docs: update development guide
```

Không sử dụng commit message quá chung chung:

```text
update
change
test
new code
```

---

## 9. Quy trình làm việc

### Bước 1 — Cập nhật `main`

```bash
git checkout main
git pull
```

### Bước 2 — Tạo branch

Ví dụ Hòa:

```bash
git checkout -b feature/auth-user
```

Tiến:

```bash
git checkout -b feature/question-bank
```

### Bước 3 — Code

Chỉ tập trung vào chức năng của branch.

### Bước 4 — Test

Kiểm tra chức năng mới và các chức năng liên quan.

### Bước 5 — Commit

```bash
git add .
git commit -m "feat: ..."
```

### Bước 6 — Push

```bash
git push -u origin feature/auth-user
```

hoặc:

```bash
git push -u origin feature/question-bank
```

### Bước 7 — Pull Request

Tạo Pull Request:

```text
branch → main
```

### Bước 8 — Review

Nam review.

Nếu có yêu cầu sửa:

```text
Dev sửa
 ↓
commit
 ↓
push
 ↓
Pull Request tự cập nhật
```

### Bước 9 — Merge

Chỉ merge sau khi đã kiểm tra và chấp nhận Pull Request.

---

## 10. Pull Request

Mỗi Pull Request nên ghi:

### What

Đã thay đổi gì?

### Why

Tại sao cần thay đổi?

### Test

Đã kiểm tra những gì?

### Notes

Có vấn đề hoặc phần nào cần Nam kiểm tra đặc biệt không?

Ví dụ:

```text
Title:
Add question management

What:
- Add question list
- Add question form
- Add A/B/C/D options

Why:
Implement Question Bank V1

Test:
- Create question
- Edit question
- Filter by CLO
- Test LaTeX
```

---

## 11. Quy tắc tránh conflict

Không tự ý sửa/xóa code của module người khác.

Đặc biệt chú ý các file dùng chung:

```text
index.html
css/style.css
js/app.js
js/supabase.js
```

Nếu cần thay đổi lớn các file này, trao đổi với Nam trước.

Hạn chế để nhiều Dev cùng lúc chỉnh sửa một file dùng chung.

---

## 12. Quy tắc Question Bank

Các thành viên phải tuân thủ database đã chốt.

Mỗi câu hỏi:

```text
1 Subject
1 Chapter
1 Topic
1 CLO
4 options: A/B/C/D
1 correct answer
```

Có:

```text
content
explanation
```

Hỗ trợ:

```text
LaTeX
Image
```

Không có:

```text
Difficulty
```

Nếu không cần phân loại Topic cụ thể:

```text
Topic = Khác
```

Không dùng:

```text
Topic = NULL
```

---

## 13. Quyền trong Question Bank

Câu hỏi thuộc **Ngân hàng câu hỏi chung của Môn học**.

Các giảng viên trong cùng Môn học có quyền ngang nhau.

Ví dụ:

```text
Giải tích 1
├── Hòa
└── Tiến
```

Hòa tạo câu hỏi → Tiến có thể xem/sửa.

Tiến tạo câu hỏi → Hòa có thể xem/sửa.

`created_by` chỉ ghi nhận người tạo ban đầu.

---

## 14. AI Question

AI chỉ hỗ trợ tạo câu hỏi.

Workflow:

```text
Giảng viên
 ↓
AI tạo câu hỏi
 ↓
Giảng viên kiểm tra
 ↓
Duyệt
 ↓
Question Bank
```

Không tự động đưa câu hỏi AI vào ngân hàng nếu chưa được giảng viên duyệt.

---

## 15. Kiểm tra trước Pull Request

Mỗi Dev phải kiểm tra:

- Chức năng mới hoạt động.
- Không có lỗi JavaScript trong Console.
- Không làm hỏng chức năng cũ.
- Đường dẫn CSS/JS đúng.
- Không có file/code thừa.
- Không commit password hoặc secret.
- Không tự ý thay đổi schema.
- Test với dữ liệu phù hợp.

---

## 16. Nguyên tắc chung

Dự án ưu tiên:

1. Code đơn giản.
2. Module hóa.
3. Cấu trúc rõ ràng.
4. Dễ bảo trì.
5. Dễ mở rộng.
6. Không phá vỡ chức năng đang hoạt động.
7. Database dùng chung.
8. Schema thay đổi phải được review.
9. Mọi thay đổi quan trọng phải qua Pull Request.
10. Không đưa thông tin bí mật lên GitHub.

Mục tiêu là xây dựng AI-CLO thành một hệ thống có thể tiếp tục phát triển lâu dài, không chỉ là prototype.

---

**Version:** 2.0  
**Project:** AI-CLO PTIT HCM
