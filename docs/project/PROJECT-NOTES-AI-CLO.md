# AI-CLO PTITHCM — Ghi nhớ kỹ thuật và quyết định thiết kế

> File này là **nguồn ghi nhớ kỹ thuật/UI/nghiệp vụ ưu tiên** để tiếp tục phát triển dự án trong các phiên sau. Khi bắt đầu chỉnh sửa AI-CLO, đọc file này trước; sau đó đọc `ARCHITECTURE-AI-CLO.md` để tìm đúng owner và `TECHNICAL-AGREEMENTS.md` để kiểm quy tắc bắt buộc.

Cập nhật gần nhất: **08/09/2026 — V12.6.43**

## 1. Nguyên tắc phát triển đã chốt

- Ưu tiên **framework dùng chung**, tránh sửa chắp vá từng trang.
- Một behavior quan trọng chỉ có **một runtime owner**.
- Tái sử dụng component, CSS, app-window, toolbar, panel, state manager hiện có trước khi tạo lớp mới.
- Không monkey patch/wrapper nếu có thể sửa đúng owner.
- Không thay schema Supabase nếu chưa thật sự cần; ưu tiên tương thích dữ liệu cũ.
- Supabase Edge Function phải **self-contained**, không phụ thuộc `_shared`, vì deploy từng function trực tiếp từ Dashboard.
- AI chỉ gọi khi người dùng chủ động yêu cầu, trừ nơi được chốt khác.
- User-facing wording ưu tiên **AI**; metadata kỹ thuật có thể giữ `gemini` nếu cần tương thích.
- Khi đang trao đổi/góp ý/thiết kế: **không tự ý sửa repo**. Chỉ triển khai khi người dùng yêu cầu rõ; trước thay đổi runtime/backend có ý nghĩa phải tạo backup branch.

## 2. Chuẩn giao diện toàn web

### Popup / window / drawer

- **Chi tiết / xem nhanh** → Drawer/panel khi phù hợp.
- **Sửa nhanh** → AI-CLO app-window thống nhất.
- **Sửa đầy đủ / cấu trúc lớn** → full-width subpage/workspace.
- Boolean bật/tắt → toggle switch kiểu iPhone khi phù hợp.
- Desktop app-window có header đỏ, padding/footer thống nhất, drag/resize nếu component hỗ trợ.
- Mobile app-window chuyển gần full-screen.
- Không dùng Drawer legacy để chỉnh cấu trúc bài kiểm tra.

### Responsive

- Mobile không được kéo toàn shell/form tràn ngang.
- Bảng thật sự rộng phải scroll **bên trong vùng bảng** hoặc chuyển card mode.
- Nhóm KPI/action desktop ưu tiên một hàng khi đủ chiều rộng; chỉ xuống hàng ở breakpoint hợp lý.
- Khi sửa desktop phải kiểm lại mobile.

### Dropdown / popover

- Click bên ngoài → đóng.
- `Esc` → đóng khi phù hợp; trả focus về trigger nếu đó là menu/dialog interaction.
- Chọn action → đóng UI trước rồi thực hiện action.

## 3. CSS ownership cần giữ

### Core/UI

- `css/app.css` — token màu, typography/control base, field/input/button, form primitives.
- `css/app-brand.css` — **sole owner** logo/brand login + sidebar.
- `css/ui/application.css` — app geometry/layout, content sizing, boot guard.
- `css/ui/primitives.css` — stats, panel, toolbar, table, badge, empty, toast, progress.
- `css/ui/shell.css` — sidebar/header/footer shell chrome + Drawer.
- `css/ui/dialogs.css` — native dialog/modal/confirm chrome.
- `css/ui/app-window.css` — AI-CLO app-window chrome/drag/resize/mobile.
- `css/ui/layout-system.css` — generic-only `.aiclo-kpi-grid`, `.aiclo-action-grid`, `.aiclo-filter-bar`.
- `css/ui/mobile-overrides.css` — shared mobile guards/fallback còn cần thiết.

Không tạo lại `css/ui/final-layer.css`. `app.html` không load `css/public.css`. `css/legacy/` là archive only.

### Domain

