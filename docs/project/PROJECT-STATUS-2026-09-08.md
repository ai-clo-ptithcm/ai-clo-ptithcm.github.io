# Trạng thái dự án AI-CLO PTITHCM — 08/09/2026

## Trạng thái tổng quát

- Nhánh triển khai chuẩn: `main`.
- Frontend checkpoint: **V12.6.43**.
- Functional commit trước khi cập nhật docs: `51549fc6157ff8ab369247def6156dc7341a7119`.
- GitHub Pages run #897: **success**.
- Backend Assessment version function vẫn giữ `assessment_schema_version = 12.3.1`.
- Trọng tâm hiện tại: **Assessment online + AI-CLO | LIVE + persistence + Question Bank UX**.

## Assessment hiện hành

### Student Attempt

- Autosave đáp án lên Supabase.
- Local recovery chỉ là lớp dự phòng.
- Hết giờ được xác nhận bằng `remaining_seconds` từ server.
- Lượt hết giờ nhưng chưa submit được reconcile/finalize để không chặn lượt tiếp theo.
- Browser tab switch không được render lại workspace đang sống.

### Teacher Detail

- Nút **AI-CLO | LIVE** nằm cùng hàng với tên bài kiểm tra, canh phải.
- Nút phải xuất hiện ngay khi mở Chi tiết từ danh sách, không phụ thuộc reload/F5.
- Dropdown xuất Excel đóng khi click ngoài / Esc / chọn action.

## AI-CLO | LIVE

LIVE là subpage trong `app.html`, không phải trang HTML riêng.

Teacher xem được:

- tiến độ số câu;
- câu hiện tại;
- thời gian còn lại;
- heartbeat/hoạt động cuối;
- fullscreen;
- số lần/tổng thời gian rời màn hình;
- warning/disconnected/submitted/expired;
- lịch sử event và sơ đồ câu đã làm/chưa làm.

Teacher **không xem A/B/C/D đang chọn**.

### Backend Live

Source migration:

```text
supabase/migrations/assessment-v12.6.34-live-monitoring.sql
supabase/migrations/assessment-v12.6.35-ios-live-sync.sql
```

Các object chính:

- `attempt_live_state`;
- `attempt_monitor_events`;
- RPC update/sync student telemetry;
- RPC teacher đọc snapshot/history.

`attempt_live_state.attempt_id` và `attempt_monitor_events.attempt_id` đều cascade theo `exam_attempts`; xóa lượt làm sẽ xóa nhật ký giám sát của đúng lượt đó.

Cần **xác nhận production Supabase đã chạy đủ V12.6.34 + V12.6.35** trước khi coi Live backend hoàn tất.

## Browser-tab persistence contract

Contract hiện hành:

- đổi sang browser tab khác rồi quay lại → **giữ nguyên DOM, không render lại**;
- giữ nguyên scroll/form/workspace nếu trang không reload/discard;
- reload/discard thật sự → dùng `subpage-state.js` để restore;
- click sidebar → navigation chủ động → mở **trang mẹ** của menu đó.

Không được dùng `visibilitychange`, `pageshow` hoặc auth focus event để dựng lại view đang sống.

## Question Bank hiện hành

### Provenance

Backend giữ giá trị kỹ thuật:

```text
origin_type = 'gemini'
```

UI hiển thị:

```text
✦ AI hỗ trợ
```

Không đổi Supabase chỉ để đổi nhãn.

### Bulk import

- Hai mode trang Thêm câu hỏi: **Tạo một câu | Tải hàng loạt**.
- Excel template có sheet chính `Cau_hoi` và các sheet `Vi_du`, `Chuong_Chu_de`, `CLO`, `Danh_muc`, `Huong_dan`.
- Không nhập mã câu trong Excel; hệ thống tự sinh mã số tự nhiên và UI đệm 0 khi hiển thị.

### Danh sách / hover

- `css/questions/bank.css` là owner table/card.
- `js/questions/hover-preview.js` là **owner duy nhất** của hover câu hỏi.
- Hover desktop: toàn bộ câu + A/B/C/D, không đánh dấu đáp án đúng.
- `js/questions/matrix-panel.js` không còn sở hữu hover “NỘI DUNG ĐẦY ĐỦ”.

## Quy tắc kỹ thuật đang áp dụng

1. Một behavior = một owner runtime.
2. Sửa đúng owner, không tạo wrapper/monkey patch nếu không cần.
3. Frontend-only không yêu cầu SQL Supabase.
4. Migration/RPC phải nằm dưới `supabase/migrations/` và ghi rõ thao tác cần chạy.
5. Edge Function tự chứa, không phụ thuộc `_shared` giữa các function.
6. Fullscreen web/Live telemetry là tín hiệu giám sát, không phải secure browser/kiosk tuyệt đối.
7. Không cho teacher Live xem lựa chọn đáp án đang làm.
8. Mobile không được kéo toàn app tràn ngang; bảng rộng phải scroll trong vùng bảng hoặc chuyển card.

## Smoke test ưu tiên

- Chi tiết bài kiểm tra mở LIVE ngay không F5.
- Student desktop/iPhone rời màn hình → teacher nhận event.
- Thời gian away dừng sau khi student quay lại.
- Đổi browser tab → màn hình giữ y nguyên.
- Click sidebar → vào trang mẹ.
- Xóa attempt → Live state/event cascade theo.
- Question Bank chỉ có một hover.
- List/Detail đều dùng nhãn `AI hỗ trợ`.
- Bulk import workbook mới đọc đúng `Cau_hoi`.
