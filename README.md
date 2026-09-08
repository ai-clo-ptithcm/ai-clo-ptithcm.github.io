# AI-CLO PTITHCM — V12.6.43

**HỆ THỐNG ỨNG DỤNG TRÍ TUỆ NHÂN TẠO HỖ TRỢ ĐÁNH GIÁ SINH VIÊN THEO CHUẨN ĐẦU RA HỌC PHẦN**

AI-CLO PTITHCM là hệ thống web hỗ trợ quản lý học phần, ngân hàng câu hỏi, xây dựng bài đánh giá theo CLO, làm bài trực tuyến, theo dõi phiên làm bài, phân tích kết quả và các tác vụ AI theo yêu cầu người dùng.

## Checkpoint hiện tại

- Frontend checkpoint: **V12.6.43**
- Nhánh chuẩn: `main`
- Functional commit trước đợt cập nhật tài liệu: `51549fc6157ff8ab369247def6156dc7341a7119`
- GitHub Pages run #897: **success**
- Backend Assessment checkpoint: `assessment_schema_version = 12.3.1`
- Chuỗi V12.6.x hiện tập trung vào Assessment online, Question Bank dùng chung/UX, **AI-CLO | LIVE** và persistence.
- Các migration Live V12.6.34/V12.6.35 là additive và **không đổi `assessment_schema_version`**.

## Kiến trúc chính

Frontend được phục vụ qua GitHub Pages, backend dùng Supabase:

```text
Public pages / app.html
        │
        ├─ CSS theo owner/domain
        ├─ JS core/UI/domain modules
        ├─ Assessment single-owner runtime
        ├─ Shared persistence
        └─ AI-CLO | LIVE
                 │
                 ▼
              Supabase
        ├─ PostgreSQL + RLS
        ├─ Auth / Storage / RPC
        ├─ Attempt autosave + Live telemetry
        └─ Edge Functions self-contained
                 │
                 └─ AI/Gemini theo thao tác chủ động
```

Tài liệu kỹ thuật chính:

- [`docs/project/ARCHITECTURE-AI-CLO.md`](docs/project/ARCHITECTURE-AI-CLO.md)
- [`docs/project/TECHNICAL-AGREEMENTS.md`](docs/project/TECHNICAL-AGREEMENTS.md)

## Assessment

Assessment giữ một owner runtime:

```text
js/
├─ assessment.js
└─ assessment/
   ├─ common.js
   ├─ online-lifecycle.js
   ├─ online-builder.js
   ├─ final-exam.js
   ├─ student-attempt.js
   ├─ live-monitor.js
   └─ results.js
```

Các module hỗ trợ liên quan:

```text
js/assessment/attempt-monitor.js
js/assessment/export-dropdown.js
js/exams/online-export.js
```

Nguyên tắc:

- `assessment.js` là owner/router/lifecycle public duy nhất.
- Child modules đăng ký factory qua `window.AICLO_ASSESSMENT_MODULES`.
- Student Attempt chạy full-width trong `#content`.
- Supabase autosave là nguồn chính thức; local draft chỉ dùng recovery.
- Hết giờ phải dựa vào thời gian server/RPC, không dựa đồng hồ client để quyết định quyền làm lượt mới.
- Shared subpage persistence quản lý Detail / Builder / Attempt / Result / Export / Live.

## AI-CLO | LIVE

LIVE là subpage trong `app.html`, không phải HTML riêng.

- Entry point: nút **AI-CLO | LIVE** cùng hàng với tên bài kiểm tra, canh phải.
- Teacher xem tiến độ số câu, câu hiện tại, thời gian còn lại, heartbeat, fullscreen, số lần/tổng thời gian rời màn hình, warning/disconnected/submitted.
- Teacher không xem A/B/C/D sinh viên đang chọn trong lúc làm bài.
- Dữ liệu Live/history nằm ở Supabase qua RPC; frontend không query trực tiếp table telemetry.
- Fullscreen/Live telemetry là **monitoring signal**, không phải secure-browser/kiosk proof tuyệt đối.

Migration backend Live:

```text
supabase/migrations/assessment-v12.6.34-live-monitoring.sql
supabase/migrations/assessment-v12.6.35-ios-live-sync.sql
```

Các bảng `attempt_live_state` và `attempt_monitor_events` cascade theo `exam_attempts`; xóa lượt làm sẽ xóa Live state/history của lượt đó.

## Persistence / giữ nguyên màn hình

Hai lớp dùng chung:

```text
js/ui/subpage-state.js
js/ui/form-persistence.js
```

Contract hiện hành:

- đổi sang browser tab khác rồi quay lại → **giữ nguyên DOM đang sống, không render lại**;
- giữ scroll/form/workspace nếu không reload/discard;
- reload/discard thật sự → `subpage-state.js` restore;
- click sidebar → điều hướng chủ động → vào **trang mẹ** của menu đó.

Không dùng `visibilitychange/pageshow/focus` để dựng lại view còn sống.

## Question Bank

Tách rõ hai nguồn:

1. **Luyện tập – kiểm tra**.
2. **Đề thi – bảo mật**.

Bài kiểm tra online không được lấy câu chỉ thuộc ngân hàng bảo mật. Thi cuối kỳ dùng workflow bảo mật theo quy tắc đã chốt.