- `css/courses/structure.css` — Chương · Chủ đề · CLO.
- `css/courses/catalog.css` — course catalog/cards.
- `css/courses/class-list.css` — thành viên/lớp.
- `css/system/dashboard.css` — Dashboard.
- `css/system/notifications.css` — Notification UI.
- `css/system/activity.css` — Activity log.
- `css/system/profile.css` — Profile/account.
- `css/system/question-banks.css` — quản trị Question Bank cấp hệ thống.
- `css/questions/bank.css` — canonical Question Bank tabs/scope/table/card + table geometry/hover chrome.
- `css/questions/bank-layout.css` — toolbar/filter/chips/selection enhancements.
- `css/questions/analysis.css`, `tools.css`, `workspace.css`, `duplicate-scan.css`, `matrix-panel.css`, `quick-edit.css` — đúng domain tương ứng.
- `css/exams/assessment-shared.css` — shared Assessment controls/workspace/matrix.
- `css/exams/student-attempt.css` — sole owner student exam list/detail/history/attempt workspace.
- `css/exams/detail-enhancements.css` — teacher/Admin exam Detail + attempt table.
- `css/exams/live-monitor.css` — teacher **AI-CLO | LIVE**.
- `css/exams/attempt-monitor.css` — student monitoring/warning/fullscreen controls.
- `css/exams/unified-builder.css` — unified builder.
- `css/students/profile.css` — student profile.
- `css/results/ai-state.css` — result AI state.

Không để Question Bank, duplicate scan và Assessment dùng lẫn class nghiệp vụ để tránh cascade ngoài ý muốn.

## 4. Framework chung cho 4 loại bài

Bốn loại bài dùng cùng framework:

1. **Mục 1 — Thông tin bài**
2. **Mục 2 — Cấu trúc / Ma trận**
3. **Mục 3 — Danh sách câu hỏi đã rút**
4. **Mục 4 — Xuất** chỉ với loại bài phù hợp

### 4.1. Kiểm tra thường

- Nguồn câu: **Ngân hàng luyện tập – kiểm tra**.
- Mục 1 không chọn Chương.
- Mục 2 chọn phạm vi Chương/Mục.
- Ma trận: **Mục × CLO**.
- Có thể phát hành cho sinh viên làm online.

### 4.2. Đánh giá CLO

- Nguồn câu: **Ngân hàng luyện tập – kiểm tra**.
- Mục 2 chọn phạm vi Chương và các Mục con được dùng.
- Ma trận: hàng = Chương, cột = CLO.
- CLO chung các Mục được chọn nhưng **tách theo từng Chương**.
- Đổi câu giữ Chương + CLO; có thể đổi Mục trong tập Mục đã chọn của Chương đó.
- Có thể phát hành online.

### 4.3. Ôn tập thi

- Nguồn: **Luyện tập – kiểm tra**, không dùng secure bank.
- Có hai mode cấu trúc: CLO cho mỗi Mục / CLO chung các Mục đã chọn, vẫn tách Chương.
- Có thể bật xem đáp án/lời giải sau nộp.
- Có thể phát hành online.
- Xuất TeX; không dùng BM07/BM08 hành chính chính thức.

### 4.4. Thi cuối kỳ

- **Chỉ** dùng **Ngân hàng đề thi – bảo mật**.
- Không phát hành cho sinh viên làm online.
- Trạng thái: Bản nháp → Khóa ↔ Mở khóa.
- Khi khóa: không sửa cấu trúc/đổi câu; vẫn xem/xuất.
- Xuất bằng engine đã kiểm nghiệm cho BM07 · BM08 · TeX và đầu ra liên quan.

## 5. Quy tắc Mục 1 / Mục 2 / Mục 3

### Mục 1

- Hiển thị gọn kiểu văn bản/2 cột, không biến mọi field thành card xám.
- Có Tổng số câu.
- Read-only gọn; nút Chỉnh sửa mở app-window.
- Không chứa chọn Chương; phạm vi nội dung nằm ở Mục 2.

### Mục 2

- Có Chọn phạm vi.
- Có giải thích ngắn + tooltip nếu cần.
- Tổng ma trận phải bằng `total_questions` trước khi rút.
- Nếu yêu cầu vượt số câu có sẵn → cảnh báo và không rút.

### Mục 3

- Với mode có câu cụ thể: hiển thị câu số, CLO, Chương/Mục, nội dung/phương án.
- Có Đổi câu và AI sinh câu trước khi bị khóa.
- Đổi câu phải giữ đúng cell cấu trúc/ngữ cảnh ban đầu.

## 6. Bốn cách rút câu online

