# Database Design --- AI-CLO PTIT HCM

Tài liệu mô tả cấu trúc database chính thức của hệ thống **AI-CLO PTIT
HCM**.

## 1. Nguyên tắc tổng thể

Hệ thống sử dụng **Supabase PostgreSQL** làm database chung.

Đơn vị học thuật chính là **Môn học**.

Mỗi Môn học được xác định bởi:

-   Tên môn học.
-   Học kỳ.
-   Năm học.

Ví dụ:

``` text
Giải tích 1 — HK1 — 2026-2027
```

Một Môn học có:

-   Nhiều giảng viên.
-   Nhiều sinh viên.
-   Một bộ CLO.
-   Nhiều Chương.
-   Nhiều Chủ đề.
-   Một Ngân hàng câu hỏi chung.
-   Nhiều bài kiểm tra chương.
-   Một hoạt động Đánh giá CLO.

Một sinh viên có thể thuộc nhiều Môn học.

Một giảng viên có thể được phân công nhiều Môn học.

------------------------------------------------------------------------

# 2. User và phân quyền

## 2.1. Admin

Admin là người quản lý tài khoản và cấu trúc học thuật chính thức.

Admin có quyền:

-   Tạo tài khoản giảng viên.
-   Tạo tài khoản sinh viên.
-   Quản lý người dùng.
-   Tạo Môn học.
-   Gán giảng viên vào Môn học.
-   Thêm/import sinh viên vào Môn học.
-   Tạo, sửa, xóa CLO.
-   Quản lý các cấu hình hệ thống.

Sinh viên và giảng viên không tự đăng ký tài khoản trong V1.

## 2.2. Giảng viên

Một Môn học có thể có nhiều giảng viên.

Các giảng viên trong cùng một Môn học có **quyền ngang nhau**.

Giảng viên có thể:

-   Xem và sử dụng CLO.
-   Thêm/sửa/xóa Chương.
-   Thêm/sửa/xóa Chủ đề.
-   Quản lý Ngân hàng câu hỏi.
-   Tạo câu hỏi thủ công.
-   Sử dụng AI để tạo câu hỏi.
-   Duyệt câu hỏi AI tạo.
-   Tạo bài kiểm tra chương.
-   Quản lý Đánh giá CLO.
-   Xem kết quả của tất cả sinh viên trong Môn học.
-   Phân tích kết quả CLO.

## 2.3. Sinh viên

Sinh viên có thể thuộc nhiều Môn học.

Sinh viên có thể:

-   Xem các Môn học được gán.
-   Làm bài kiểm tra chương.
-   Làm Đánh giá CLO nhiều lần.
-   Xem kết quả của bản thân.

------------------------------------------------------------------------

# 3. Các bảng chính

Cấu trúc database V1:

``` text
profiles
subjects
subject_members
clos
chapters
topics
questions
question_options
exams
exam_questions
exam_attempts
student_answers
```

------------------------------------------------------------------------

# 4. profiles

Lưu thông tin tài khoản người dùng.

``` text
profiles
├── id
├── mssv
├── full_name
├── email
├── role
└── created_at
```

## Các trường

### id

-   UUID.
-   Khóa chính.
-   Liên kết với Supabase Auth user.

### mssv

-   MSSV.
-   Dùng cho sinh viên.
-   Là mã sinh viên chính và duy nhất.
-   Với giảng viên/admin có thể NULL nếu không sử dụng MSSV.

### full_name

Họ và tên.

### email

Email tài khoản.

### role

Các giá trị:

``` text
admin
teacher
student
```

### created_at

Thời điểm tạo tài khoản.

------------------------------------------------------------------------

# 5. subjects

Lưu thông tin Môn học.

``` text
subjects
├── id
├── name
├── semester
├── academic_year
└── created_at
```

Ví dụ:

``` text
Giải tích 1
HK1
2026-2027
```

## Quan hệ

``` text
subjects
   │
   ├── subject_members
   ├── clos
   ├── chapters
   ├── questions
   └── exams
```

------------------------------------------------------------------------

# 6. subject_members

Quản lý người dùng thuộc Môn học.

``` text
subject_members
├── id
├── subject_id
├── user_id
├── role
└── created_at
```

## role

``` text
teacher
student
```

Admin không cần nằm trong `subject_members` vì Admin quản lý toàn hệ
thống.

## Quan hệ