Các contract mới V12.6.x:

- backend có thể giữ `origin_type = 'gemini'`, nhưng UI phải ghi **✦ AI hỗ trợ**;
- trang Thêm câu hỏi có hai mode đối xứng **Tạo một câu | Tải hàng loạt**;
- Excel import dùng sheet chính `Cau_hoi`; không có cột Mã câu, hệ thống tự sinh mã số tự nhiên và đệm 0 khi hiển thị;
- hover desktop của danh sách chỉ có **một owner**: `js/questions/hover-preview.js`;
- hover hiện toàn bộ câu + A/B/C/D, không đánh dấu đáp án đúng;
- `js/questions/matrix-panel.js` không được sở hữu hover nội dung câu hỏi lần nữa.

## CSS ownership

Đợt refactor lớn V12.4.x giữ mô hình **owner-based**:

- `css/app.css` — base controls/form primitives.
- `css/app-brand.css` — sole owner logo/brand.
- `css/ui/application.css` — app geometry/layout.
- `css/ui/primitives.css` — panel/table/stats/toolbar/badge/toast…
- `css/ui/shell.css` — sidebar/header/footer/Drawer chrome.
- `css/ui/dialogs.css` — dialog/modal/confirm.
- `css/ui/app-window.css` — AI-CLO app-window.
- `css/ui/layout-system.css` — generic KPI/action/filter layout classes only.
- CSS nghiệp vụ nằm trong `css/courses/`, `css/questions/`, `css/exams/`, `css/system/`, `css/students/`, `css/results/`.

Question Bank:

- `css/questions/bank.css` — tab/scope/table/card mobile và layout bảng canonical.
- `css/questions/bank-layout.css` — toolbar/filter/chips/selection enhancements.

Assessment Live:

- `css/exams/live-monitor.css` — Live subpage/table/detail responsive.
- `css/exams/attempt-monitor.css` — cảnh báo/monitor UI phía sinh viên.

`css/ui/final-layer.css` đã được loại khỏi runtime và xóa. `css/public.css` không được load trong `app.html`.

## Supabase

```text
supabase/
├─ migrations/
├─ schema/
├─ policies/
├─ functions/
└─ docs/
```

Edge Function phải:

- self-contained;
- không phụ thuộc `_shared` giữa các Function;
- có thể copy/deploy độc lập từ Supabase Dashboard.

Thay code Function trên GitHub không đồng nghĩa Supabase đã redeploy Function đó.

Schema/RPC/RLS thay đổi phải có migration rõ ràng. Frontend-only phải nói rõ không cần thao tác Supabase.

## Công cụ Chấm thi CLO

`/cham-thi-clo/` là công cụ public độc lập, không yêu cầu đăng nhập. Luồng này không được trộn với Assessment online của AI-CLO.

## Tài liệu cần đọc trước khi sửa dự án

Theo thứ tự:

1. [`docs/project/PROJECT-NOTES-AI-CLO.md`](docs/project/PROJECT-NOTES-AI-CLO.md) — quyết định kỹ thuật/UI ưu tiên.
2. [`docs/project/ARCHITECTURE-AI-CLO.md`](docs/project/ARCHITECTURE-AI-CLO.md) — bản đồ kiến trúc hiện hành.
3. [`docs/project/TECHNICAL-AGREEMENTS.md`](docs/project/TECHNICAL-AGREEMENTS.md) — quy tắc kỹ thuật bắt buộc.
4. [`docs/project/PROJECT-STATUS-2026-09-08.md`](docs/project/PROJECT-STATUS-2026-09-08.md) — trạng thái checkpoint mới nhất.
5. [`docs/project/PROJECT-PROGRESS-2026-09-08.md`](docs/project/PROJECT-PROGRESS-2026-09-08.md) — tiến trình chi tiết ngày 08/09.
6. Mã mới nhất trên `main`.

## Tổ chức repository

- `docs/releases/` — VERSION, hướng dẫn nâng cấp và technical notes lịch sử.
- `docs/project/` — kiến trúc, project notes, progress/status và thỏa thuận kỹ thuật.
- `supabase/migrations/` — migration/upgrade SQL.
- `supabase/schema/` — snapshot schema/RLS/policies.
- `supabase/policies/` — policy SQL độc lập.
- `supabase/functions/` — mã nguồn Edge Function.
- `supabase/docs/` — hướng dẫn backend/deploy.

## Ưu tiên tiếp theo

Ưu tiên hiện tại là **smoke test nghiệp vụ thực tế**, đặc biệt:

- Teacher Detail → AI-CLO | LIVE xuất hiện ngay không F5;
- student desktop/iPhone rời màn hình → teacher nhận event;
- thời gian away dừng khi student quay lại;
- browser tab switch giữ nguyên DOM, sidebar click vào trang mẹ;
- Question Bank list/detail đều dùng `AI hỗ trợ`;
- bulk import workbook mới đọc đúng sheet `Cau_hoi`;
- hover Question Bank chỉ còn một popup;
- desktop/mobile không tràn ngang ngoài vùng được thiết kế;
- teacher/student qua Supabase/RLS;
- Excel đáp án+CLO với `/cham-thi-clo`;
- compile TeX với công thức thực tế.