1. `common_fixed` — **Đề chung cố định**: hiển thị/chốt toàn bộ câu cụ thể.
2. `student_fixed` — **Đề riêng theo sinh viên**: Builder không hiện câu cụ thể; mỗi sinh viên có một bộ riêng và giữ bộ đó.
3. `attempt_random` — **Rút lại mỗi lần làm**: Builder không hiện câu cụ thể; mỗi attempt rút theo ma trận.
4. `mixed_fixed_random` — **Cố định và rút ngẫu nhiên**: chọn câu cố định trước; phần còn lại rút random.

### `mixed_fixed_random`

- Phải có ít nhất 1 câu cố định.
- Thứ tự: **lập ma trận → chọn câu cố định → rút phần còn lại → lưu**.
- Câu cố định tiêu thụ quota đúng cell.
- Builder chỉ hiện câu cố định + thống kê phần random; không liệt kê random cụ thể.
- Nếu đổi ma trận/phạm vi hoặc thay câu cố định sau khi rút → trạng thái phần random phải invalid và rút lại.
- Không dùng thiết kế fixed slot Câu 1/Câu 2/...; prototype đó đã bỏ.

Migration: `supabase/migrations/assessment-v12.6-mixed-fixed-random.sql`.

## 7. Ownership dữ liệu Question Bank / Subject

### Question Bank (`question_bank_id`) sở hữu

- Chương
- Mục
- CLO
- Câu hỏi

### Subject/Học phần (`subject_id`) sở hữu

- Bài kiểm tra
- phát hành
- lượt làm
- câu trả lời/draft answer
- kết quả CLO/GPA
- final package

Nhiều học phần/lớp có thể dùng chung một Question Bank.

Không quay lại giả định “câu hỏi thuộc lớp hiện tại” chỉ vì legacy schema còn `questions.subject_id`. Trường này đang phục vụ compatibility/FK legacy; ownership thật là `question_bank_id`.

Bridge frontend: `js/core/question-bank-ownership.js`.

Migration:

- `v12.6.3-question-bank-legacy-subject.sql` — chuẩn hóa trường legacy khi ghi câu.
- `assessment-v12.6.4-question-bank-scope.sql` — Assessment/Final Exam xác thực pool theo `question_bank_id`.

## 8. Lưu nháp và trạng thái bài online

- Rút câu tạo/cập nhật draft chính thức.
- Không tạo draft có `total_questions = 0`.
- Sau khi draft có trên Supabase, DB là nguồn bền vững; local/session chỉ hỗ trợ UI/workspace chưa sync.

Trạng thái sinh viên:

- Bản nháp
- Sắp mở
- Đang mở
- Tạm đóng
- Đã hết hạn
- Đã hết lượt

Teacher Detail có thao tác Phát hành / Tạm đóng / Mở lại tương ứng.

## 9. Quy tắc `max_attempts`

`max_attempts` được phép chỉnh dù đã có sinh viên làm.

- Tăng → sinh viên có thêm lượt nếu chưa đạt giới hạn mới.
- Giảm thấp hơn lịch sử → **không xóa, không sửa** lượt cũ.
- Chỉ chặn lượt mới khi số lượt hiện có >= giới hạn mới.
- Thi cuối kỳ không phát hành nên không dùng nghiệp vụ attempt online.

## 10. Trang Chi tiết bài kiểm tra

### Teacher / Admin

- KPI/action/filter toolbar ưu tiên một hàng trên desktop khi đủ chỗ.
- Sửa cấu trúc đi vào đúng builder framework theo `exam_type`, không mở legacy UI.
- Admin xóa bài bằng `admin_delete_exam`.
- Admin xóa attempt bằng `admin_delete_attempt`; teacher không hiện nút xóa attempt.
- Migration V12.5 harden xóa attempt và đánh số lại lịch sử an toàn.

### AI-CLO | LIVE entry

- Nút **AI-CLO | LIVE** nằm **cùng hàng với tên bài kiểm tra, canh phải**.
- Không đặt nút này vào action bar tiêu chuẩn.
- Mở Live thành subpage trong app.
- Nút phải xuất hiện ngay khi vào Detail từ danh sách, **không phụ thuộc F5**.

### Student

- Bài kiểm tra hiển thị list gọn.
- Nhấn bài/Chi tiết → full-width Chi tiết bài, không Drawer.
- Trang Chi tiết hiển thị lịch sử các lượt của chính sinh viên.
- Lượt mở → Tiếp tục; lượt đã nộp → Xem câu hỏi.
- Result/question review mới mở Drawer.
- Khi đang làm, Quay lại về Chi tiết bài kiểm tra.

## 11. Expired unfinished attempt

Không được dùng `submitted_at is null` như điều kiện duy nhất để coi attempt còn mở.

