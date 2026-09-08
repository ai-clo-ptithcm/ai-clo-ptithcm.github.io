# AI-CLO PTITHCM — KIẾN TRÚC HỆ THỐNG

> Tài liệu này mô tả **kiến trúc hiện hành** của AI-CLO PTITHCM ở checkpoint V12.6.43 ngày 08/09/2026. Mục tiêu là xác định đúng owner trước khi sửa, phân biệt rõ frontend/backend và tránh tạo thêm lớp compatibility hoặc behavior trùng nhau.

## 1. Mốc tham chiếu

- Repository: `ai-clo-ptithcm/ai-clo-ptithcm.github.io`
- Nhánh chuẩn: `main`
- Frontend functional checkpoint: **V12.6.43**
- Functional commit trước đợt cập nhật tài liệu: `51549fc6157ff8ab369247def6156dc7341a7119`
- GitHub Pages validation: **run #897 — success**
- Backend Assessment version function: `assessment_schema_version = 12.3.1`
- V12.6.x bổ sung/harden Question Bank dùng chung, mode rút câu hỗn hợp, stale-attempt reconciliation, **AI-CLO | LIVE**, iOS event sync và browser-tab persistence.
- Các migration Live V12.6.34/V12.6.35 là additive; **không đổi `assessment_schema_version`**.

## 2. Sơ đồ tổng thể

```text
Người dùng
   │
   ├─ Trang công khai
   │   ├─ index.html
   │   ├─ huong-dan.html
   │   └─ /cham-thi-clo/
   │
   └─ Ứng dụng đăng nhập
       └─ app.html
           ├─ CSS theo owner/domain
           ├─ JS core + UI + domain modules
           ├─ Assessment single-owner runtime
           ├─ Shared persistence
           ├─ Student attempt monitor
           └─ Teacher AI-CLO | LIVE
                    │
                    ▼
                 Supabase
           ├─ PostgreSQL + RLS
           ├─ Auth / Storage
           ├─ Assessment RPC
           ├─ Attempt autosave
           ├─ Live state + monitor events
           └─ Edge Functions self-contained
                    │
                    └─ AI/Gemini theo thao tác chủ động
```

Nguyên tắc nguồn dữ liệu:

- **Supabase là nguồn dữ liệu nghiệp vụ chính thức.**
- `sessionStorage` / `localStorage` chỉ giữ UI state, draft, incident queue và recovery cục bộ.
- Frontend không bypass RLS và không chứa service-role key.
- Telemetry giám sát là **monitoring signal**, không phải bằng chứng secure-browser/kiosk tuyệt đối.

## 3. Ownership dữ liệu: Question Bank và Subject

Mốc V12.6 chốt lại ranh giới ownership:

### Thuộc Question Bank (`question_bank_id`)

- Chapters
- Topics
- CLOs
- Questions

### Thuộc Subject/Học phần (`subject_id`)

- Exams
- cấu hình phát hành bài;
- Exam attempts;
- Student answers / draft answers;
- Results / CLO scores;
- Final exam packages.

Nhiều học phần/lớp có thể dùng chung một `question_bank_id`. Vì vậy code mới **không được giả định** `questions.subject_id = exams.subject_id`.

`questions.subject_id` vẫn tồn tại vì compatibility/FK legacy. Bridge frontend:

```text
js/core/question-bank-ownership.js
```

Các migration backend liên quan:

```text
supabase/migrations/v12.6.3-question-bank-legacy-subject.sql
supabase/migrations/assessment-v12.6.4-question-bank-scope.sql
```

## 4. Entrypoint và các không gian UI

### Public

- `index.html`: landing page.
- `huong-dan.html`: hướng dẫn sử dụng.
- `cham-thi-clo/`: công cụ Chấm thi CLO công khai, không yêu cầu đăng nhập và có CSS/JS riêng.

Public dùng stylesheet riêng như `css/landing-v11.css`, `css/public-nav-static.css`. `app.html` **không load `css/public.css`**.

### App

