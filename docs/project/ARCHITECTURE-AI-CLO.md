# AI-CLO PTITHCM — KIẾN TRÚC HỆ THỐNG

> Tài liệu này mô tả **kiến trúc hiện hành** của AI-CLO PTITHCM sau checkpoint frontend V12.4.24 ngày 06/09/2026. Đây là bản đồ để đọc dự án, tìm đúng owner trước khi sửa và tránh tạo thêm lớp compatibility chồng chéo.

## 1. Mốc tham chiếu

- Repository: `ai-clo-ptithcm/ai-clo-ptithcm.github.io`
- Nhánh chuẩn: `main`
- Frontend checkpoint: **V12.4.24**
- Commit checkpoint: `874d1f13c2d1c0e363ceb421a01a83915497a41e`
- GitHub Pages run: **#688 — success**
- Backend Assessment checkpoint: `assessment_schema_version = 12.3.1`
- V12.4.0 → V12.4.24 không yêu cầu migration Supabase mới cho chuỗi refactor frontend/CSS gần nhất.

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
           ├─ Supabase JS client
           └─ Math/Office libs lazy-load khi cần

Frontend ───────────────► Supabase
                         ├─ PostgreSQL
                         ├─ Auth
                         ├─ Storage
                         ├─ RLS / RPC
                         └─ Edge Functions self-contained
                                  │
                                  └─ Gemini / AI theo thao tác chủ động
```

Nguyên tắc nguồn dữ liệu:

- **Supabase là nguồn dữ liệu nghiệp vụ chính thức.**
- `sessionStorage` / `localStorage` chỉ giữ UI state, draft và recovery.
- Frontend không bypass RLS và không chứa service-role key.

## 3. Entrypoint và các không gian UI

### Public

- `index.html`: landing page.
- `huong-dan.html`: hướng dẫn sử dụng.
- `cham-thi-clo/`: công cụ Chấm thi CLO công khai, không yêu cầu đăng nhập và có CSS/JS riêng.

Public hiện dùng stylesheet riêng như:

- `css/landing-v11.css`
- `css/public-nav-static.css`

`app.html` **không load `css/public.css`**.

### App

- `app.html`: shell ứng dụng có Auth, sidebar, header, content, footer, Drawer và modal/dialog.
- `#content`: host chính cho dashboard, học phần, ngân hàng câu hỏi, Assessment, kết quả, profile và workspace full-width.
- Drawer chỉ dùng cho xem nhanh/chi tiết phù hợp; không dùng cho chỉnh cấu trúc lớn.
- Quick Edit dùng AI-CLO app-window thống nhất.

## 4. Kiến trúc JavaScript

Cấu trúc cấp cao:

```text
js/
├─ app.js                    # app/bootstrap/legacy core orchestration
├─ assessment.js             # owner runtime Assessment duy nhất
├─ assessment/               # child modules Assessment
├─ core/                     # performance, loader, Office, cache...
├─ ui/                       # shell, navigation, persistence, app-window...
├─ system/                   # users, notifications, profile, activity...
├─ courses/                  # course/member/data/overview...
├─ questions/                # question bank/workspace/tools...
├─ exams/                    # export/final/detail/unified builder helpers
├─ students/                 # student/profile flows
├─ results/                  # result helpers
└─ ai/ + ai-chat.js          # AI UI/domain helpers
```

Quy tắc:

- Chia module theo domain/chức năng.
- Một domain quan trọng chỉ có **một owner runtime rõ ràng**.
- Child module nhận dependency qua context/API thay vì global ngầm khi có thể.
- Không tạo late monkey-patch chỉ để sửa một module đã có owner.

### Assessment

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

- `assessment.js` là owner/router/lifecycle public duy nhất.
- Child module đăng ký factory qua `window.AICLO_ASSESSMENT_MODULES`.
- Không tạo owner Assessment thứ hai.
- Không thêm `MutationObserver` vào child module Assessment.
- Utility xuất đề online ở `js/exams/online-export.js`.

## 5. Persistence và recovery

Hai lớp persistence dùng chung:

```text
js/ui/subpage-state.js
js/ui/form-persistence.js
```

### `subpage-state.js`

Nhớ:

- system/course/view;
- workspace/subpage;
- entity đang mở;
- mode;
- scroll position;
- restore sau reload/discard/browser lifecycle.

### `form-persistence.js`

Nhớ:

- input / textarea / select;
- checkbox / radio;
- form draft;
- matrix/form state.

### Student Attempt recovery

`js/assessment/student-attempt.js` có local recovery chuyên biệt cho:

