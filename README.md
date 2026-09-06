# AI-CLO PTITHCM — V12.4.24

**HỆ THỐNG ỨNG DỤNG TRÍ TUỆ NHÂN TẠO HỖ TRỢ ĐÁNH GIÁ SINH VIÊN THEO CHUẨN ĐẦU RA HỌC PHẦN**

AI-CLO PTITHCM là hệ thống web hỗ trợ quản lý học phần, ngân hàng câu hỏi, xây dựng bài đánh giá theo CLO, làm bài trực tuyến, phân tích kết quả và các tác vụ AI theo yêu cầu người dùng.

## Checkpoint hiện tại

- Frontend checkpoint: **V12.4.24**
- Nhánh chuẩn: `main`
- Commit checkpoint: `874d1f13c2d1c0e363ceb421a01a83915497a41e`
- GitHub Pages run #688: **success**
- Backend Assessment checkpoint: `assessment_schema_version = 12.3.1`
- Đợt V12.4.x gần nhất tập trung ổn định Assessment, persistence và tái cấu trúc CSS theo owner/domain.
- **Không có migration Supabase hoặc redeploy Edge Function mới cho đợt CSS/documentation V12.4.4 → V12.4.24.**

## Kiến trúc chính

Frontend được phục vụ qua GitHub Pages, backend dùng Supabase:

```text
Public pages / app.html
        │
        ├─ CSS theo owner/domain
        ├─ JS core/UI/domain modules
        ├─ Assessment single-owner runtime
        └─ Shared persistence
                 │
                 ▼
              Supabase
        ├─ PostgreSQL + RLS
        ├─ Auth / Storage / RPC
        └─ Edge Functions self-contained
                 │
                 └─ Gemini/AI theo thao tác chủ động
```

Tài liệu kiến trúc đầy đủ:

- [`docs/project/ARCHITECTURE-AI-CLO.md`](docs/project/ARCHITECTURE-AI-CLO.md)

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
   └─ results.js
```

Nguyên tắc:

- `assessment.js` là owner/router/lifecycle public duy nhất.
- Child modules đăng ký factory qua `window.AICLO_ASSESSMENT_MODULES`.
- Student Attempt chạy full-width trong `#content`.
- Supabase autosave là nguồn chính thức; local draft chỉ dùng recovery.
- Shared subpage persistence quản lý Detail / Builder / Attempt / Result / Export.

## Persistence

Hai lớp dùng chung:

```text
js/ui/subpage-state.js
js/ui/form-persistence.js
```

- `subpage-state.js`: workspace/subpage, entity, context, scroll, restore.
- `form-persistence.js`: form draft, input/select/textarea, matrix state.
- Student Attempt có local recovery riêng cho pending answer, deadline và `currentQuestionIndex`, nhưng không tạo navigation persistence song song.

## CSS V12.4.24

Đợt refactor lớn ngày 06/09/2026 đã chuyển CSS sang mô hình **owner-based**:

- `css/app.css` — base controls/form primitives.
- `css/app-brand.css` — sole owner logo/brand.
- `css/ui/application.css` — app geometry/layout.
- `css/ui/primitives.css` — panel/table/stats/toolbar/badge/toast…
- `css/ui/shell.css` — sidebar/header/footer/Drawer chrome.
- `css/ui/dialogs.css` — dialog/modal/confirm.
- `css/ui/app-window.css` — AI-CLO app-window.
- `css/ui/layout-system.css` — generic KPI/action/filter layout classes only.
- CSS nghiệp vụ nằm trong `css/courses/`, `css/questions/`, `css/exams/`, `css/system/`, `css/students/`, `css/results/`.

`css/ui/final-layer.css` đã được loại khỏi runtime và xóa. `css/public.css` không được load trong `app.html`.

Quy mô hiện tại khoảng 61 source CSS (~226 KB chưa nén); `app.html` link trực tiếp khoảng 47 stylesheet (~164 KB source). Dung lượng không lớn; nếu sau này cần giảm request thì ưu tiên bundle ở build/deploy, **không nhập thủ công source CSS lại thành file lớn**.

## Question Bank

Tách rõ hai nguồn:

1. **Luyện tập – kiểm tra**.
2. **Đề thi – bảo mật**.

Bài kiểm tra online không được lấy câu chỉ thuộc ngân hàng bảo mật. Thi cuối kỳ dùng workflow bảo mật theo quy tắc đã chốt.

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

## Công cụ Chấm thi CLO

`/cham-thi-clo/` là công cụ public độc lập, không yêu cầu đăng nhập. Luồng này không được trộn với Assessment online của AI-CLO.

## Tài liệu cần đọc trước khi sửa dự án

Theo thứ tự:

1. [`docs/project/PROJECT-NOTES-AI-CLO.md`](docs/project/PROJECT-NOTES-AI-CLO.md) — quyết định kỹ thuật/UI ưu tiên.
2. [`docs/project/ARCHITECTURE-AI-CLO.md`](docs/project/ARCHITECTURE-AI-CLO.md) — bản đồ kiến trúc hiện hành.
3. [`docs/project/TECHNICAL-AGREEMENTS.md`](docs/project/TECHNICAL-AGREEMENTS.md) — quy tắc kỹ thuật bắt buộc.
4. [`docs/project/PROJECT-STATUS-2026-09-06.md`](docs/project/PROJECT-STATUS-2026-09-06.md) — trạng thái checkpoint.
5. [`docs/project/PROJECT-PROGRESS-2026-09-06.md`](docs/project/PROJECT-PROGRESS-2026-09-06.md) — tiến trình ngày 06/09.
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

Đợt refactor CSS ownership lớn đã hoàn tất. Ưu tiên tiếp theo là **smoke test giao diện và nghiệp vụ thực tế**, đặc biệt:

- desktop/mobile shell;
- Question Bank;
- Assessment Detail/Builder/Attempt;
- reload/tab-discard/persistence;
- teacher/student qua Supabase/RLS;
- đổi học phần không lẫn state;
- Excel đáp án+CLO với `/cham-thi-clo`;
- compile TeX với công thức thực tế.

Không nên tiếp tục chia/tách CSS chỉ để làm sạch thêm nếu chưa có lỗi hoặc điểm nghẽn cụ thể.
