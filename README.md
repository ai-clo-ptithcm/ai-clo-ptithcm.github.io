# AI-CLO PTITHCM — V12.6.53

**HỆ THỐNG ỨNG DỤNG TRÍ TUỆ NHÂN TẠO HỖ TRỢ ĐÁNH GIÁ SINH VIÊN THEO CHUẨN ĐẦU RA HỌC PHẦN**

AI-CLO PTITHCM là hệ thống web hỗ trợ quản lý học phần, ngân hàng câu hỏi, xây dựng bài đánh giá theo CLO, làm bài trực tuyến, theo dõi phiên làm bài, phân tích kết quả và các tác vụ AI theo yêu cầu người dùng.

## Giấy phép và quyền sử dụng mã nguồn

**GNU GPL-2.0-or-later** đối với mã nguồn gốc thuộc phạm vi giấy phép; được quyền sử dụng, chỉnh sửa và phân phối lại theo các điều kiện của GPL v2 hoặc phiên bản mới hơn. Xem [`LICENSE.md`](LICENSE.md). Giấy phép không tự động cấp quyền đối với dữ liệu người dùng, bí mật hệ thống, nhãn hiệu hay tài sản thuộc bên thứ ba.

Ngoại lệ: các thành phần có giấy phép riêng và các quyền đã được cấp hợp lệ tiếp tục được tôn trọng. Riêng [`tools/exam-shuffler/`](tools/exam-shuffler/LICENCE.MD) có giấy phép MIT. Việc sử dụng website chính thức của người dùng khác với quyền sử dụng lại mã nguồn.

## Checkpoint hiện tại

- Frontend checkpoint: **V12.6.53**
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
- trang Thêm câu hỏi có ba mode **Tạo một câu | Nhận dạng từ ảnh | Tải hàng loạt**;
- mode nhận dạng ảnh gửi một ảnh PNG/JPG/WEBP lên Edge Function `recognize-question-image`; Gemini điền nội dung, A–D, đáp án và lời giải vào biểu mẫu để giảng viên kiểm tra trước khi lưu;
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

## Công cụ Chấm thi CLO — EXAM-CLO BM33 v1.9

Công cụ public tại [`tools/cham-thi-clo/`](tools/cham-thi-clo/index.html) độc lập với Assessment online. Người dùng không cần đăng nhập để chấm, xem thống kê hoặc xuất file Excel.

- Đọc một hoặc nhiều file UnT, một bộ đáp án + CLO, file khảo thí tùy chọn; vẫn kiểm tra SBD, mã đề và cho sửa dữ liệu trước khi chấm. **Không thay đổi thuật toán chấm điểm.**
- Xuất Bảng điểm phách và Bảng điểm chi tiết như trước, nhưng sắp xếp SBD **tăng dần theo giá trị số** trong từng phòng; vẫn giữ các dòng phách vắng mặt khi có danh sách khảo thí.
- Nút **Xem / xuất BM33** mở cửa sổ xem trước: tổng số bài, GPA, phân bố điểm, tỷ lệ đạt CLO, độ khó và độ phân hóa câu hỏi theo **từng mã đề**. Nhận xét có thể chỉnh trước khi xuất.
- **Phân tích bằng AI** chỉ chạy khi người dùng chủ động bấm nút. Gửi **thống kê tổng hợp ẩn danh**, không gửi SBD, tên hoặc bài làm của sinh viên. Chỉ tài khoản giảng viên/quản trị viên đăng nhập mới dùng AI; không đăng nhập vẫn xuất thủ công bình thường.
- AI viết gợi ý cho nhận xét/khuyến nghị BM33; **giảng viên kiểm duyệt** trước khi xuất. AI không quyết định điểm, không tự khẳng định có sự cố thi hay đề thi phù hợp với đề cương khi thiếu thông tin.
- Xuất `Bao-cao-phan-tich-ket-qua-thi.xlsx` gồm sheet Đáp án, Toàn bộ bài làm, BM33 - Báo cáo và sheet phân tích từng nhóm câu hỏi/mã đề (nếu có).
- Ngưỡng điểm đạt mặc định **4,0/10**, tỷ lệ sinh viên đạt CLO mặc định **70%**. Các ngưỡng phải được đối chiếu với quy định học phần/đơn vị trước khi dùng kết quả chính thức. Mức xếp loại Kém (`<4`) và Yếu (`4–<5`) đã được sửa lại theo thứ tự thông thường.

**Source chính:** `tools/cham-thi-clo/js/reportPreview.js`, `exportMulti.js`, `exportReport.js`, `css/report-preview.css`.

**Backend AI:** `supabase/functions/bm33-ai/index.ts`. Edge Function này tách biệt khỏi `analyze-assessment` (Assessment online); triển khai trên **project `rraooqedkpyhokattwdz`, organization `mefpbfoxonywucvftgqg`**. Cấu hình `verify_jwt=true` và secret `GEMINI_API_KEY` hoặc `GEMINI_LIVE_API_KEY`. Phải **deploy Edge Function lên Supabase**, vì GitHub chỉ lưu source. Có guard role giảng viên/quản trị, giới hạn tối đa 5 lượt/5 phút/người trong một instance (không thay thế rate-limit tập trung).

Cần kiểm thử nghiệp vụ trên mẫu UnT/khảo thí thực tế trước khi đưa BM33 vào hồ sơ chính thức.

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


