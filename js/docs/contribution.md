# Contribution Guide — AI-CLO PTIT HCM

Tài liệu quy định cách các thành viên cùng phát triển dự án **AI-CLO PTIT HCM** trên GitHub.

## 1. Thành viên

| Thành viên | Vai trò              | Phụ trách chính                                              |
| ---------- | -------------------- | ------------------------------------------------------------ |
| **Nam**    | Admin / Project Lead | Quản lý repository, kiến trúc hệ thống, review và merge code |
| **Hoa**    | Dev1                 | Authentication, User và các chức năng liên quan              |
| **Tiến**   | Dev2                 | Question Bank và các chức năng liên quan                     |

Các thành viên có thể hỗ trợ lẫn nhau khi cần, nhưng nên ưu tiên phạm vi phụ trách chính để tránh xung đột code.

---

## 2. Repository

Repository chính:

`ai-clo-ptithcm`

Nhánh `main` là phiên bản ổn định của dự án.

**Không push trực tiếp vào `main`.**

Mọi thay đổi phải được thực hiện trên branch riêng và thông qua Pull Request.

---

## 3. Branch

Tên branch sử dụng dạng:

```text
feature/<ten-chuc-nang>
fix/<ten-loi>
docs/<ten-tai-lieu>
```

Ví dụ:

```text
feature/login
feature/questions
feature/courses
feature/ai-assistant
fix/navbar
docs/database
```

Mỗi thành viên nên tạo branch từ `main` mới nhất trước khi bắt đầu công việc.

---

## 4. Phân công ban đầu

### Nam — Admin / Project Lead

Phụ trách:

```text
docs/
architecture
database design
project structure
code review
merge Pull Request
GitHub repository
```

Các khu vực chính:

```text
pages/courses/
pages/about/
js/app.js
docs/
```

Nam cũng chịu trách nhiệm quyết định các thay đổi ảnh hưởng đến kiến trúc chung của hệ thống.

### Hoa — Dev1

Phụ trách chính:

```text
pages/auth/
pages/user/
js/auth.js
```

Các chức năng:

* Đăng nhập
* Đăng xuất
* Quản lý phiên đăng nhập
* Thông tin tài khoản
* Phân quyền người dùng

### Tiến — Dev2

Phụ trách chính:

```text
pages/questions/
js/questions.js
```

Các chức năng:

* Danh sách câu hỏi
* Xem câu hỏi
* Thêm câu hỏi
* Sửa câu hỏi
* Xóa câu hỏi
* Tìm kiếm câu hỏi
* Lọc câu hỏi
* CLO
* Chương
* Chủ đề
* Độ khó

---

## 5. Quy trình làm việc

Quy trình chung:

```text
main
  ↓
Tạo branch
  ↓
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
Review
  ↓
Merge vào main
```

Không merge code chưa được kiểm tra.

---

## 6. Commit

Commit message nên ngắn gọn và mô tả đúng thay đổi.

Sử dụng các tiền tố:

```text
feat:    thêm chức năng
fix:     sửa lỗi
style:   thay đổi giao diện
refactor: tổ chức lại code
docs:    cập nhật tài liệu
```

Ví dụ:

```text
feat: add login page
feat: add question form
fix: fix question filter
style: update navbar
docs: update database design
```

Không nên sử dụng các commit message quá chung chung như:

```text
update
change
test
new code
```

---

## 7. Pull Request

Khi hoàn thành một chức năng:

1. Push branch lên GitHub.
2. Tạo Pull Request vào `main`.
3. Mô tả những gì đã thay đổi.
4. Ghi rõ nếu có phần nào cần người khác kiểm tra.
5. Chờ review.
6. Sau khi được chấp nhận, merge vào `main`.

Ví dụ tiêu đề:

```text
Add question management
```

hoặc:

```text
Fix login validation
```

---

## 8. Quy tắc tránh xung đột code

Không tự ý sửa hoặc xóa code của module người khác nếu chưa trao đổi.

Đặc biệt hạn chế cùng lúc sửa:

```text
index.html
css/style.css
js/app.js
```

vì đây là các file dùng chung.

Nếu cần thay đổi kiến trúc hoặc API dùng chung, trao đổi với Nam trước khi thực hiện.

---

## 9. Cập nhật branch trước khi làm việc

Trước khi bắt đầu một công việc mới:

```bash
git checkout main
git pull
```

Sau đó tạo branch mới:

```bash
git checkout -b feature/ten-chuc-nang
```

Không nên tiếp tục phát triển một branch đã quá cũ so với `main`.

---

## 10. Kiểm tra trước khi tạo Pull Request

Mỗi thành viên cần kiểm tra:

* Website có chạy không?
* Các chức năng mới có hoạt động không?
* Có lỗi JavaScript trong Console không?
* Có làm hỏng chức năng cũ không?
* Đường dẫn CSS/JS có đúng không?
* Có file hoặc code thừa không?
* Có commit nhầm thông tin bí mật không?

**Không đưa API key, password hoặc thông tin nhạy cảm vào GitHub.**

---

## 11. Nguyên tắc chung

Dự án ưu tiên:

1. Code đơn giản.
2. Cấu trúc rõ ràng.
3. Module hóa.
4. Dễ bảo trì.
5. Dễ mở rộng.
6. Không phá vỡ chức năng đang hoạt động.
7. Mọi thay đổi quan trọng đều được review.

Mục tiêu là xây dựng AI-CLO thành một hệ thống có thể tiếp tục phát triển lâu dài, không chỉ là một prototype.

---

## 12. Cấu trúc module hiện tại

```text
ai-clo-ptithcm/
│
├── index.html
│
├── pages/
│   ├── auth/
│   │   └── login.html
│   ├── courses/
│   │   ├── index.html
│   │   └── detail.html
│   ├── questions/
│   │   ├── index.html
│   │   ├── detail.html
│   │   └── edit.html
│   ├── ai/
│   │   └── index.html
│   ├── user/
│   │   └── profile.html
│   └── about/
│       └── index.html
│
├── css/
│   └── style.css
│
├── js/
│   ├── app.js
│   ├── auth.js
│   ├── courses.js
│   ├── questions.js
│   └── supabase.js
│
├── assets/
│   ├── images/
│   └── icons/
│
└── docs/
    ├── database.md
    └── contribution.md
```

**Version:** 1.0
**Project:** AI-CLO PTIT HCM
