# Tiến độ dự án AI-CLO PTITHCM — 08/09/2026

## Mốc hiện tại

Dự án tiếp tục ở chuỗi **V12.6.x**, trọng tâm ngày 08/09/2026 là:

1. ổn định luồng Assessment online và trang Chi tiết bài kiểm tra;
2. bổ sung **AI-CLO | LIVE** cho giảng viên theo dõi phiên làm bài;
3. sửa cơ chế giữ nguyên màn hình khi đổi tab trình duyệt;
4. hoàn thiện UX Ngân hàng câu hỏi, bulk import, provenance label và hover preview;
5. giữ nguyên nguyên tắc một behavior có một owner runtime rõ ràng.

Checkpoint frontend cuối ngày trước khi cập nhật tài liệu:

- Functional checkpoint: **V12.6.43**.
- Commit: `51549fc6157ff8ab369247def6156dc7341a7119`.
- GitHub Pages run #897: **success**.
- `main` là nhánh triển khai chuẩn.

Backend Assessment vẫn giữ `assessment_schema_version = 12.3.1`; các migration V12.6.x dưới đây là additive/hardening và **không đổi schema version**.

## 1. Assessment Detail và trạng thái lượt làm

### Header Chi tiết bài kiểm tra

Đã chuẩn hóa header trang con Chi tiết bài kiểm tra để title/subtitle/action rõ ràng hơn. Nút **AI-CLO | LIVE** được đặt **cùng hàng với tên bài kiểm tra, canh phải**, không nằm chung action bar với Làm thử / Xuất / Sửa / trạng thái.

### Lượt làm hết giờ nhưng chưa submit

Đã sửa tình huống một `exam_attempts` chưa có `submitted_at` nhưng thời gian đã hết làm sinh viên bị kẹt ở trạng thái “Tiếp tục”.

Frontend `js/assessment/student-attempt.js` hiện:

- gọi `get_exam_attempt_payload` để lấy `remaining_seconds` theo **thời gian server**;
- nếu server xác nhận hết giờ, gọi `finalize_exam_attempt`;
- refresh lại danh sách lượt;
- chỉ coi một lượt là “đang mở” khi chưa submit và chưa bị xác nhận hết giờ;
- không dùng đồng hồ client để quyết định quyền tạo lượt mới.

Backend `start_exam_attempt` vốn đã có cơ chế tự finalize lượt hết hạn trước khi tạo lượt mới; frontend mới không còn chặn đường đi tới cơ chế backend này.

## 2. AI-CLO | LIVE

### Kiến trúc UI

LIVE là **subpage trong `app.html`**, không tạo HTML riêng.

Entry point:

- trang Chi tiết bài kiểm tra phía giảng viên/Admin;
- nút `AI-CLO | LIVE` cùng hàng title;
- mở subpage Live và Quay lại trở về đúng Chi tiết bài kiểm tra.

Owner chính:

```text
js/assessment/live-monitor.js
css/exams/live-monitor.css
js/assessment/attempt-monitor.js
```

`live-monitor.js` refresh snapshot khoảng 5 giây/lần; không dùng polling 500 ms lên backend.

### Dữ liệu giảng viên được xem

LIVE hiển thị:

- sinh viên / mã sinh viên;
- số lần làm;
- số câu đã trả lời / tổng số câu;
- câu hiện tại;
- thời gian còn lại theo server;
- hoạt động cuối;
- trạng thái fullscreen;
- số lần và tổng thời gian rời màn hình;
- trạng thái đang làm / cảnh báo / mất kết nối / hết giờ / đã nộp;
- sơ đồ câu đã trả lời/chưa trả lời trong Drawer chi tiết.

**Không hiển thị A/B/C/D mà sinh viên đang chọn trong lúc làm bài.**

### Backend Live V12.6.34

Migration:

```text
supabase/migrations/assessment-v12.6.34-live-monitoring.sql
```

Tạo:

- `attempt_live_state` — snapshot/presence một dòng mỗi attempt;
- `attempt_monitor_events` — lịch sử sự kiện rời màn hình;
- RPC update presence/event và RPC teacher đọc snapshot/history.

Các bảng chỉ dùng qua RPC; quyền được kiểm tra ở backend. `attempt_id` liên kết `exam_attempts` bằng `ON DELETE CASCADE`, vì vậy **xóa lượt làm = xóa cả Live state và nhật ký giám sát của lượt đó**.