Frontend `student-attempt.js` hiện:

- dùng `get_exam_attempt_payload.remaining_seconds` theo **server time**;
- nếu hết giờ thì gọi `finalize_exam_attempt`;
- clear local workspace liên quan rồi refetch;
- chỉ sau reconcile mới quyết định action Tiếp tục/Bắt đầu lượt mới.

Backend `start_exam_attempt` vẫn tự finalize stale expired attempt trước khi kiểm `max_attempts` và tạo lượt mới.

Không dùng đồng hồ client làm nguồn quyết định quyền attempt.

## 12. Persistence / giữ nguyên màn hình

Shared owners:

```text
js/ui/subpage-state.js
js/ui/form-persistence.js
```

### Browser-tab contract V12.6.36

> **Đổi sang browser tab khác rồi quay lại = đóng băng màn hình đang sống, không render.**

- Nếu DOM còn sống thì không gọi `render()` do `visibilitychange/pageshow/focus`.
- Không được lóe trang mẹ rồi mới restore child page.
- Giữ DOM, scroll, form, workspace, menu/panel đang sống.
- Reload/F5/discard thật sự mới dùng subpage state để restore.

### Sidebar contract

> **Click sidebar = navigation chủ động về trang mẹ.**

Ví dụ: đang Chi tiết bài kiểm tra → click **Đánh giá** → Danh sách bài kiểm tra.

### State manager

State có thể lưu space/view/subjectId/kind/entity/mode/scroll/parent context.

Không tạo một navigation persistence riêng cho từng module nếu đã có thể đăng ký vào `AICLO_SUBPAGE_STATE`.

## 13. AI-CLO | LIVE

### Product contract

Teacher Live xem:

- sinh viên / mã SV;
- attempt number;
- answered count / total;
- current question;
- remaining time;
- last activity;
- fullscreen;
- violations + away time;
- active/warning/disconnected/expired/submitted;
- question-number map và event history.

**Không hiển thị A/B/C/D sinh viên đang chọn trong lúc làm.**

Live có lịch sử Excel phục vụ theo dõi/audit theo dữ liệu backend hiện có.

### Owner

```text
js/assessment/live-monitor.js
js/assessment/attempt-monitor.js
css/exams/live-monitor.css
css/exams/attempt-monitor.css
```

Teacher snapshot refresh khoảng **5 giây**; không dùng server polling dày 500 ms.

### Backend V12.6.34

`assessment-v12.6.34-live-monitoring.sql` tạo:

- `attempt_live_state`;
- `attempt_monitor_events`;
- RPC student update/start/finish monitor event;
- RPC teacher đọc snapshot/history.

Table telemetry không mở direct runtime access; permission qua RPC/backend guard.

`attempt_id` ở hai table dùng `ON DELETE CASCADE` tới `exam_attempts`:

> **Xóa một attempt = xóa Live state + monitor history của attempt đó.**

### iOS V12.6.35

Safari/iOS có thể freeze JS/network rất nhanh khi đi nền. Vì vậy:

- event có `client_event_id` ổn định;
- client có thể giữ incident local;
- quay lại app → sync/bù event + heartbeat;
- backend de-duplicate `(attempt_id, client_event_id)`;
- không tăng violations/away hai lần cho cùng incident.

Migration: `assessment-v12.6.35-ios-live-sync.sql`.

### Fullscreen limitation

- Fullscreen web không phải secure browser/kiosk.
- Không yêu cầu cài trình duyệt khác trong scope hiện tại.
- Không thể khóa OS, thiết bị thứ hai hoặc biết nội dung tab khác.
- Browser không hỗ trợ fullscreen đầy đủ không được tự động coi là vi phạm chỉ vì thiếu capability.

## 14. Question Bank — quyết định mới 08/09

### Provenance

Backend giữ:

```text
origin_type = 'gemini'
```

UI hiển thị:

```text
✦ AI hỗ trợ
```

Danh sách và Chi tiết phải thống nhất. **Không chỉnh Supabase chỉ để đổi nhãn.**

### Tạo một câu / Tải hàng loạt

Trang Thêm câu hỏi có hai mode đối xứng:

```text
Tạo một câu | Tải hàng loạt
```

Excel mẫu:

- `Cau_hoi` — sheet nhập chính;
- `Vi_du` — ví dụ riêng;
- `Chuong_Chu_de`;
- `CLO`;
- `Danh_muc`;
- `Huong_dan`.

Importer ưu tiên `Cau_hoi`.

