# Môi trường kiểm nghiệm AI-CLO PTIT HCM

Thư mục `/kiemnghiem` là môi trường staging tách khỏi Production để kiểm nghiệm trước khi xuất bản.

## Trạng thái hiện tại

- Production: các file ở thư mục gốc của repository.
- Production an toàn hiện tại vẫn giữ tại nền **V12.6.13** (`57a725a1a07ffd9982f429a51579c5fcff1ca7e1`).
- `/kiemnghiem` được khởi tạo từ V12.6.13 sạch, sau đó đã phục hồi có chọn lọc các nhóm chức năng A–D theo kiến trúc mới, không copy nguyên chuỗi V12.6.14–V12.6.27.
- URL kiểm nghiệm: `https://ai-clo-ptithcm.github.io/kiemnghiem/app.html`.
- Chỉ Admin Nam dùng môi trường này để kiểm nghiệm.

## Cảnh báo dữ liệu

`/kiemnghiem` vẫn dùng **cùng Supabase Production**. Vì vậy mọi thao tác tạo/sửa/xóa dữ liệu từ staging vẫn tác động vào database thật.

Chỉ dùng:

- môn Demo;
- ngân hàng câu hỏi Demo;
- bài kiểm tra Demo;
- tài khoản Demo.

Không dùng học phần có sinh viên thật để thử chức năng mới.

## Kiến trúc staging hiện tại

- Assessment owner: `js/assessment.js` và các module con trong `js/assessment/`.
- Online Builder owner: `js/assessment/online-builder.js`.
- Student attempt owner: `js/assessment/student-attempt.js`.
- Giám sát phiên làm bài frontend-only owner: `js/assessment/attempt-monitor.js` (`AICLO_ATTEMPT_MONITOR`).
- Dashboard router owner: `js/system/dashboard.js`.
- Tổng quan học phần owner: `js/courses/overview.js`.
- Danh sách thành viên owner: `js/courses/members.js` (`AICLO_COURSE_MEMBERS`).
- Hồ sơ người dùng owner: `js/system/profile.js` (`AICLO_PROFILE`).
- Shell owner: `js/ui/shell.js`.
- Navigation/history owner: `js/ui/navigation.js` cùng `js/ui/subpage-state.js` cho trạng thái trang con.

Nguyên tắc chính: **một hành vi chỉ có một runtime owner**. Legacy layer không được render thêm UI hoặc giành lại behavior nếu canonical owner đã tồn tại.

## Giám sát phiên làm bài — frontend-only

Bản staging hiện có cơ chế **Giám sát phiên làm bài** chỉ ở frontend:

- phát hiện sinh viên chuyển tab/ẩn tab;
- phát hiện cửa sổ mất focus;
- phát hiện thoát Fullscreen sau khi đã bật;
- đếm số lần rời màn hình trong phiên hiện tại;
- cộng tổng thời gian rời màn hình;
- hiển thị cảnh báo và nút **Bật toàn màn hình**;
- lưu tạm dữ liệu giám sát trong `sessionStorage` trên chính thiết bị/trình duyệt đang làm bài.

Giới hạn bắt buộc phải nhớ:

- **không ghi bất kỳ log giám sát nào lên Supabase**;
- không đổi schema/RLS/Edge Function;
- không tự nộp bài khi vi phạm;
- không thể ngăn tuyệt đối Alt+Tab, thiết bị thứ hai, chụp màn hình hay các hình thức gian lận ngoài trình duyệt;
- đây là cơ chế cảnh báo/hạn chế rời màn hình, không phải hệ thống chống gian lận tuyệt đối.

## Quy ước AI

- UI người dùng luôn dùng từ **AI**.
- Metadata/backend có thể tiếp tục giữ các giá trị kỹ thuật như `gemini`, `origin_type='gemini'`, provider/model/log khi cần tương thích dữ liệu hiện có.

## Quy tắc xuất bản

Không đồng bộ bất kỳ thay đổi nào từ `/kiemnghiem` ra root Production cho đến khi:

1. đã kiểm nghiệm đầy đủ trên Demo;
2. Assessment đề cố định vẫn hoạt động đúng;
3. diff staging được rà lại;
4. người dùng nói rõ **“xuất bản”**.

Mốc khởi tạo `/kiemnghiem`: V12.6.13 (`57a725a1a07ffd9982f429a51579c5fcff1ca7e1`).