### iPhone / iOS V12.6.35

Safari/iOS có thể freeze JavaScript rất nhanh khi app/tab đi nền, nên sự kiện phía sinh viên có thể hiện cảnh báo local nhưng chưa kịp gửi server.

Migration:

```text
supabase/migrations/assessment-v12.6.35-ios-live-sync.sql
```

Bổ sung:

- `client_event_id` cho sự kiện monitor;
- unique `(attempt_id, client_event_id)` khi id có giá trị;
- RPC `sync_attempt_monitor_event(...)` để gửi/bù sự kiện khi sinh viên quay lại;
- de-duplicate sự kiện nếu đã gửi được trước khi iOS freeze.

Frontend khi quay lại app/tab sẽ sync lại incident và heartbeat Live. Đây là **monitoring signal**, không phải secure-browser/kiosk proof.

### Sửa thời gian rời màn hình

Đã sửa lỗi teacher Live tiếp tục cộng thời gian rời màn hình sau khi sinh viên đã quay lại:

- chỉ cộng realtime khi `page_visible = false` và chưa submit;
- khi heartbeat/finish event xác nhận quay lại thì dừng ngay;
- lượt đã nộp không tiếp tục tăng thời gian.

### Responsive Live

Đã sửa Live làm tràn toàn app viewport:

- bảng rộng cuộn bên trong `table-wrap`;
- shell không bị kéo rộng theo bảng;
- summary cards responsive theo viewport.

### Excel lịch sử Live

LIVE có chức năng tải lịch sử Excel phục vụ kiểm tra/audit của bài, gồm dữ liệu tổng hợp phiên và sự kiện monitor theo dữ liệu backend hiện có.

## 3. Giữ nguyên màn hình khi đổi tab trình duyệt

Đã chốt contract mới cho toàn app:

> **Đổi browser tab rồi quay lại = không điều hướng, không render lại, giữ nguyên DOM đang sống.**

Cơ chế mới:

- `visibilitychange/pageshow/focus` không được dùng để render lại view nếu DOM hiện tại vẫn sống;
- không được lóe trang mẹ rồi mới restore trang con;
- giữ nguyên vị trí cuộn, form đang nhập, workspace, menu/panel đang sống nếu browser không discard/reload;
- F5/reload/discard thật sự vẫn dùng `subpage-state.js` để restore;
- **nhấn sidebar** là điều hướng chủ động: clear subpage context phù hợp và mở đúng **trang mẹ** của mục đó.

Ví dụ:

- đang ở Chi tiết bài kiểm tra → đổi tab Chrome → quay lại: giữ nguyên Chi tiết;
- đang ở Chi tiết bài kiểm tra → bấm sidebar **Đánh giá**: mở Danh sách bài kiểm tra.

## 4. Dropdown xuất Excel của Assessment

Menu **Tải kết quả Excel** đã được chuẩn hóa:

- click bên ngoài → đóng;
- `Esc` → đóng và trả focus về trigger;
- chọn một chế độ export → đóng menu rồi mới thực hiện export.

Không thay đổi logic tính điểm/export.

## 5. Question Bank — provenance label

Giá trị kỹ thuật backend vẫn giữ:

```text
origin_type = 'gemini'
```

User-facing label đã chuẩn hóa thành:

```text
✦ AI hỗ trợ
```

Áp dụng nhất quán ở danh sách và Chi tiết câu hỏi. **Không đổi dữ liệu `origin_type` trong Supabase** chỉ để đổi nhãn UI.

## 6. Question Bank — Tạo một câu / Tải hàng loạt

Trang con Thêm câu hỏi đã chuẩn hóa hai mode đối xứng:

```text
Tạo một câu | Tải hàng loạt
```

Bulk import dùng cùng workspace/pattern điều hướng với tạo một câu.

### Excel mẫu

Template mới tách rõ các sheet:

- `Cau_hoi` — sheet nhập chính;
- `Vi_du` — câu mẫu riêng, tránh import nhầm dòng minh họa;
- `Chuong_Chu_de`;
- `CLO`;
- `Danh_muc`;
- `Huong_dan`.

Cột canonical của sheet nhập:

```text
Chương | Chủ đề | CLO | Nội dung | A | B | C | D | Đáp án | Lời giải | Ngân hàng | Trạng thái
```

