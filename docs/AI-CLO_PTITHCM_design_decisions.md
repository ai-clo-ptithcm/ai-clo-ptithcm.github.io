# AI-CLO PTIT HCM --- Thiết kế nghiệp vụ đã chốt

## 1. Mục tiêu hệ thống

AI-CLO PTIT HCM là hệ thống hỗ trợ dạy học và đánh giá theo CLO.

AI hỗ trợ: - Tạo ngân hàng câu hỏi. - Hỗ trợ tạo các bài kiểm tra. -
Phân tích kết quả học tập theo CLO.

AI chỉ là công cụ hỗ trợ. Nội dung học thuật và các quyết định chính
thức thuộc về Admin/Giảng viên theo phân quyền.

------------------------------------------------------------------------

## 2. Đơn vị trung tâm: Môn học

Mỗi môn học được xác định bởi:

-   Môn học.
-   Học kỳ.
-   Năm học.

Ví dụ:

`Giải tích 1 — HK1 — 2026-2027`

Cấu trúc:

``` text
Môn học
├── CLO
├── Chương
├── Chủ đề
├── Ngân hàng câu hỏi
├── Các bài kiểm tra chương
└── Đánh giá CLO
```

------------------------------------------------------------------------

## 3. Người dùng và phân quyền

### Admin

Admin quản lý cấu trúc học thuật chính thức:

-   Người dùng.
-   Môn học.
-   CLO.
-   Chương.
-   Chủ đề.
-   Danh sách sinh viên của từng môn học.
-   Phân quyền.

Admin import/thêm sinh viên vào từng môn học.

### Giảng viên

Một môn học có thể có nhiều giảng viên và các giảng viên có quyền ngang
nhau trong môn học đó.

Giảng viên có thể:

-   Sử dụng AI tạo câu hỏi.
-   Quản lý ngân hàng câu hỏi.
-   Kiểm tra và duyệt câu hỏi AI tạo.
-   Tạo các bài kiểm tra chương.
-   Tạo và cấu hình Đánh giá CLO.
-   Xem kết quả sinh viên.
-   Phân tích CLO.
-   Quy định trọng số CLO.
-   Quy định các mức phân loại CLO.

Giảng viên không phải tự nhập lại CLO, Chương và Chủ đề do Admin đã
thiết lập.

### Sinh viên

Sinh viên có thể:

-   Xem môn học được Admin gán.
-   Làm các bài kiểm tra chương.
-   Làm Đánh giá CLO.
-   Làm Đánh giá CLO nhiều lần.
-   Xem kết quả của bản thân.

Sinh viên không được: - Sửa CLO. - Sửa Chương/Chủ đề. - Sửa ngân hàng
câu hỏi. - Duyệt câu hỏi. - Xem kết quả của sinh viên khác.

------------------------------------------------------------------------

## 4. Ngân hàng câu hỏi

Phiên bản đầu chỉ hỗ trợ câu hỏi trắc nghiệm 4 lựa chọn:

`A / B / C / D`

Mỗi câu hỏi cần gắn các thông tin:

-   Môn học.
-   Chương.
-   Chủ đề.
-   CLO.
-   Độ khó.
-   Nội dung câu hỏi.
-   4 phương án A/B/C/D.
-   Đáp án đúng.
-   Trạng thái câu hỏi.

### AI tạo câu hỏi

Giảng viên cung cấp:

-   Môn học.
-   Chương.
-   Chủ đề.
-   CLO.
-   Độ khó.
-   Số lượng câu.
-   Yêu cầu bổ sung (không bắt buộc).

AI tạo một loạt câu hỏi.

Quy trình V1:

``` text
Giảng viên nhập yêu cầu
        ↓
AI tạo một loạt câu
        ↓
Giảng viên xem toàn bộ
        ↓
Duyệt tất cả / Tạo lại
```

Không yêu cầu duyệt từng câu ở phiên bản đầu.

------------------------------------------------------------------------

## 5. Bài kiểm tra chương

Giảng viên có thể tạo nhiều bài kiểm tra cho mỗi chương.

Không giới hạn số lượng bài.

Ví dụ:

``` text
Chương 1
├── Bài kiểm tra 1
├── Bài kiểm tra 2
└── Bài kiểm tra 3
```

Giảng viên tự quyết định:

-   Tên bài.
-   Số lượng câu.
-   Nội dung/phạm vi.
-   Chương.
-   Chủ đề.
-   CLO.
-   Độ khó.
-   Thời gian.
-   Các thiết lập khác.

Hệ thống không áp đặt cứng loại bài như "ôn tập", "giữa kỳ", "cuối kỳ".
Giảng viên có thể tự đặt tên/phân loại bài.

**Không có bài kiểm tra giữa kỳ bắt buộc trong mô hình hiện tại.**

------------------------------------------------------------------------

## 6. Đánh giá CLO

Mỗi môn học có **một hoạt động Đánh giá CLO chính thức**.

Đánh giá CLO sử dụng câu hỏi từ ngân hàng câu hỏi.

Giảng viên quy định:

-   Tổng số câu.
-   Trọng số từng CLO.
-   Số câu theo từng chương.
-   Phân bố độ khó.
-   Các yêu cầu khác cần thiết.

Ví dụ:

``` text
Tổng số câu: 30

CLO1: 30%
CLO2: 40%
CLO3: 30%

Chương 1: 10 câu
Chương 2: 12 câu
Chương 3: 8 câu

Độ khó:
Dễ: 20%
Trung bình: 50%
Khó: 30%
```

------------------------------------------------------------------------

## 7. Random đề có ràng buộc

Đề Đánh giá CLO được tạo tự động từ ngân hàng câu hỏi.

Không random hoàn toàn ngẫu nhiên.

Hệ thống phải đảm bảo các ràng buộc:

-   Tổng số câu.
-   Số câu/trọng số theo CLO.
-   Số câu theo chương.
-   Phân bố độ khó.

Quy trình:

``` text
Ngân hàng câu hỏi đã duyệt
        ↓
Kiểm tra khả năng đáp ứng yêu cầu
        ↓
Random có ràng buộc
        ↓
Đề hợp lệ
```

Nếu ngân hàng không đủ câu phù hợp:

``` text
Không đủ câu
      ↓
Không tạo đề sai yêu cầu
      ↓
Thông báo rõ điều kiện còn thiếu
```

Ví dụ:

> CLO2 -- Chương 3 -- Độ khó Khó cần 6 câu nhưng ngân hàng hiện chỉ có 3
> câu phù hợp.

### Vai trò của AI và thuật toán

AI không bắt buộc phải được gọi ở mỗi lần random đề.

-   **Thuật toán hệ thống:** chọn câu ngẫu nhiên có ràng buộc và kiểm
    tra tính hợp lệ.
-   **AI:** tạo nội dung câu hỏi và hỗ trợ các tác vụ thông minh khác.

Điều này giúp việc tạo đề nhanh, ổn định và kiểm soát được.

------------------------------------------------------------------------

## 8. Sinh viên làm Đánh giá CLO nhiều lần

Sinh viên được phép làm Đánh giá CLO nhiều lần.

Mỗi lần làm, hệ thống có thể tạo một đề khác từ ngân hàng câu hỏi nhưng
vẫn phải đảm bảo các ràng buộc đã cấu hình.

Ví dụ:

``` text
Lần 1 → 7.0
Lần 2 → 8.0
Lần 3 → 6.5
Lần 4 → 7.5
```

Điểm đánh giá CLO được tổng hợp theo quy định của hệ thống/môn học đã
cấu hình.

------------------------------------------------------------------------

## 9. Tính và phân loại CLO

Điểm CLO được tính trên thang điểm 10.

Quy tắc đạt:

-   `CLO >= 4.0` → **Đạt**
-   `CLO < 4.0` → **Không đạt**

Các mức phân loại:

-   Xuất sắc.
-   Giỏi.
-   Khá.
-   Trung bình.
-   Yếu.
-   Kém.

**Ngưỡng của từng mức do giảng viên quy định cho môn học.**

Ví dụ một môn có thể cấu hình:

``` text
Xuất sắc:   9.0 – 10.0
Giỏi:       8.0 – <9.0
Khá:        6.5 – <8.0
Trung bình: 5.0 – <6.5
Yếu:        4.0 – <5.0
Kém:        0.0 – <4.0
```

Các ngưỡng trên chỉ là ví dụ, không phải giá trị cố định của hệ thống.

------------------------------------------------------------------------

## 10. Nguyên tắc AI

AI không tự thay thế giảng viên.

Mô hình:

``` text
AI
 ↓
Đề xuất / tạo nội dung
 ↓
Giảng viên kiểm tra
 ↓
Dữ liệu chính thức
```

AI có thể: - Tạo câu hỏi. - Hỗ trợ tạo bài. - Phân tích kết quả CLO.

Thuật toán hệ thống chịu trách nhiệm: - Random câu hỏi. - Kiểm tra ràng
buộc. - Đảm bảo đề đáp ứng yêu cầu.

------------------------------------------------------------------------

## 11. Nguyên tắc phát triển

Ba người cùng dùng một database Supabase.

-   **Nam:** Lead/Admin, chịu trách nhiệm kiến trúc, schema database,
    Supabase, AI tạo đề, kết quả, CLO Analytics, tích hợp, review và
    merge.
-   **Hòa:** Dev 1, phụ trách User, Authentication và Môn học.
-   **Tiến:** Dev 2, phụ trách Ngân hàng câu hỏi, AI tạo câu hỏi và giao
    diện sinh viên làm bài.

Dev chỉ xây chức năng website. Nội dung học thuật được Admin/Giảng viên
tạo và quản lý thông qua hệ thống.

### Database

``` text
GitHub
  → quản lý code

Supabase
  → quản lý dữ liệu

Nam
  → quản lý schema/database migration
```

Dev 1 và Dev 2 sử dụng database chung theo schema đã thống nhất, không
tự ý thay đổi schema production.

------------------------------------------------------------------------

## 12. Nguyên tắc thiết kế tổng thể

``` text
ADMIN
  ↓
Môn học + CLO + Chương + Chủ đề + Sinh viên
  ↓
GIẢNG VIÊN
  ↓
AI tạo câu hỏi
  ↓
Ngân hàng câu hỏi
  ↓
Bài kiểm tra chương / Đánh giá CLO
  ↓
SINH VIÊN
  ↓
Kết quả
  ↓
Phân tích CLO
  ↓
GIẢNG VIÊN
```

Đây là baseline nghiệp vụ đã được chốt cho AI-CLO PTIT HCM.