- pending answer chưa sync;
- deadline local an toàn;
- `currentQuestionIndex`.

Local recovery này **không phải navigation persistence thứ ba**. Workspace Attempt vẫn do `AICLO_SUBPAGE_STATE` quản lý.

## 6. Kiến trúc CSS V12.4.24

Đợt refactor V12.4.x đã chuyển từ nhiều lớp override lịch sử sang **owner-based CSS**.

### 6.1. Core UI owners

| File | Owner |
|---|---|
| `css/app.css` | token màu, typography/control base, field/input/button, form primitives |
| `css/app-brand.css` | **sole owner** logo/brand của login và app sidebar |
| `css/ui/application.css` | app geometry/layout: `.app`, main, content, desktop shell geometry, boot guard |
| `css/ui/primitives.css` | stats, panel, toolbar, table, badge, empty, toast, progress bar |
| `css/ui/shell.css` | sidebar/header/footer shell chrome + Drawer |
| `css/ui/dialogs.css` | native dialog/modal/confirm chrome |
| `css/ui/app-window.css` | AI-CLO app-window chrome, drag/resize/mobile |
| `css/ui/layout-system.css` | **generic-only** `.aiclo-kpi-grid`, `.aiclo-action-grid`, `.aiclo-filter-bar` |
| `css/ui/mobile-overrides.css` | guards/fallback mobile còn cần dùng chung |

Không tạo lại `css/ui/final-layer.css`; file này đã được loại khỏi runtime và xóa.

### 6.2. Domain owners

#### Courses

```text
css/courses/
├─ catalog.css      # danh sách học phần dạng card
├─ class-list.css   # thành viên/lớp/trạng thái
└─ structure.css    # Chương · Chủ đề · CLO
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

`bank.css` là owner canonical cho tab/scope/table/card mobile của Ngân hàng câu hỏi. Không thêm lại tầng V10.5/V10.5.3 override hoặc `!important` để vá cùng một UI.

#### Assessment / Exams

Các file đang chạy được tách theo chức năng, nổi bật:

- `assessment-shared.css`
- `unified-builder.css`
- `detail-enhancements.css`
- `student-attempt.css`
- `final-workflow.css`
- `assessment-window.css`
- `assessment-form-compact.css`
- `online-export.css`
- `create-wizard.css`
- `final-matrix-compact.css`

Các CSS Assessment thế hệ cũ còn trong repo nhưng không được mặc định xem là runtime owner nếu `app.html` không load chúng.

#### System

```text
css/system/
├─ dashboard.css
├─ notifications.css
├─ activity.css
├─ profile.css
└─ question-banks.css
```

#### Student / Result

- `css/students/profile.css`: hồ sơ học tập sinh viên.
- `css/results/ai-state.css`: trạng thái AI trong kết quả.

### 6.3. Quy mô CSS hiện tại

Tại checkpoint V12.4.24:

- khoảng **61 file CSS source** trong thư mục `css/`;
- tổng source CSS khoảng **226 KB** chưa nén;
- `app.html` link trực tiếp khoảng **47 stylesheet**, tổng source khoảng **164 KB**;
- `css/legacy/` là archive only, không load runtime.

Đây **không phải vấn đề dung lượng lớn**. Ưu tiên hiện tại là giữ source tách domain rõ ràng. Nếu sau này cần tối ưu request, nên bundle ở bước deploy/build thay vì nhập thủ công source CSS lại với nhau.

Các file CSS lớn hiện vẫn ở mức hợp lý; `shell.css`, `unified-builder.css`, `notifications.css`, `bank.css`, `assessment-shared.css`, `detail-enhancements.css` đều nhỏ hơn khoảng 15 KB/file.

## 7. UI interaction contract

- **Chi tiết/xem nhanh** → Drawer/panel khi phù hợp.
- **Sửa nhanh** → AI-CLO app-window.
- **Sửa cấu trúc lớn/full edit** → full-width subpage/workspace.
- Boolean setting → toggle switch khi đó là bật/tắt.
- Mobile không được tràn ngang ở shell/form chính.
- Các bảng rất rộng có thể dùng horizontal scroll có chủ đích hoặc card mode tùy nghiệp vụ.

## 8. Question Bank contract

Hai nhóm câu hỏi:

1. **Luyện tập – kiểm tra**.
2. **Đề thi – bảo mật**.

- Bài kiểm tra trực tuyến không được dùng câu chỉ thuộc ngân hàng đề thi bảo mật.
- Thi cuối kỳ chỉ dùng nguồn bảo mật theo workflow đã chốt.
- Một câu có thể có scope hỗ trợ cả hai theo schema hiện hành, nhưng luồng sử dụng phải tôn trọng security group.

## 9. Assessment product contract

Framework chung của bài đánh giá gồm:

1. Mục 1 — Thông tin.
2. Mục 2 — Cấu trúc/Ma trận.
3. Mục 3 — Danh sách câu đã rút.
4. Mục 4 — Xuất, chỉ với loại bài phù hợp.

Nguyên tắc dữ liệu:

- Rút câu tạo/cập nhật draft chính thức.
- Không tạo draft có `total_questions = 0`.
- `max_attempts` được phép chỉnh sau khi có lượt làm; lịch sử cũ không bị xóa/sửa khi giảm giới hạn.
- Sinh viên Attempt chạy full-width trong `#content`.
- Kết quả/AI chỉ lấy đúng scope học phần/bài/sinh viên.

