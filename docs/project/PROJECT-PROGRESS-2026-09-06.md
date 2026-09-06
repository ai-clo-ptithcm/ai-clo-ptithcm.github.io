# AI-CLO PTITHCM — TIẾN TRÌNH DỰ ÁN 06/09/2026

> Checkpoint cuối ngày 06/09/2026. Trong ngày có hai giai đoạn chính: **ổn định Assessment/persistence** và **hoàn tất refactor CSS ownership theo owner/domain**. Frontend hiện ở V12.4.24.

## 1. Checkpoint hiện tại

- Repository: `ai-clo-ptithcm/ai-clo-ptithcm.github.io`
- Nhánh chính: `main`
- Frontend checkpoint: **V12.4.24**
- Commit checkpoint: `874d1f13c2d1c0e363ceb421a01a83915497a41e`
- GitHub Pages run #688: **success**
- Backend Assessment checkpoint: `assessment_schema_version = 12.3.1`
- Không có migration Supabase hoặc Edge Function mới cho chuỗi frontend/CSS gần nhất.

## 2. Giai đoạn A — ổn định Assessment V12.4.0 → V12.4.3

### 2.1. Cache-busting persistence

Đồng bộ query version của:

```text
js/ui/subpage-state.js
js/ui/form-persistence.js
```

Mục đích: tránh browser dùng persistence JS cũ sau deploy.

### 2.2. Student Attempt full-width

Màn sinh viên làm bài chuyển khỏi Drawer sang `#content`:

- full-width subpage;
- timer;
- câu hiện tại;
- CLO/chương/mục;
- trạng thái autosave;
- jump câu;
- Trước/Sau;
- Nộp bài;
- MathJax render lại sau mỗi câu.

### 2.3. Khôi phục đúng câu đang làm

Local attempt draft lưu thêm:

```text
currentQuestionIndex
```

Khi reload/mở lại:

1. lấy payload chính thức từ Supabase;
2. phủ pending local chưa sync;
3. giữ deadline an toàn;
4. đọc `currentQuestionIndex`;
5. clamp về phạm vi hợp lệ;
6. mở đúng câu đang làm.

### 2.4. Assessment vào shared persistence

`assessment.js` đăng ký các workspace:

- `assessment-detail`
- `assessment-builder`
- `assessment-attempt`
- `assessment-attempt-result`
- `assessment-results`
- `assessment-export`

qua:

```text
window.AICLO_SUBPAGE_STATE.register(...)
```

Builder/Detail giữ đúng `exam_id`; nút quay lại/hủy/đóng Result chủ động xóa state để không restore ngược.

### 2.5. Backend giữ nguyên

Không đổi:

- schema;
- RLS;
- RPC;
- Edge Functions;
- Gemini model/fallback.

Assessment tiếp tục dùng các RPC hiện hành như `start_exam_attempt`, `get_exam_attempt_payload`, `save_exam_progress`, `submit_exam_attempt`, `get_attempt_result`.

## 3. Giai đoạn B — chuẩn hóa CSS ownership V12.4.4 → V12.4.24

Mục tiêu: loại các lớp CSS lịch sử chồng nhau, đưa mỗi nhóm UI về **một owner rõ ràng**, bảo toàn computed behavior desktop/mobile và giảm nguy cơ regression khi chỉnh một module.

### 3.1. Quick Edit / app-window

- Chuẩn hóa AI-CLO app-window.
- `css/ui/app-window.css` chỉ sở hữu window chrome.
- Question Quick Edit chỉ giữ content-specific CSS.
- Ba ngữ cảnh Bank / Duplicate Scan / Assessment cùng chrome nhưng khác semantics lưu.

### 3.2. Question/Assessment ownership split

- Question Bank/list/detail tách khỏi shared Assessment CSS.
- Tạo `css/exams/assessment-shared.css` cho Assessment runtime dùng chung.
- Không để class Question Bank và Assessment dùng lẫn nhau.

### 3.3. Drawer → shell

Drawer được chuyển khỏi `app.css` về `css/ui/shell.css`.

`app.css` không còn Drawer chrome.

### 3.4. Header ownership

Toàn bộ desktop/tablet/mobile header về `shell.css`:

- page heading;
- system-home;
- notification bell;
- subject picker;
- menu button;
- responsive two-row header.

Các fallback header trong `application.css`, `mobile-overrides.css`, `final-layer.css`, `app.css` lần lượt được loại bỏ.

### 3.5. Sidebar ownership