Không có cột **Mã câu** trong Excel import. Hệ thống tự cấp mã; mã là số tự nhiên theo sequence nghiệp vụ và UI hiển thị dạng đệm 0, ví dụ `000307`.

Khi đọc workbook, importer ưu tiên đúng sheet `Cau_hoi` thay vì mặc định mù quáng sheet đầu tiên.

## 7. Question Bank — bảng danh sách và hover preview

### Khoảng cách cột

Đã giảm khoảng trắng giữa **Mã câu** và **Nội dung**:

- `bank.css` dùng `table-layout:auto` cho desktop table;
- cột Mã được cố định hợp lý;
- Nội dung ăn phần chiều rộng còn lại;
- mobile card mode giữ nguyên.

### Hover preview

Ngày 08/09 phát hiện tồn tại **hai cơ chế hover**:

1. hover legacy trong `js/questions/matrix-panel.js` — chỉ hiện “NỘI DUNG ĐẦY ĐỦ”;
2. hover mới trong `js/questions/hover-preview.js` — hiện câu hỏi + A/B/C/D.

Đã xóa hover legacy khỏi `matrix-panel.js` và chốt **một owner duy nhất**:

```text
js/questions/hover-preview.js
```

Quy tắc hiện tại:

- hover desktop vào nội dung → hiện toàn bộ câu + A/B/C/D;
- không đánh dấu đáp án đúng;
- lazy-load option khi cần và cache theo câu;
- mobile không dùng hover;
- `matrix-panel.js` không được thêm lại listener hover câu hỏi.

## 8. Quy tắc an toàn được củng cố

- Một behavior chỉ có **một runtime owner**.
- Không dùng wrapper/monkey patch nếu có thể sửa đúng owner.
- Browser tab switch không phải navigation.
- Sidebar click là navigation chủ động về trang mẹ.
- Fullscreen browser chỉ là tín hiệu giám sát; không gọi đó là secure browser/kiosk.
- Không hiển thị lựa chọn A/B/C/D đang làm cho teacher Live.
- Telemetry Live là dữ liệu giám sát, không phải bằng chứng chống gian lận tuyệt đối.
- Frontend-only phải nói rõ không cần Supabase; migration/RPC phải tách riêng và nói rõ cần chạy SQL nào.

## 9. Migration cần xác nhận trên Supabase

Source hiện có trên GitHub:

```text
supabase/migrations/assessment-v12.6.34-live-monitoring.sql
supabase/migrations/assessment-v12.6.35-ios-live-sync.sql
```

Nếu production Supabase chưa chạy đủ hai migration này thì frontend Live vẫn có thể load, nhưng teacher Live/backend history không đầy đủ. Cần xác nhận trên Supabase SQL Editor trước khi coi LIVE production-ready.

## 10. Backup quan trọng trong ngày

Một số backup gần nhất:

- `backup-20260908-expired-attempt-fix`
- `backup-20260908-live-monitoring`
- `backup-20260908-ios-live-sync`
- `backup-20260908-browser-tab-freeze`
- `backup-20260908-live-entry-away-timer`
- `backup-20260908-question-origin-label`
- `backup-20260908-question-bulk-import-ui`
- `backup-20260908-question-hover-preview`
- `backup-20260908-question-column-spacing`
- `backup-20260908-remove-legacy-question-hover`

## 11. Việc cần smoke test tiếp

1. Teacher: Đánh giá → Chi tiết → nút **AI-CLO | LIVE** xuất hiện ngay, không cần F5.
2. Student desktop: làm bài → đổi tab → quay lại → warning + Live teacher cập nhật.
3. Student iPhone: rời Safari/app 5–10 giây → quay lại → incident được sync teacher.
4. Live: thời gian rời màn hình dừng khi student quay lại.
5. Xóa một attempt → Live state/events của attempt đó biến mất theo cascade.
6. Browser tab switch trên các subpage khác → không render lại/không nháy trang mẹ.
7. Sidebar click từ subpage → vào đúng trang mẹ.
8. Question Bank: danh sách + Chi tiết đều ghi **AI hỗ trợ**.
9. Bulk import Excel template mới → import đúng sheet `Cau_hoi`.
10. Hover Question Bank → chỉ một popup câu + A/B/C/D.
11. Desktop/mobile Question Bank không tràn ngang ngoài vùng được thiết kế.