- `app.html`: shell ứng dụng có Auth, sidebar, header, content, footer, Drawer và modal/dialog.
- `#content`: host chính cho dashboard, học phần, Question Bank, Assessment, kết quả, profile và workspace full-width.
- Drawer dùng cho xem nhanh/chi tiết phù hợp.
- Sửa nhanh dùng AI-CLO app-window thống nhất.
- Sửa cấu trúc lớn/builder dùng full-width subpage/workspace.

## 5. Kiến trúc JavaScript

Cấu trúc cấp cao:

```text
js/
├─ app.js
├─ assessment.js
├─ assessment/
├─ core/
├─ ui/
├─ system/
├─ courses/
├─ questions/
├─ exams/
├─ students/
├─ results/
└─ ai/ + ai-chat.js
```

Quy tắc kiến trúc:

- Chia module theo domain/chức năng.
- **Một behavior quan trọng = một runtime owner.**
- Child module nhận dependency qua context/API thay vì global ngầm khi có thể.
- Không tạo late monkey-patch/wrapper nếu có thể sửa đúng owner.
- Không gắn hai listener/module cùng sở hữu một interaction.

## 6. Assessment runtime

Cấu trúc hiện hành:

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

Module hỗ trợ:

```text
js/assessment/attempt-monitor.js
js/assessment/export-dropdown.js
js/exams/online-export.js
```

Ownership:

- `assessment.js` — owner/router/lifecycle public duy nhất; child module đăng ký factory qua `window.AICLO_ASSESSMENT_MODULES`.
- `online-lifecycle.js` — lifecycle bài online phía teacher/Admin: detail, trạng thái, attempt list, preview/export, delete Admin.
- `online-builder.js` — builder online.
- `student-attempt.js` — danh sách bài sinh viên → Chi tiết bài → lịch sử lượt → workspace làm bài → result Drawer.
- `live-monitor.js` — teacher **AI-CLO | LIVE** subpage, snapshot, bảng Live, attempt Live Drawer, history Excel.
- `attempt-monitor.js` — tín hiệu giám sát phía sinh viên: tab hidden, window blur, fullscreen exit, app navigation; local warning + backend sync.
- `export-dropdown.js` — dismissal/accessibility của menu Tải kết quả Excel, không sở hữu logic tính điểm.

Không tạo owner Assessment thứ hai và không thêm `MutationObserver` vào child module để thay lifecycle owner hiện có.

## 7. Assessment modes

Online Assessment hiện có 4 mode:

1. `common_fixed` — đề chung cố định.
2. `student_fixed` — đề riêng theo sinh viên.
3. `attempt_random` — rút lại mỗi lượt làm.
4. `mixed_fixed_random` — **Cố định và rút ngẫu nhiên**.

Contract `mixed_fixed_random`:

- phải chọn ít nhất một câu cố định;
- câu cố định tiêu thụ quota đúng cell ma trận;
- sau đó rút phần còn lại theo ma trận;
- Builder chỉ hiện câu cố định + thống kê phần random, không liệt kê câu random cụ thể.

Backend migration:

```text
supabase/migrations/assessment-v12.6-mixed-fixed-random.sql
```

## 8. Student Attempt, autosave và hết giờ

`js/assessment/student-attempt.js` là owner luồng sinh viên.

Nguồn dữ liệu:

- `save_exam_progress` autosave phương án vào `attempt_draft_answers`;
- `get_exam_attempt_payload` trả snapshot câu và `remaining_seconds` theo server;
- `finalize_exam_attempt` chuyển draft answer thành answer chính thức và chấm điểm;
- local recovery chỉ giữ pending chưa sync, deadline an toàn và `currentQuestionIndex`.

### Expired unfinished attempt

Không được coi mọi row `submitted_at is null` là attempt mở vô thời hạn.

Frontend hiện reconcile bằng server:

1. đọc `get_exam_attempt_payload`;
2. nếu server trả `remaining_seconds = 0`, finalize attempt;
3. xóa workspace recovery liên quan;
4. refresh attempt list;
5. chỉ sau đó quyết định có được tạo lượt mới theo `max_attempts`.

Backend `start_exam_attempt` vẫn là guard cuối: tự finalize stale expired attempt rồi mới kiểm `max_attempts` và tạo attempt mới.

## 9. Persistence và browser lifecycle

