# AI-CLO PTITHCM V11.8.3 — Layout framework toàn web

## Mục tiêu

Chuẩn hóa các pattern layout lặp lại trên toàn web thay vì sửa breakpoint riêng từng trang.

## Backup an toàn

Trước khi chỉnh `main` đã tạo nhánh:

`backup-v11.8.2-layout-framework-20260904`

Nhánh này giữ trạng thái trước đợt chuẩn hóa layout V11.8.3.

## Framework mới

### `css/ui/layout-system.css`

Cung cấp ba primitive dùng chung:

- `.aiclo-kpi-grid` — nhóm card số liệu/KPI.
- `.aiclo-action-grid` — nhóm 4–6 nút thao tác.
- `.aiclo-filter-bar` — tìm kiếm + bộ lọc + sắp xếp + nút hành động/xuất.

Quy tắc responsive:

- Desktop/laptop: nhóm 5–6 KPI hoặc action ưu tiên giữ trên **một hàng**.
- Tablet: chuyển về 3 cột; filter về 2 cột.
- Mobile: KPI/action 2 cột, filter 1 cột; màn hình rất hẹp KPI 1 cột.

Không còn phụ thuộc vào các breakpoint module cũ kiểu `max-width:1380px => 3 cột` để quyết định layout chính.

### `js/ui/layout-system.js`

Adapter dùng `MutationObserver` để nhận diện các pattern UI hiện có và gắn primitive chung. Nhờ đó các module cũ không cần bị sửa hàng loạt ngay lập tức.

Các nhóm đang được nhận diện gồm:

- `.assessment-detail-stats`
- `.stats`
- `.v109-stats`
- `.assessment-summary`
- `.academic-profile-summary`
- `.assessment-detail-actions`
- `.bank-actions`
- `.toolbar` khi có 4–6 action phù hợp
- `.drawer-actions`
- `.student-exam-actions`
- `.ub-export-actions`
- `.attempt-page-toolbar`

## Trang Chi tiết bài kiểm tra

Desktop hiện được framework ép về:

- 5 KPI: **Đã nộp · Đang làm · GPA trung bình · GPA dưới 4 · Thời lượng** trên một hàng.
- 5 action: **AI phân tích · Sửa cấu trúc · Làm thử · Phát hành/Tạm đóng/Mở lại · Xóa bài** trên một hàng.
- Toolbar lượt làm: **Tìm kiếm · Trạng thái · Sắp xếp · Xuất báo cáo** trên một hàng.

## Nguyên tắc phát triển tiếp theo

Trang mới không tự tạo breakpoint cho nhóm KPI/action/filter nếu primitive chung đáp ứng được. Nếu cần behavior mới, ưu tiên mở rộng `layout-system.css/js` để toàn web nhận cùng một quy tắc.

Các card nội dung dài như course card, question card, notification card không bị ép vào KPI framework.
