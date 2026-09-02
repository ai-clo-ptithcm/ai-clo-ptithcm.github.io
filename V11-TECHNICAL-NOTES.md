# AI-CLO PTITHCM V11 — Technical Notes

Checkpoint ngày **02/09/2026**.

## Runtime checkpoint

- Main runtime commit: `e71e973bea14c09d561eb86d2a9c542e693829d3`
- GitHub Pages run: **#169 — success**
- Không có migration Supabase mới.
- Không thay Gemini model/quota/fallback trong đợt V11 frontend cleanup.

## Các PR cuối của V11

| PR | Nội dung | Commit merge |
|---|---|---|
| #53 | Gộp CSS final workflow + autosave/final package | `9e94b9dfb825a61258c65407f71375c13e460b34` |
| #54 | Gộp/đổi tên semantic CSS question bank + class list | `a0636ca7277c330d7b600e6fa9d49cdb56649bf7` |
| #55 | Đổi tên semantic CSS final layer + student profile | `af14c6a739d1ea13dce74cfdfcec0131e3dface9` |
| #56 | Lazy-load XLSX + JSZip | `804317d30c6fde35635e676d6648e8562ae52704` |
| #57 | Lazy-load MathJax | `5e6247552b5586509a01cd4ac2437a729160385a` |
| #58 | Làm mượt chuyển mục sidebar | `e71e973bea14c09d561eb86d2a9c542e693829d3` |

## Core performance modules

### `js/core/performance.js`

Cung cấp helper nhẹ dùng chung:

- `memo(key, ttlMs, loader)`
- `invalidate(prefix)`
- `idle(task, timeout)`

Không phụ thuộc module nghiệp vụ.

### `js/core/office-libs.js`

Lazy loader cho các thư viện Office nặng:

- XLSX
- JSZip

Mục tiêu: không đưa các thư viện này vào đường tải ban đầu của app.

### `js/core/math.js`

Lazy loader/bridge cho MathJax:

- Giữ `window.renderMath(container)` để các module cũ không phải sửa hàng loạt.
- Chỉ load MathJax khi phát hiện LaTeX trong container.
- Queue việc typeset để tránh nhiều render MathJax chồng nhau.

### `js/ui/view-transition.js`

Lớp UX ngoài cùng cho `window.render`:

- Chụp snapshot `#content` đang hiển thị.
- Gọi render hiện tại.
- Nếu render lõi vừa thay `#content` bằng placeholder toàn cục `Đang tải dữ liệu…`, phục hồi snapshot tạm thời.
- Đánh dấu `aria-busy`, khóa pointer events trong lúc refresh.
- Không can thiệp loading cục bộ của từng panel.

## Load order cần giữ

Một số quan hệ quan trọng:

- `js/app.js` phải có trước `js/core/math.js` để math bridge thay thế `renderMath()` lõi.
- `js/ui/final-layer.js` phải chạy trước `js/ui/view-transition.js` để transition bọc lớp `render()` cuối của UI.
- `js/students/profile.js` hiện không bọc lại `render()`, nên có thể nằm sau `view-transition.js`.
- CSS semantic mới phải giữ đúng thứ tự cascade tương đương các file versioned cũ.

## CSS semantic hiện tại

Các file V10.x versioned cuối đã được xử lý. Các file chính cần nhớ:

```text
css/exams/final-workflow.css
css/questions/bank.css
css/courses/class-list.css
css/ui/shell.css
css/system/notifications.css
css/system/profile.css
css/ui/final-layer.css
css/students/profile.css
```

Không nên tách/gộp tiếp chỉ để giảm số file nếu không có bằng chứng hiệu năng rõ; cascade và khả năng bảo trì quan trọng hơn giảm thêm một request nhỏ.

## Compatibility globals

Một số tên versioned vẫn được giữ có chủ ý để tránh regression:

- `AICLO_V108`
- `AICLO_V1053`
- các tên `v95*`, `v96*`, `v102*` còn được module khác tham chiếu

Chỉ xóa sau khi search dependency toàn repo chứng minh không còn caller.

## Dữ liệu/CLO cần bảo vệ

- AI feedback phải lọc theo `subject_id`.
- Không để nhận xét Giải tích 1 xuất hiện trong Vật lý 1 hoặc ngược lại.
- Cache student profile phải dùng key có `subjectId`.
- Các dữ liệu bài thi, CLO, attempt snapshot không được đổi semantics trong các đợt performance cleanup.

## Quy trình sửa an toàn tiếp theo

1. Bắt đầu từ main checkpoint đã deploy success.
2. Audit dependency trước khi sửa.
3. Tạo branch nhỏ theo một mục tiêu UX/bug cụ thể.
4. Kiểm tra diff chính xác.
5. Squash merge.
6. Xác minh đúng Pages run theo merge SHA `completed/success` trước lượt kế tiếp.
7. Với lỗi UI thực tế, ưu tiên sửa đúng màn hình thay vì refactor rộng.

## Ưu tiên sau checkpoint

- Quan sát thực tế trên desktop/mobile.
- Ghi lại màn hình nào vẫn xuất hiện loading mạnh, chớp hoặc render chậm.
- Sửa theo UX trước.
- Chỉ sau đó mới cân nhắc cache view sâu hơn hoặc lazy-load JS theo role.