Một user có thể thuộc nhiều Môn học:

``` text
Student A
├── Giải tích 1
├── Đại số tuyến tính
└── Xác suất thống kê
```

Một Môn học có nhiều giảng viên và sinh viên.

Các giảng viên trong cùng Môn học có quyền ngang nhau.

------------------------------------------------------------------------

# 7. clos

CLO thuộc trực tiếp về Môn học.

``` text
clos
├── id
├── subject_id
├── code
├── description
└── created_at
```

Ví dụ:

``` text
CLO1
CLO2
CLO3
```

## Quyền

Chỉ **Admin** được:

-   Tạo CLO.
-   Sửa CLO.
-   Xóa CLO.

Giảng viên chỉ sử dụng CLO đã được Admin thiết lập.

Mỗi câu hỏi phải gắn **đúng một CLO**.

------------------------------------------------------------------------

# 8. chapters

Lưu Chương của Môn học.

``` text
chapters
├── id
├── subject_id
├── name
├── order_index
└── created_at
```

## Quyền

Admin và giảng viên của Môn học đều có thể:

-   Thêm.
-   Sửa.
-   Xóa.

Chương là trường bắt buộc của câu hỏi.

------------------------------------------------------------------------

# 9. topics

Lưu Chủ đề trong từng Chương.

``` text
topics
├── id
├── chapter_id
├── name
├── order_index
└── created_at
```

Mỗi Chương nên có chủ đề:

``` text
Khác
```

`Khác` dùng cho các câu hỏi không cần hoặc chưa cần phân loại vào một
chủ đề cụ thể.

## Quyền

Admin và giảng viên của Môn học đều có thể:

-   Thêm.
-   Sửa.
-   Xóa.

Mỗi câu hỏi phải có một Chủ đề.

------------------------------------------------------------------------

# 10. questions

Lưu thông tin chính của câu hỏi.

``` text
questions
├── id
├── subject_id
├── chapter_id
├── topic_id
├── clo_id
├── content
├── explanation
├── created_by
├── status
├── created_at
└── updated_at
```

## Các thuộc tính quan trọng

### subject_id

Môn học mà câu hỏi thuộc về.

### chapter_id

Chương của câu hỏi.

**Bắt buộc.**

### topic_id

Chủ đề của câu hỏi.

**Bắt buộc.**

Không dùng `NULL` để biểu diễn câu hỏi chưa phân loại. Nếu không cần
phân loại cụ thể thì dùng Chủ đề:

``` text
Khác
```

### clo_id

CLO của câu hỏi.

**Bắt buộc và chỉ có đúng một CLO.**

### content

Nội dung câu hỏi.

Hỗ trợ:

-   Văn bản.
-   LaTeX.
-   Hình ảnh.

### explanation

Lời giải/giải thích đáp án.

Có thể được AI tạo và được giảng viên kiểm tra/chỉnh sửa.

### created_by

UUID người tạo câu hỏi.

Dùng để ghi nhận tác giả ban đầu.

`created_by` **không dùng để giới hạn quyền**.

Sau khi câu hỏi thuộc ngân hàng của Môn học, các giảng viên trong Môn
học có quyền ngang nhau đối với câu hỏi.

### status

Các trạng thái tối thiểu:

``` text
active
inactive
```

`active`:

-   Có thể sử dụng trong bài kiểm tra.
-   Có thể được AI chọn.
-   Hiển thị trong ngân hàng đang hoạt động.

`inactive`:

-   Không được chọn vào bài kiểm tra mới.
-   Không được AI chọn.
-   Không xóa vật lý khỏi database.
-   Giữ lại để bảo toàn lịch sử các bài đã sử dụng câu hỏi.

------------------------------------------------------------------------

# 11. question_options

Lưu bốn phương án của câu hỏi.

``` text
question_options
├── id
├── question_id
├── option_key
├── content
└── image_path
```

## option_key

Chỉ có:

``` text
A
B
C
D
```

Mỗi câu phải có đúng 4 phương án.

Mỗi câu chỉ có **một đáp án đúng**.

Có thể lưu đáp án đúng ở `questions.correct_answer` hoặc thiết kế
constraint tương đương. Nếu dùng trường này thì:

``` text
correct_answer ∈ {A, B, C, D}
```

## content

Nội dung phương án.

Hỗ trợ:

-   Văn bản.
-   LaTeX.

## image_path

