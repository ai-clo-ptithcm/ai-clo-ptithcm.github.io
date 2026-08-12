# Contribution Guide — AI-CLO PTIT HCM

Tài liệu quy định cách các thành viên cùng phát triển dự án **AI-CLO PTIT HCM** trên GitHub.

---

## 1. Thành viên

| Thành viên | Vai trò | Phụ trách chính |
|---|---|---|
| **Nam** | Lead / Admin | Kiến trúc, Database, Supabase, AI, Exam, Results, CLO Analytics, Integration |
| **Hòa** | Dev1 | Authentication, User, Subject |
| **Tiến** | Dev2 | Question Bank, AI Question, Exam Taking UI |

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