Sidebar được gom dần về `shell.css`:

- course context/system return;
- nav chrome/active state;
- fit/height/scroll;
- footer user/logout;
- mobile/tablet opening behavior.

`sidebar-fit.css` được nhập vào shell rồi xóa.

Desktop geometry 245px vẫn thuộc `application.css`.

### 3.6. Footer ownership

- `.app>main` / `.app .content` layout → `application.css`.
- app footer chrome → `shell.css`.
- selector footer được scope để không ảnh hưởng public footer.

### 3.7. Chương · Chủ đề · CLO

Tạo:

```text
css/courses/structure.css
```

Owner cho:

- structure list/chapter;
- topic list/row/actions;
- safe delete/dependency;
- compatibility structure-v95.

Không còn `structure-*` trong `app.css`/`application.css`.

### 3.8. Auth/Login + application legacy modules

- `login-app.css`: Auth/Login đang chạy + quên mật khẩu/liên hệ Admin.
- `login-fit.css`: viewport fit.
- Auth V8 → `css/legacy/auth-v8.css`, không load runtime.
- Course cards → `css/courses/catalog.css`.
- Question analysis → `css/questions/analysis.css`.
- Member activity → `css/courses/class-list.css`.
- Question V9.5 dead compatibility → `css/legacy/question-v95.css`.

Sau bước này `application.css` gần như chỉ còn layout/sizing.

### 3.9. Notifications / Activity + Question Bank

Notifications/Activity tách:

```text
css/system/notifications.css
css/system/activity.css
```

Xóa stylesheet mixed `activity-notifications.css`.

Question Bank:

- `css/questions/bank.css` trở thành canonical owner;
- hợp nhất V10.5/V10.5.3;
- loại `!important` nội bộ không cần thiết;
- `bank-layout.css` chỉ giữ enhancement/filter drawer/chips.

### 3.10. Public CSS + late compatibility

- `app.html` ngừng load `css/public.css`.
- Public landing tiếp tục dùng `landing-v11.css` + `public-nav-static.css`.
- `v109-notices` về `notifications.css`.
- system bank management V112/V113/V114 → `css/system/question-banks.css`.
- course card metadata về `catalog.css`.
- `final-layer.css` giảm mạnh.

### 3.11. Dashboard / Profile / Members / Assessment

- Dashboard → `css/system/dashboard.css`.
- System profile/security → `css/system/profile.css`.
- Members → `css/courses/class-list.css`.
- Assessment shared/detail/final compatibility → đúng các file `css/exams/`.

`final-layer.css` sau bước này chỉ còn 2 primitive compatibility.

### 3.12. Giải thể final-layer + tách dialogs

- `v109-tabs` / `v109-workspace-head` thực tế chỉ còn Assessment → `assessment-shared.css`.
- `css/ui/final-layer.css` được **xóa hoàn toàn**.
- Tạo `css/ui/dialogs.css` cho native dialog/modal/confirm.
- `app.css` không còn modal/dialog chrome.

### 3.13. App layout + UI primitives

- `css/ui/application.css` trở thành sole owner app/main/content geometry.
- Tạo `css/ui/primitives.css` cho:
  - stats/stat;
  - grid2;
  - panel/panel-head;
  - toolbar;
  - table/table-wrap;
  - badge;
  - row-actions;
  - empty;
  - toast;
  - progress bar.
- `.class-stats` về `class-list.css`.
- `app.css` chỉ còn token + controls + form primitives.

### 3.14. Brand/logo + generic layout system

Checkpoint V12.4.24:

- `css/app-brand.css` là **sole owner** logo/brand của login + sidebar.
- `app.css` và `login-app.css` không còn typography logo.
- `css/ui/layout-system.css` chỉ còn generic:
  - `.aiclo-kpi-grid`
  - `.aiclo-action-grid`
  - `.aiclo-filter-bar`
- Không còn selector `.assessment-detail-*`, `.stats`, `.v109-stats`, `.academic-profile-summary` trong layout-system.
- Module owners tự cung cấp first-paint breakpoint để tránh nhảy layout sau JS tagging.
- `js/ui/layout-system.js` giữ logic tagging nhưng contract được cập nhật V12.4.24.

## 4. CSS ownership hiện tại

### Core/UI

```text
css/app.css
css/app-brand.css
css/ui/application.css
css/ui/primitives.css
css/ui/shell.css
css/ui/dialogs.css
css/ui/app-window.css
css/ui/layout-system.css
css/ui/mobile-overrides.css
```