Hai lớp dùng chung:

```text
js/ui/subpage-state.js
js/ui/form-persistence.js
```

### `subpage-state.js`

Nhớ:

- system/course/view;
- workspace/subpage kind;
- entity đang mở;
- mode/context;
- scroll position;
- parent relationship khi cần;
- restore sau reload/discard thật sự.

Các kind Assessment quan trọng:

- `assessment-detail`;
- `assessment-student-detail`;
- `assessment-attempt`;
- `assessment-attempt-result`;
- `assessment-builder`;
- `assessment-export`;
- `assessment-results`;
- Live subpage theo context exam hiện hành.

### Browser-tab freeze contract

Đây là thay đổi quan trọng V12.6.36:

> **Chuyển sang browser tab khác rồi quay lại không phải navigation. Nếu DOM hiện tại còn sống thì không render lại.**

Do đó:

- `visibilitychange`, `pageshow`, `focus` không được dựng lại view còn sống;
- không render trang mẹ trước rồi mới restore trang con;
- DOM, scroll, form, workspace, menu/panel đang sống được giữ nguyên nếu browser không reload/discard;
- F5/reload/discard thật sự mới dùng `subpage-state.js` để restore.

### Sidebar navigation contract

> **Click sidebar là navigation chủ động.**

Ví dụ đang ở Chi tiết bài kiểm tra rồi bấm **Đánh giá** → mở **Danh sách bài kiểm tra**, không restore child detail cũ.

### `form-persistence.js`

Nhớ input/textarea/select, checkbox/radio, form draft và matrix/form state. Không thay thế dữ liệu chính thức ở Supabase.

## 10. AI-CLO | LIVE architecture

LIVE là **subpage trong `app.html`**, không phải HTML riêng.

Entry point phía teacher/Admin:

- trang Chi tiết bài kiểm tra;
- nút nhãn **AI-CLO | LIVE**;
- cùng hàng với tên bài kiểm tra, canh phải;
- phải xuất hiện ngay khi mở Detail từ danh sách, không phụ thuộc reload/F5.

### Data flow

```text
Student Attempt
    │
    ├─ save_exam_progress ─────────► attempt_draft_answers
    │
    └─ attempt-monitor.js
          │ heartbeat / incident
          ▼
    RPC Live monitoring
          │
          ├─ attempt_live_state
          └─ attempt_monitor_events
                    │
                    ▼
       get_exam_live_snapshot / history RPC
                    │
                    ▼
          live-monitor.js (Teacher)
```

Teacher Live hiển thị:

- student/attempt;
- answered count / total;
- current question number;
- remaining time server;
- last heartbeat/activity;
- fullscreen state;
- away count + total away time;
- active/warning/disconnected/expired/submitted;
- answered-number map trong Drawer.

Teacher **không nhận selected option A/B/C/D** trong Live.

### Refresh / presence

- teacher snapshot refresh khoảng **5 giây/lần**;
- disconnect threshold hiện khoảng 20 giây;
- strong warning ở mức ≥3 violations hoặc away ≥15 giây theo UI hiện hành;
- không dùng 500 ms server polling.

### Backend Live V12.6.34

Migration:

```text
supabase/migrations/assessment-v12.6.34-live-monitoring.sql
```

Tạo:

- `attempt_live_state` — one-row snapshot/presence mỗi attempt;
- `attempt_monitor_events` — lịch sử incident;
- RPC student update/start/finish event;
- RPC teacher đọc snapshot/history.

Table telemetry bị revoke direct runtime access; permission đi qua RPC/backend guard.

### iOS deferred sync V12.6.35

Migration:

```text
supabase/migrations/assessment-v12.6.35-ios-live-sync.sql
```

Safari/iOS có thể freeze JS/network ngay khi app/tab đi nền. Vì vậy:

- incident có `client_event_id` ổn định;
- frontend giữ incident cục bộ nếu chưa gửi được;
- khi quay lại sẽ sync/bù event + heartbeat;
- backend unique/de-duplicate theo `(attempt_id, client_event_id)`;
- tránh tăng violations/total-away hai lần.

### Cascade policy