Đường dẫn hình ảnh của phương án nếu có.

------------------------------------------------------------------------

# 12. Hình ảnh câu hỏi

Hệ thống hỗ trợ hình ảnh trong:

-   Nội dung câu hỏi.
-   Phương án A.
-   Phương án B.
-   Phương án C.
-   Phương án D.

Không lưu binary ảnh trực tiếp trong PostgreSQL.

Sử dụng:

``` text
Supabase Storage
```

Ví dụ:

``` text
questions/
├── q001/
│   ├── question-1.png
│   └── diagram.png
└── q002/
    └── graph.png
```

Database chỉ lưu path/reference tới file.

Giảng viên upload ảnh trực tiếp từ giao diện.

------------------------------------------------------------------------

# 13. AI tạo câu hỏi

AI hỗ trợ giảng viên tạo câu hỏi.

Thông tin đầu vào có thể gồm:

``` text
Môn học
Chương
Chủ đề
CLO
Số lượng câu
Yêu cầu bổ sung
```

Không còn trường Độ khó trong V1.

Workflow:

``` text
Giảng viên
    ↓
Nhập yêu cầu
    ↓
AI tạo câu hỏi
    ↓
Giảng viên xem toàn bộ
    ↓
Duyệt tất cả / Tạo lại
    ↓
Ngân hàng câu hỏi
```

Câu hỏi được duyệt trở thành tài sản chung của Môn học.

------------------------------------------------------------------------

# 14. exams

Lưu các bài kiểm tra.

``` text
exams
├── id
├── subject_id
├── title
├── description
├── exam_type
├── total_questions
├── duration_minutes
├── is_clo_assessment
├── created_by
├── status
├── created_at
└── updated_at
```

## exam_type

Hệ thống không áp đặt cứng các loại như:

-   Giữa kỳ.
-   Cuối kỳ.

Giảng viên có thể đặt loại/tên bài theo nhu cầu.

Trong mô hình hiện tại chỉ có hai nhóm nghiệp vụ chính:

``` text
Bài kiểm tra chương
Đánh giá CLO
```

## is_clo_assessment

Đánh dấu bài Đánh giá CLO:

``` text
true  → Đánh giá CLO
false → Bài kiểm tra chương
```

Mỗi Môn học chỉ có **một** bài có:

``` text
is_clo_assessment = true
```

------------------------------------------------------------------------

# 15. exam_questions

Lưu các câu hỏi được đưa vào một bài kiểm tra.

``` text
exam_questions
├── id
├── exam_id
├── question_id
└── question_order
```

Một bài kiểm tra có nhiều câu.

Một câu hỏi có thể được sử dụng trong nhiều bài kiểm tra.

------------------------------------------------------------------------

# 16. Random đề có ràng buộc

Đặc biệt đối với **Đánh giá CLO**, hệ thống không random hoàn toàn ngẫu
nhiên.

AI/hệ thống phải đảm bảo các yêu cầu do giảng viên cấu hình:

``` text
Tổng số câu
CLO
Chương
```

Không còn ràng buộc theo Độ khó.

Quy trình:

``` text
Ngân hàng câu hỏi active
        ↓
Kiểm tra số lượng câu phù hợp
        ↓
Random có ràng buộc
        ↓
Đề hợp lệ
```

Nếu không đủ câu:

``` text
Không tạo đề
      ↓
Thông báo điều kiện còn thiếu
```

Không tạo đề không đáp ứng yêu cầu.

Thuật toán random thuộc logic hệ thống, không cần gọi AI ở mỗi lần sinh
đề.

------------------------------------------------------------------------

# 17. CLO Assessment

Mỗi Môn học có một Đánh giá CLO.

Giảng viên cấu hình:

-   Tổng số câu.
-   Trọng số từng CLO.
-   Số câu theo từng Chương.

Sinh viên được phép làm nhiều lần.

Mỗi lần làm, hệ thống tạo một bộ câu khác từ ngân hàng `active`.

Điểm CLO được tổng hợp từ các lần làm theo quy định của hệ thống.

------------------------------------------------------------------------

# 18. CLO Weight

Có thể cần bảng cấu hình trọng số CLO cho bài Đánh giá CLO:

``` text
exam_clos
├── id
├── exam_id
├── clo_id
├── weight
└── created_at
```

Ví dụ:

``` text
CLO1 → 30%
CLO2 → 40%
CLO3 → 30%
```