### Domain

```text
css/courses/
css/questions/
css/exams/
css/system/
css/students/
css/results/
```

`css/legacy/` là archive only.

Quy mô tại V12.4.24:

- khoảng 61 source CSS;
- ~226 KB source chưa nén;
- app link trực tiếp khoảng 47 stylesheet (~164 KB source).

Đánh giá: dung lượng nhỏ; không cần nhập source file. Nếu profiling sau này cho thấy request count là bottleneck, tối ưu bằng build-time bundle.

## 5. Persistence hiện tại — phân vai

### `js/ui/subpage-state.js`

- workspace/subpage;
- system/view/subject context;
- entity/mode;
- scroll;
- registry/restore.

### `js/ui/form-persistence.js`

- form draft;
- input/select/textarea;
- checkbox/radio;
- matrix/form state.

### Attempt local recovery

- pending answers;
- deadline;
- current question index.

Không tạo persistence navigation song song.

## 6. Backup/refactor trong ngày

Nhiều backup branch được tạo trước từng batch. Các mốc đáng chú ý gồm:

- persistence / full-width Attempt / current question restore;
- Assessment shared persistence;
- repo organization;
- CSS ownership cleanup;
- unified quick edit;
- Question/Assessment split;
- Drawer/header/sidebar/footer ownership;
- course structure;
- auth/legacy modules;
- notification/bank cleanup;
- public/final-layer cleanup;
- dashboard/profile/members/assessment;
- final-layer/dialog cleanup;
- layout/primitives;
- brand/layout-system.

Backup gần nhất của đợt code:

```text
backup-before-brand-layout-system-cleanup-20260906
```

## 7. Tổ chức tài liệu

Từ checkpoint tài liệu cuối ngày:

```text
docs/project/
├─ PROJECT-NOTES-AI-CLO.md
├─ ARCHITECTURE-AI-CLO.md
├─ TECHNICAL-AGREEMENTS.md
├─ PROJECT-STATUS-2026-09-06.md
└─ PROJECT-PROGRESS-2026-09-06.md
```

Vai trò:

- `PROJECT-NOTES-AI-CLO.md`: quyết định kỹ thuật/UI/nghiệp vụ ưu tiên.
- `ARCHITECTURE-AI-CLO.md`: bản đồ kiến trúc hiện hành.
- `TECHNICAL-AGREEMENTS.md`: quy tắc kỹ thuật bắt buộc.
- `PROJECT-STATUS-*`: snapshot trạng thái.
- `PROJECT-PROGRESS-*`: lịch sử công việc/checkpoint theo ngày.

`docs/releases/` giữ lịch sử VERSION/upgrade thay vì để README phình theo từng phiên bản.

## 8. Việc tiếp theo

Sau khi Assessment stabilization và CSS architecture đã hoàn tất, **không nên tiếp tục refactor lớn chỉ vì mã có thể sạch hơn**.

Ưu tiên:

1. Smoke desktop/mobile shell.
2. Login/Auth.
3. Question Bank desktop/mobile, filter, card/table, quick edit.
4. Assessment Detail/Builder/Attempt.
5. Reload/discard/tab switch cho mọi subpage đã đăng ký persistence.
6. Teacher/student qua Supabase/RLS.
7. Đổi học phần không lẫn state/AI feedback.
8. Excel đáp án+CLO với `/cham-thi-clo`.
9. Compile TeX với công thức phức tạp.
10. Chỉ sau profiling mới cân nhắc CSS bundle/asset optimization.

## 9. Quy tắc tiếp tục phát triển

- Trước mọi thay đổi AI-CLO: đọc `PROJECT-NOTES-AI-CLO.md` trước.
- Sau đó đọc `ARCHITECTURE-AI-CLO.md` và owner liên quan.
- Backup trước thay đổi có ý nghĩa.
- Làm batch nhỏ, so diff trước khi chốt.
- Không force push.
- Frontend-only phải ghi rõ Supabase không đổi.
- SQL/Edge Function thay đổi phải tách riêng và ghi rõ thao tác deploy.
- AI chỉ gọi khi người dùng chủ động yêu cầu.
- Không để mobile horizontal overflow.
- Không tạo lại late compatibility layer.
- Không đưa CSS domain ngược về global owner.

---

Checkpoint cuối ngày 06/09/2026: **V12.4.24 — Assessment ổn định, CSS ownership refactor lớn hoàn tất; chuyển trọng tâm sang kiểm thử tích hợp thực tế.**