## 10. Supabase architecture

```text
supabase/
├─ README.md
├─ migrations/    # migration/upgrade SQL
├─ schema/        # snapshot CSV schema/RLS/policies
├─ policies/      # policy SQL độc lập
├─ functions/     # Edge Functions
└─ docs/          # hướng dẫn deploy/backend
```

### Edge Functions

Quy tắc bắt buộc:

- self-contained;
- không phụ thuộc `_shared` giữa các Function;
- có thể copy/deploy từng Function độc lập từ Supabase Dashboard;
- sửa code Function trên GitHub **không đồng nghĩa Function trên Supabase đã được redeploy**;
- khi thay Function phải nói rõ Function nào cần redeploy.

### Database / RLS

- Schema/RPC/RLS thay đổi phải có migration rõ ràng.
- Không sửa schema ngầm từ frontend.
- Không bypass RLS bằng frontend.
- Dữ liệu nhạy cảm phải được kiểm quyền ở backend.

## 11. AI / Gemini

- AI chỉ gọi khi người dùng chủ động bấm, trừ trường hợp đã được chốt khác.
- Không gọi Gemini tự động chỉ vì render trang.
- Khi sửa model/quota/fallback phải đọc Edge Function hiện tại trên `main`.
- Mỗi Function dùng AI giữ logic deploy độc lập/self-contained.

## 12. Hiệu năng

Đã áp dụng:

- lazy-load Office/Math libs ở nơi phù hợp;
- query/cache hợp lý;
- giảm reload toàn view;
- giữ workspace khi tab browser bị lifecycle/discard;
- layout-system generic để tránh module override chồng nhau.

Không nên tối ưu bằng cách:

- nhập tất cả source CSS/JS thành file khổng lồ;
- thêm observer toàn document không cần thiết;
- tạo polling dày khi có thể event-driven.

Nếu cần giảm số CSS request sau này, ưu tiên **build-time bundle** trong khi giữ nguyên source domain files.

## 13. Tài liệu và thứ tự đọc trước khi sửa

Khi quay lại dự án:

1. `docs/project/PROJECT-NOTES-AI-CLO.md` — quyết định kỹ thuật/UI ưu tiên.
2. `docs/project/ARCHITECTURE-AI-CLO.md` — bản đồ kiến trúc hiện hành.
3. `docs/project/TECHNICAL-AGREEMENTS.md` — quy tắc kỹ thuật bắt buộc.
4. `docs/project/PROJECT-STATUS-2026-09-06.md` — trạng thái checkpoint.
5. `docs/project/PROJECT-PROGRESS-2026-09-06.md` — lịch sử công việc trong ngày.
6. Mã mới nhất trên `main`.

Nếu tài liệu và code xung đột, phải kiểm tra commit/date và ưu tiên xác minh code `main`; sau đó cập nhật lại tài liệu để loại xung đột.

## 14. Quy tắc thay đổi repo

- Backup branch trước thay đổi có rủi ro/ý nghĩa lớn.
- Làm trên work branch, so diff trước khi đưa `main`.
- Không force push nếu không có lý do đặc biệt.
- Refactor phải bảo toàn behavior trước khi tối ưu thêm.
- Frontend-only → nói rõ **Supabase không thay đổi**.
- SQL/Edge Function → tách riêng và ghi rõ thao tác Supabase cần thực hiện.

---

**Checkpoint kiến trúc:** V12.4.24 — sau khi hoàn tất đợt CSS ownership/refactor lớn. Ưu tiên kế tiếp là smoke test UI/nghiệp vụ thực tế thay vì tiếp tục chia/tách CSS chỉ để làm sạch mã.
