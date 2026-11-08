# Kết quả modernization — 31/10/2026

Baseline `227ebbf`, nhánh làm việc `feature/modern-fullstack`. Không push,
không merge, không thay đổi remote. Bản gốc `D:\SignHearing` còn nguyên;
thay đổi nằm trong `D:\SignHearing\.checkouts\team-20261031`.

## Thay đổi đã triển khai

- Landing mới bằng Next App Router/React, TypeScript strict, Tailwind v4,
  component theo mẫu shadcn/ui/Radix, Motion và Lucide. Header/menu mobile,
  language switch, hero, phần giới thiệu VSL/quote, challenge cards, câu chuyện,
  timeline, cộng đồng/contact details, footer và 404 chia thành component riêng.
- Design tokens lấy từ CSS gốc, hierarchy chữ và khoảng trắng mới, gradient
  nhẹ, card, quote layout, focus rõ, reduced-motion và fallback điều hướng khi
  không có JS. Xanh nút được làm đậm từ xanh gốc để tăng tương phản chữ trắng.
- `/app` và 8 module có shell/navigation/card/button/responsive styles mới qua
  `app_shell/modern.css`, nạp sau CSS module. Không đổi các handler, data
  attribute, `SH.store`, quiz, dữ liệu mẫu hoặc nguồn video.
- Next rewrite `/app/*`, `/static/*`, `/api/*` sang FastAPI trên cùng origin.
  Module học vẫn dùng renderer Python/JS cũ; **chưa viết lại thành React**.
- FastAPI health, cấu hình Pydantic, request ID/error envelope, development CORS,
  session SQLAlchemy 2.x, Alembic baseline và Compose PostgreSQL 17.
  Database không được kết nối khi startup hoặc khi render landing/khu học.
- Đồng bộ đủ 499 key VI/EN từ nguồn gốc; assets PNG sao chép nguyên byte.
  Giữ logo, mascot, tỷ lệ, nội dung, nguồn trích dẫn và ý nghĩa CTA.
- Sửa fixture test dashboard dùng slug `xin-chao` thay vì chỉ số đầu danh sách;
  bộ video được merge đã thay đổi thứ tự. Không sửa dữ liệu để làm test đạt.
- README mới, README cũ lưu nguyên tại `docs/LEGACY-README.md`; có audit,
  design system, hướng dẫn chạy/database/i18n và script mở server Windows.

## Kiểm tra thực sự đã chạy

| Kiểm tra | Kết quả |
| --- | --- |
| Next production build, webpack | Đạt, Next 16.4.3 / React 19.3.1 / Node 22.23.4 |
| `npm run typecheck` | Đạt, strict TypeScript |
| `npm run lint` | Đạt, không warning từ mã nguồn |
| `npm run format:check` | Đạt |
| `npm test` | 2 tests đạt: 499 key/ngôn ngữ bằng nguồn gốc; checksum assets |
| `npm run test:http` trên production `:3000` | 6 tests đạt: SSR VI/EN, nội dung/metadata/citation/CTA/assets, 404, cookie, app, redirect, health, byte-range video |
| Backend pytest, Python 3.12.13 | 30 đạt, 1 bỏ qua (live PostgreSQL), 1 cảnh báo dependency TestClient/httpx |
| Ruff lint/format | Đạt |
| Python compileall (backend/app + alembic) | Đạt |
| Alembic `upgrade head --sql` + `history` | Đạt; PostgreSQL SQL sinh được, head `0001_foundation` |
| Legacy HTTP/i18n/content regression `verify.py` | 2.544 assertions đạt, 8 modules / 11 app routes |
| Module render suites | 38 tests đạt (dashboard, dictionary, lesson, practice, progress, review, settings) |
| Dashboard Node state/store integration | Đạt cả VI và EN |
| Peer dependency resolution (`npm ls eslint --all`) | Đạt sau khi khóa ESLint 9 theo plugin hiện tại |
| Production dependency audit (`npm audit --omit=dev`) | 0 vulnerabilities |
| Git diff whitespace check + staged file scan | Đạt; không xóa đường dẫn, không thêm runtime/secrets phát hiện qua mẫu |
| Checksum workspace gốc | 29 file nguồn vẫn giữ nguyên |

Các bài HTTP không phải browser E2E. Tất cả bảng kết quả phản ánh lệnh đã chạy,
không suy diễn điểm Lighthouse hay kiểm tra trực quan từ HTTP assertions.

## Phần còn giới hạn

1. **Chưa nghiệm thu hình ảnh/mobile/desktop/bàn phím trong browser.** Browser
   inventory trả `apps: [], browsers: []`; Windows Computer Use trả lỗi native
   pipe không tồn tại. Không có ảnh chụp hoặc điểm Lighthouse được tạo giả.
   Cần kiểm tra VI/EN ở 360, 390, 768, 1280, 1440 và 1920px: overflow, menu
   focus/Escape, CTA/hash, contact details, reduced motion và các module học.
2. **Chưa chạy PostgreSQL thật hoặc Docker Compose.** Docker/Postgres không có
   trong môi trường kiểm tra. Có cấu hình/session/migration và SQL offline,
   nhưng chưa thể xác nhận live connection, upgrade/downgrade hay volume health.
   Test database bỏ qua rõ ràng; hướng dẫn kiểm tra nằm trong MODERN-DEVELOPMENT.
3. Global 404 dùng cờ Next experimental `globalNotFound` được tài liệu chính
   thức mô tả. Đã kiểm tra HTTP/HTML ở production; cần giữ regression khi nâng
   Next. Đường `notFound()` mặc định đã không đáp ứng SSR đầy đủ trong thực nghiệm.
4. ESLint 9 bị upstream đánh dấu hết hỗ trợ nhưng vẫn là phiên bản khớp peer
   dependencies của các plugin Next hiện tại. Audit toàn bộ dev toolchain còn
   16 cảnh báo moderate liên quan minimatch. Không force fix hoặc ép major để
   che cảnh báo. Audit production riêng không có vulnerability được báo.
5. Tiến độ vẫn ở localStorage, không đồng bộ DB hoặc giữa port/origin. Dữ liệu
   cũ không bị xóa. Bản cũ `:8000` và preview mới `:3000` có storage riêng;
   muốn dùng lại tiến độ cũ cần giữ cùng origin. Chưa có auth/AI/CMS/thanh toán mới.

## Preview và chạy lại

- Landing: <http://127.0.0.1:3000/?lang=vi>
- English: <http://127.0.0.1:3000/?lang=en>
- Khu học: <http://127.0.0.1:3000/app>
- API: <http://127.0.0.1:8001/api/health>

Từ `frontend`: `npm ci`, `npm run dev`; từ `backend`: `uv sync --locked --python 3.12`,
`uv run uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload`.
Hướng dẫn đầy đủ: [MODERN-DEVELOPMENT.md](MODERN-DEVELOPMENT.md).