`attempt_live_state.attempt_id` và `attempt_monitor_events.attempt_id` đều FK tới `exam_attempts(id) ON DELETE CASCADE`.

Contract hiện tại:

> **Xóa một lượt làm = xóa cả Live state và monitor history của lượt đó.**

## 11. Fullscreen / monitoring limitation

Fullscreen web **không phải secure browser**.

- Fullscreen API cần user gesture và phụ thuộc browser/OS.
- Android/desktop thường hỗ trợ tốt hơn; iOS có giới hạn capability.
- Không ép người dùng cài trình duyệt khác trong scope hiện tại.
- Hệ thống có thể phát hiện một số tín hiệu như tab hidden, window blur, fullscreen exit, app navigation nhưng không thể khóa OS, thiết bị thứ hai hoặc biết nội dung tab khác.
- Browser không hỗ trợ fullscreen đầy đủ không được mặc định coi là vi phạm chỉ vì thiếu capability.

## 12. Question Bank runtime

Hai nhóm chính:

1. **Luyện tập – kiểm tra**.
2. **Đề thi – bảo mật**.

Bài online không được dùng câu chỉ thuộc secure bank. Final Exam dùng nguồn bảo mật theo workflow đã chốt.

### Owner JS quan trọng

```text
js/core/question-bank-ownership.js
js/questions/bank.js
js/questions/bank-layout.js
js/questions/matrix-panel.js
js/questions/origin.js
js/questions/hover-preview.js
js/questions/workspace.js
js/questions/quick-edit.js
```

### Provenance

Backend giữ metadata kỹ thuật như:

```text
origin_type = 'gemini'
```

UI user-facing phải hiển thị:

```text
✦ AI hỗ trợ
```

Không migration database chỉ để đổi wording. Danh sách và Chi tiết phải nhất quán.

### Hover preview — sole owner

Sau V12.6.43:

```text
js/questions/hover-preview.js
```

là **owner duy nhất** của hover câu hỏi trong danh sách.

- desktop hover nội dung → toàn bộ câu + A/B/C/D;
- không đánh dấu đáp án đúng;
- option lazy-load/cache theo câu;
- mobile/coarse pointer không phụ thuộc hover;
- `matrix-panel.js` không còn sở hữu popup legacy “NỘI DUNG ĐẦY ĐỦ” và không được thêm lại listener đó.

### Bulk import / Excel mẫu

Trang Add Question dùng hai mode cùng workspace:

```text
Tạo một câu | Tải hàng loạt
```

Workbook mẫu:

```text
Cau_hoi
Vi_du
Chuong_Chu_de
CLO
Danh_muc
Huong_dan
```

Importer ưu tiên `Cau_hoi`; ví dụ nằm riêng ở `Vi_du` để tránh import nhầm.

Cột canonical:

```text
Chương | Chủ đề | CLO | Nội dung | A | B | C | D | Đáp án | Lời giải | Ngân hàng | Trạng thái
```

Không có cột Mã câu. Hệ thống tự sinh sequence; UI đệm 0 khi hiển thị, ví dụ `000307`.

## 13. Kiến trúc CSS

Đợt V12.4.x đã chuyển sang owner-based CSS; V12.6.x tiếp tục tuân thủ.

### Core UI owners

| File | Owner |
|---|---|
| `css/app.css` | token, typography/control base, field/input/button, form primitives |
| `css/app-brand.css` | sole owner logo/brand login + sidebar |
| `css/ui/application.css` | app geometry/layout, content sizing, boot guard |
| `css/ui/primitives.css` | panel/table/stats/toolbar/badge/toast/progress |
| `css/ui/shell.css` | sidebar/header/footer shell chrome + Drawer |
| `css/ui/dialogs.css` | native dialog/modal/confirm chrome |
| `css/ui/app-window.css` | AI-CLO app-window chrome/drag/resize/mobile |
| `css/ui/layout-system.css` | generic-only KPI/action/filter layout |
| `css/ui/mobile-overrides.css` | shared mobile guards/fallback |

Không tạo lại `css/ui/final-layer.css`; file này đã bị loại khỏi runtime.

### Domain owners

#### Courses