Tổng trọng số của các CLO phải bằng:

``` text
100%
```

------------------------------------------------------------------------

# 19. Số câu theo Chương

Để Đánh giá CLO có thể yêu cầu số câu theo từng Chương, có thể sử dụng:

``` text
exam_chapters
├── id
├── exam_id
├── chapter_id
├── question_count
└── created_at
```

Ví dụ:

``` text
Chương 1 → 10 câu
Chương 2 → 12 câu
Chương 3 → 8 câu
```

Hệ thống kiểm tra ngân hàng trước khi random.

------------------------------------------------------------------------

# 20. exam_attempts

Lưu mỗi lần sinh viên làm một bài.

``` text
exam_attempts
├── id
├── exam_id
├── student_id
├── attempt_number
├── started_at
├── submitted_at
└── score
```

Một sinh viên có thể có nhiều attempt đối với Đánh giá CLO.

Ví dụ:

``` text
Student A
├── Attempt 1 → 7.0
├── Attempt 2 → 8.0
└── Attempt 3 → 7.5
```

------------------------------------------------------------------------

# 21. student_answers

Lưu câu trả lời của sinh viên.

``` text
student_answers
├── id
├── attempt_id
├── question_id
├── selected_option
├── is_correct
└── created_at
```

`selected_option`:

``` text
A
B
C
D
```

`is_correct` được hệ thống xác định dựa trên đáp án đúng của câu hỏi tại
thời điểm chấm.

------------------------------------------------------------------------

# 22. CLO Result

Hệ thống cần tính được:

``` text
Sinh viên
   ↓
Bài đánh giá CLO
   ↓
Câu hỏi
   ↓
CLO của câu hỏi
   ↓
Điểm từng CLO
   ↓
Trọng số CLO
   ↓
Kết quả CLO
```

Quy tắc đạt:

``` text
CLO >= 4.0 → Đạt
CLO < 4.0  → Không đạt
```

Các mức phân loại:

``` text
Xuất sắc
Giỏi
Khá
Trung bình
Yếu
Kém
```

Ngưỡng của từng mức do giảng viên quy định cho Môn học.

------------------------------------------------------------------------

# 23. Không có bảng Difficulty

V1 **bỏ hoàn toàn Độ khó**.

Không tạo:

``` text
difficulties
```

và không có:

``` text
difficulty_id
```

trong `questions`.

Việc random Đánh giá CLO chỉ dựa trên:

``` text
Tổng số câu
CLO
Chương
```

------------------------------------------------------------------------

# 24. Quyền truy cập tổng quát

## Admin

Có quyền quản lý toàn hệ thống.

## Giảng viên

Chỉ có quyền trong các Môn học được Admin gán.

Trong cùng một Môn học, các giảng viên có quyền ngang nhau.

## Sinh viên

Chỉ có quyền trên các Môn học được Admin gán.

Sinh viên không thể:

-   Sửa câu hỏi.
-   Sửa CLO.
-   Sửa Chương.
-   Sửa Chủ đề.
-   Xem kết quả sinh viên khác.

------------------------------------------------------------------------

# 25. Quan hệ tổng thể

``` text
profiles
   │
   ├──────────────┐
   │              │
   ↓              ↓
subject_members   subjects
                     │
       ┌─────────────┼─────────────┐
       ↓             ↓             ↓
      CLO         chapters       exams
                    │               │
                    ↓               ↓
                  topics      exam_questions
                    │               │
                    └──────┐        │
                           ↓        ↓
                        questions
                           │
                           ↓
                    question_options

exams
  ↓
exam_attempts
  ↓
student_answers
```

------------------------------------------------------------------------

# 26. Nguyên tắc cập nhật database

Database là tài sản dùng chung của dự án.

**Nam chịu trách nhiệm chính về schema và migration.**

Dev1 và Dev2:

-   Có thể đọc dữ liệu.
-   Có thể phát triển chức năng theo schema.
-   Có thể đề xuất thay đổi schema.
-   Không tự ý thay đổi schema production.

Mọi thay đổi schema quan trọng phải:

1.  Trao đổi.
2.  Cập nhật tài liệu.
3.  Tạo migration.
4.  Test.
5.  Review.
6.  Áp dụng vào database.

------------------------------------------------------------------------

**Version:** 2.0\
**Project:** AI-CLO PTIT HCM