Cột canonical:

```text
Chương | Chủ đề | CLO | Nội dung | A | B | C | D | Đáp án | Lời giải | Ngân hàng | Trạng thái
```

Không có cột Mã câu. Hệ thống tự sinh mã theo sequence/số tự nhiên và UI đệm 0, ví dụ `000307`.

### Danh sách / hover

- `css/questions/bank.css` sở hữu table/card/layout canonical.
- Cột Mã được giữ gọn, Nội dung ăn phần chiều rộng còn lại.
- Hover desktop hiện câu đầy đủ + A/B/C/D, không đánh dấu đáp án đúng.
- **Owner duy nhất:** `js/questions/hover-preview.js`.
- `js/questions/matrix-panel.js` đã bỏ hover legacy “NỘI DUNG ĐẦY ĐỦ” và không được thêm lại listener đó.
- Mobile không phụ thuộc hover.

## 15. File runtime cần nhớ

### Assessment

- `js/assessment.js`
- `js/assessment/online-lifecycle.js`
- `js/assessment/online-builder.js`
- `js/assessment/student-attempt.js`
- `js/assessment/live-monitor.js`
- `js/assessment/attempt-monitor.js`
- `js/assessment/export-dropdown.js`
- `js/assessment/final-exam.js`
- `js/assessment/results.js`

### Question Bank

- `js/core/question-bank-ownership.js`
- `js/questions/bank.js`
- `js/questions/bank-layout.js`
- `js/questions/origin.js`
- `js/questions/hover-preview.js`
- `js/questions/matrix-panel.js`
- `js/questions/workspace.js`

### Shared UI

- `js/ui/subpage-state.js`
- `js/ui/form-persistence.js`
- `js/ui/shell.js`
- `js/ui/navigation.js`

## 16. Migration quan trọng gần đây

```text
supabase/migrations/v12.5-admin-assessment-delete.sql
supabase/migrations/assessment-v12.6-mixed-fixed-random.sql
supabase/migrations/v12.6.3-question-bank-legacy-subject.sql
supabase/migrations/assessment-v12.6.4-question-bank-scope.sql
supabase/migrations/assessment-v12.6.34-live-monitoring.sql
supabase/migrations/assessment-v12.6.35-ios-live-sync.sql
```

Phải phân biệt migration **đã có source trên GitHub** và migration **đã chạy trên Production Supabase**. Với Live, cần xác nhận production đã chạy V12.6.34 + V12.6.35 trước khi coi backend hoàn tất.

Backend Assessment version function vẫn giữ `12.3.1` nếu các migration additive không đổi version.

## 17. Smoke test ưu tiên tiếp theo

- Teacher: Đánh giá → Chi tiết → LIVE xuất hiện ngay không F5.
- Student desktop: rời tab → warning + teacher Live cập nhật.
- Student iPhone: rời Safari/app → quay lại → incident được sync/de-duplicate.
- Away time dừng sau khi student quay lại.
- Browser tab switch trên subpage → DOM giữ nguyên, không lóe parent.
- Sidebar click từ subpage → vào parent page.
- Xóa attempt → Live state/events cascade theo.
- Question Bank list/detail cùng `AI hỗ trợ`.
- Bulk import template mới đọc đúng `Cau_hoi`.
- Hover Question Bank chỉ một popup câu + A/B/C/D.
- Desktop/mobile không tràn ngang ngoài vùng được thiết kế.
- 4 Assessment modes + shared Question Bank/RLS.
- Excel đáp án+CLO với `/cham-thi-clo`.
- Compile TeX với dữ liệu thật.

## 18. Tài liệu hiện hành

Đọc theo thứ tự:

1. `docs/project/PROJECT-NOTES-AI-CLO.md`
2. `docs/project/ARCHITECTURE-AI-CLO.md`
3. `docs/project/TECHNICAL-AGREEMENTS.md`
4. `docs/project/PROJECT-STATUS-2026-09-08.md`
5. `docs/project/PROJECT-PROGRESS-2026-09-08.md`
6. release note liên quan
7. code mới nhất trên `main`

Nếu code và docs xung đột: xác minh code `main`, xác định tài liệu nào stale rồi cập nhật docs.

---

**Checkpoint ghi nhớ:** V12.6.43 — shared Question Bank ownership, 4 mode Assessment, stale-attempt server reconciliation, browser-tab freeze, teacher **AI-CLO | LIVE** + iOS deferred sync, Question Bank bulk import/provenance và sole-owner hover preview.