```text
css/courses/
├─ catalog.css
├─ class-list.css
└─ structure.css
```

#### Questions

```text
css/questions/
├─ bank.css
├─ bank-layout.css
├─ analysis.css
├─ tools.css
├─ workspace.css
├─ create-form-layout.css
├─ duplicate-scan.css
├─ matrix-panel.css
├─ pagination.css
└─ quick-edit.css
```

- `bank.css` — canonical tab/scope/table/card mobile, desktop table geometry và hover chrome mới.
- `bank-layout.css` — enhancement toolbar/filter drawer/chips/selection; không sở hữu base table.

#### Assessment / Exams

Các owner nổi bật:

- `assessment-shared.css` — shared Assessment controls/workspace/matrix;
- `student-attempt.css` — student list/detail/history/attempt workspace;
- `detail-enhancements.css` — teacher/Admin Detail và attempt table;
- `live-monitor.css` — **teacher AI-CLO | LIVE** table/detail/responsive;
- `attempt-monitor.css` — student monitoring panel/warning/fullscreen controls;
- `unified-builder.css`;
- `final-workflow.css`;
- `assessment-window.css`;
- `assessment-form-compact.css`;
- `online-export.css`;
- `create-wizard.css`;
- `final-matrix-compact.css`.

#### System / Student / Result

- `css/system/`: dashboard, notifications, activity, profile, system question banks.
- `css/students/profile.css`: hồ sơ sinh viên.
- `css/results/ai-state.css`: result-specific AI state.

## 14. UI interaction contract

- **Chi tiết/xem nhanh** → Drawer/panel khi phù hợp.
- **Sửa nhanh** → AI-CLO app-window.
- **Sửa cấu trúc lớn/full edit** → full-width subpage/workspace.
- Boolean setting → toggle switch khi phù hợp.
- Mobile không được tràn ngang ở shell/form chính.
- Bảng rộng phải scroll **bên trong vùng bảng** hoặc chuyển card mode; không được kéo toàn app viewport rộng theo table.
- Dropdown/popover phải có outside-click/Esc dismissal khi phù hợp.
- Student ở Bài kiểm tra: list gọn → full-width Detail → full-width Attempt; result question view mới dùng Drawer.
- Browser tab switch không phải navigation; sidebar click mới là navigation.

## 15. Assessment product contract

Framework chung:

1. Mục 1 — Thông tin.
2. Mục 2 — Cấu trúc/Ma trận.
3. Mục 3 — Danh sách câu đã rút.
4. Mục 4 — Xuất với loại bài phù hợp.

Nguyên tắc dữ liệu:

- Rút câu tạo/cập nhật draft chính thức.
- Không tạo draft có `total_questions = 0`.
- `max_attempts` được phép chỉnh sau khi có lượt làm; giảm giới hạn không xóa/sửa lịch sử cũ.
- Student Attempt chạy full-width trong `#content`.
- Kết quả/AI scope đúng học phần/bài/sinh viên.
- Admin xóa bài dùng `admin_delete_exam`.
- Admin xóa lượt dùng `admin_delete_attempt`; migration V12.5 harden đánh số lại lịch sử sau xóa.
- Xóa attempt kéo theo Live state/events của attempt đó theo cascade hiện hành.

## 16. Supabase architecture

```text
supabase/
├─ README.md
├─ migrations/
├─ schema/
├─ policies/
├─ functions/
└─ docs/
```

### Edge Functions

Quy tắc bắt buộc:

- self-contained;
- không phụ thuộc `_shared` giữa các Function;
- có thể copy/deploy từng Function độc lập từ Supabase Dashboard;
- sửa source trên GitHub **không đồng nghĩa Function trên Supabase đã redeploy**;
- khi thay Function phải nói rõ Function nào cần redeploy.

### Database / RLS

- Schema/RPC/RLS thay đổi phải có migration rõ ràng.
- Không sửa schema ngầm từ frontend.
- Không bypass RLS bằng frontend.
- Dữ liệu nhạy cảm kiểm quyền ở backend.
- `security definer` RPC phải tự kiểm caller.
- Telemetry Live không mở table trực tiếp cho authenticated runtime.

Các migration Assessment/Question Bank quan trọng gần đây:

```text
supabase/migrations/v12.5-admin-assessment-delete.sql
supabase/migrations/assessment-v12.6-mixed-fixed-random.sql
supabase/migrations/v12.6.3-question-bank-legacy-subject.sql
supabase/migrations/assessment-v12.6.4-question-bank-scope.sql
supabase/migrations/assessment-v12.6.34-live-monitoring.sql
supabase/migrations/assessment-v12.6.35-ios-live-sync.sql
```

Cần phân biệt **source migration có trên GitHub** với **migration đã thật sự chạy trên Production Supabase**. Với Live, phải xác nhận V12.6.34 + V12.6.35 đã được chạy trước khi coi backend production-ready.

## 17. AI / Gemini

- AI chỉ gọi khi người dùng chủ động bấm, trừ nơi đã chốt khác.
- Không gọi model tự động chỉ vì render trang.
- Khi sửa model/quota/fallback phải đọc Edge Function hiện tại trên `main`.
- Mỗi Function dùng AI giữ logic deploy độc lập/self-contained.
- User-facing wording ưu tiên **AI**; backend/provider metadata có thể giữ `gemini` khi cần tương thích.

## 18. Hiệu năng

Đã áp dụng:

- lazy-load Office/Math libs ở nơi phù hợp;
- query/cache hợp lý;
- giảm reload toàn view;
- browser-tab freeze để không dựng lại DOM đang sống;
- teacher Live refresh 5 giây thay vì polling dày;
- layout-system generic để tránh module override chồng nhau.

Không nên tối ưu bằng cách:

- nhập tất cả source CSS/JS thành file khổng lồ;
- thêm observer toàn document không cần thiết;
- tạo polling dày khi event-driven/heartbeat thưa hơn đủ dùng;
- render lại view chỉ vì browser visibility thay đổi.

Nếu cần giảm số CSS request, ưu tiên **build-time bundle** trong khi giữ source domain files.

## 19. Tài liệu và thứ tự đọc trước khi sửa

Khi quay lại dự án:

1. `docs/project/PROJECT-NOTES-AI-CLO.md` — quyết định kỹ thuật/UI ưu tiên.
2. `docs/project/ARCHITECTURE-AI-CLO.md` — bản đồ kiến trúc hiện hành.
3. `docs/project/TECHNICAL-AGREEMENTS.md` — quy tắc kỹ thuật bắt buộc.
4. `docs/project/PROJECT-STATUS-2026-09-08.md` — snapshot trạng thái mới nhất.
5. `docs/project/PROJECT-PROGRESS-2026-09-08.md` — tiến trình chi tiết ngày 08/09.
6. Release notes liên quan nếu thay đổi area cũ.
7. Mã mới nhất trên `main`.

Nếu tài liệu và code xung đột, xác minh code `main`, xác định tài liệu lỗi thời rồi cập nhật lại tài liệu.

## 20. Quy tắc thay đổi repo

- Khi chỉ trao đổi/góp ý/thiết kế: không tự ý sửa repo.
- Trước thay đổi runtime/backend có ý nghĩa: tạo backup branch.
- Làm trên work branch khi thay đổi phức tạp/rủi ro.
- So diff trước khi đưa `main`.
- Không force push nếu không có lý do đặc biệt.
- Refactor phải bảo toàn behavior trước khi tối ưu thêm.
- Frontend-only → nói rõ **Supabase không thay đổi**.
- SQL/Edge Function → tách riêng và ghi rõ thao tác Supabase cần thực hiện.
- File probe/noop/sentinel tạo nhầm phải xóa ngay, không để rác trong tree.

---

**Checkpoint kiến trúc:** V12.6.43 — Question Bank dùng chung theo `question_bank_id`; Assessment 4 mode; stale expired attempt dùng server-time reconciliation; browser tab switch giữ nguyên DOM; teacher có **AI-CLO | LIVE** với backend telemetry + iOS deferred sync; Question Bank hover còn một owner duy nhất. Functional commit `51549fc6157ff8ab369247def6156dc7341a7119` đã được GitHub Pages run **#897** deploy thành công.