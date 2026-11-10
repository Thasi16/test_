# Thiết lập Supabase cho SignHearing

Code đã được tích hợp trong repository. **Chưa kết nối hoặc thay đổi Supabase production, chưa push GitHub và chưa deploy.** Không có credentials thực tế trong phiên làm việc này.

## 1. Chạy migration

1. Mở đúng Supabase Project → SQL Editor → New query.
2. Chạy **toàn bộ** [supabase/migrations/202611080001_learning_auth.sql](supabase/migrations/202611080001_learning_auth.sql), gồm `begin` và `commit`.
3. Kiểm tra bảy bảng: `profiles`, `lesson_progress`, `viewed_signs`, `favorite_signs`, `practice_sessions`, `quiz_attempts`, `study_activities`.
4. Mỗi bảng phải bật RLS và có policy `sh_select_own` dành cho `authenticated`. `anon` không có quyền đọc dữ liệu cá nhân. Ghi dữ liệu chỉ qua RPC `sh_record_learning_event`; `sh_learning_snapshot` đọc dưới RLS của user.

Migration dùng UUID của `auth.users`, `timestamptz`, khóa duy nhất theo user/resource hoặc user/event UUID; không cần extension hoặc mật khẩu database. Trigger tạo profile khi đăng ký; tài khoản đã tồn tại cũng được bổ sung profile. Chạy lại migration này không xóa tiến độ, hồ sơ hoặc lịch sử.

Repository trước thay đổi chỉ có Alembic foundation rỗng; không tìm thấy schema nghiệp vụ Supabase được cung cấp. Migration này là schema tương ứng với curriculum và module thực tế trong repo. Nếu project của bạn đã có bảng cùng tên với cấu trúc khác, hãy đối chiếu/sao lưu trước. Migration sẽ rollback khi cấu trúc không tương thích hoặc phát hiện policy khác có thể mở quyền; không xóa policy/bảng cũ để ép chạy. Gửi schema thực tế để lập migration bổ sung nếu gặp trường hợp này. Không dùng `DROP TABLE` hay reset project.

## 2. Cấu hình Authentication

Trong Supabase Dashboard:

- Authentication → Providers / Sign In → bật Email và cho phép đăng ký email/password.
- Tắt **Confirm email** cho MVP như yêu cầu. Nếu vẫn bật, ứng dụng báo rõ không nhận được phiên đăng nhập, không giả lập gửi email hoặc đăng nhập thành công.
- Đặt độ dài mật khẩu tối thiểu 8 ký tự. Giao diện kiểm tra nhập lại mật khẩu; Supabase áp dụng quy tắc bảo mật cuối cùng.
- Authentication → URL Configuration: Site URL là origin HTTPS thật của website. Google OAuth dùng callback `/api/auth/google/callback`; xem [GOOGLE_OAUTH_SETUP.md](GOOGLE_OAUTH_SETUP.md) để cấu hình Google Provider, Redirect URLs cho local/Production và đánh giá rủi ro Confirm Email đang tắt.
- Giữ cơ chế refresh token rotation và khoảng reuse mặc định của Supabase; ứng dụng có thể gửi nhiều request đồng thời từ các tab.
- Project Settings → API: lấy Project URL và **Publishable key** dạng `sb_publishable_...`. Code chủ động từ chối Secret key và legacy JWT keys để tránh dùng nhầm quyền cao.

Tham khảo chính thức: [Password Auth](https://supabase.com/docs/guides/auth/passwords), [User sessions](https://supabase.com/docs/guides/auth/sessions), [User data and RLS](https://supabase.com/docs/guides/auth/managing-user-data).

## 3. Environment variables trên Vercel Services

Thêm vào môi trường Production và Preview phù hợp, đúng service:

**Frontend (`frontend/`, Next.js, được đọc lúc build):**

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

**Backend (`backend/`, FastAPI):**

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
APP_ENV=production
```

Hai cặp URL/key phải thuộc **cùng một project**. Không thêm dấu nháy hoặc khoảng trắng ngoài giá trị trên Vercel. Thay public variables cần build lại frontend. `/api/auth/config` chỉ trả về cấu hình công khai; header Next.js kiểm tra đối chiếu với backend. `/api/auth/session` dùng chính cookie đã đăng nhập ở trang legacy, không tạo session riêng trong Next.js.

`DATABASE_URL` không cần cho các chức năng Supabase này. Để trống nếu không dùng health check PostgreSQL cũ. Không thêm Secret Key, Service Role Key hoặc Database Password vào frontend; implementation này không cần chúng ở backend. `.env.example` chứa ô trống, `.env`/`.env.*` thật bị gitignore.

## 4. Kiến trúc và Vercel

Giữ nguyên `vercel.json`: `/api/*`, `/app/*`, `/login/*`, `/static/*` vẫn vào FastAPI; các đường dẫn còn lại vào Next.js. Không thay framework hoặc rebuild website.

- Next.js landing dùng public variables ở `src/lib/supabase-config.ts` và gọi API cùng origin.
- `/login` có cả đăng nhập và đăng ký, giữ mascot/animation, VI/EN và tham số `next` an toàn trong `/app`.
- FastAPI gọi Supabase Auth HTTP API bằng publishable key. Access token và refresh token nằm trong cookie HttpOnly, SameSite=Lax, Secure trên production. Không trả token cho JavaScript hoặc lưu token trong localStorage.
- Trước mỗi trang bảo vệ/API dữ liệu, backend xác minh access token với `/auth/v1/user`; token hết hạn được refresh và xác minh lại. Cookie demo không có giá trị xác thực.
- Ghi cookie cần request JSON cùng origin; chặn CSRF. Có xử lý origin của local Next proxy và public host được edge Vercel chuyển tiếp.
- PostgREST/RPC nhận token của user đã xác minh. RLS và `auth.uid()` xác định chủ sở hữu; không nhận `user_id` từ client để phân quyền. Header `X-SH-User` chỉ chống tab cũ ghi nhầm sau khi đổi tài khoản, luôn được so sánh với danh tính backend đã xác minh.
- `backend/scripts/prepare_legacy.py` đóng gói các file shell/module/locale/static mới vào `legacy_site` như trước. Không đóng gói `.env`.

## 5. Dữ liệu, streak và dữ liệu trình duyệt cũ

`SH.store` giữ giao diện đọc đồng bộ cho module, nhưng chờ tải dữ liệu tài khoản trước khi render. Mọi thao tác ghi đều chờ server xác nhận, sau đó nạp lại snapshot. Có thông báo lỗi và thử lại; UUID của một lượt luyện/quiz được giữ khi thử lại để tránh nhân đôi. Lesson progress không bị hạ từ completed xuống in_progress. Bài học hoàn thành khi quiz của bài đạt ít nhất 80%; bài video tổng hợp không hoàn thành bài học cụ thể.

Checklist luyện tập là **tự đánh giá**, camera không được tải lên. Quiz hiện lưu kết quả từ trình nhận diện trắc nghiệm chạy trong browser, backend kiểm tra curriculum, số câu và giới hạn điểm; đây không phải hệ thống thi chống gian lận. Không thay đổi hoặc thêm AI chấm điểm giả.

Streak chỉ đọc `study_activities`, được ghi cùng transaction khi hoàn tất tự luyện, nộp quiz hoặc hoàn thành bài. Đăng nhập, mở bài, xem ký hiệu và yêu thích không tạo ngày học. Timestamp do PostgreSQL đặt, lưu `timestamptz` với thời điểm UTC; client không được ghi/backdate trực tiếp. Ngày học quy đổi sang `Asia/Ho_Chi_Minh`, nhiều hoạt động cùng ngày chỉ tăng một ngày streak. Current streak giữ nguyên nếu đã học hôm qua và hôm nay chưa học; về 0 khi bỏ trọn một ngày. Longest streak dùng toàn bộ lịch sử. Calendar hiển thị đúng 30 ngày giờ Việt Nam.

**Dữ liệu localStorage cũ:** không tự nhập hay ghi đè server. Account hiển thị thông báo nếu phát hiện `signhearing:v1`. Dữ liệu cũ được giữ nguyên. Đề xuất nhập một lần: chủ tài khoản xuất bản JSON cũ, xem trước số bài/ký hiệu/lượt luyện/quiz, xác nhận tài khoản đích và danh sách mục; sau đó dùng migration nhập riêng theo kiểu chỉ thêm mục chưa tồn tại, đánh dấu import theo user/hash. Không dùng timestamp cũ chưa xác minh để tạo streak. **Luồng nhập có xác nhận này là đề xuất, chưa có nút nhập trong MVP.** Giữ bản JSON và liên hệ người quản trị nếu cần chuyển dữ liệu cũ; không dán JSON vào SQL có quyền cao một cách trực tiếp.

## 6. Chạy và kiểm thử local

Tạo `backend/.env` và `frontend/.env.local` từ file mẫu bằng credentials của project phát triển riêng. Không dùng project production để thử nghiệm ghi dữ liệu.

```powershell
# Terminal 1, trong backend/
uv sync --group dev
uv run uvicorn app.main:app --host 127.0.0.1 --port 8001

# Terminal 2, trong frontend/
npm ci
npm run dev
```

Mở `http://127.0.0.1:3000` để cả hai framework dùng cùng origin. `.env.example` của frontend có `LOCAL_BACKEND_URL`; không đặt biến này trên Vercel. Chỉ giữ localhost trong `CORS_ORIGINS` cho local, không bật CORS wildcard. Trên Vercel, frontend/backend giao tiếp cùng origin và không cần cross-origin credentials.

Kiểm tra tự động:

```powershell
# backend/
uv run pytest -q
uv run ruff check app tests

# frontend/
npm run build
npm run typecheck
npm run lint
npm test
npm run test:deployment

# repo root: PostgreSQL WASM, cài dưới thư mục runtime bị gitignore
npm install --prefix .runtime/sql-check @electric-sql/pglite
node --test supabase/tests/migration.test.mjs
```

Test FastAPI mock dịch vụ Auth/PostgREST để kiểm tra HTTP contract; test SQL dùng engine PostgreSQL PGlite với schema `auth` tối thiểu, không phải Supabase hosted. Test `auth-store` chạy JavaScript trong Node VM, không phải kiểm thử trình duyệt thật. Xem [docs/SUPABASE_IMPLEMENTATION.md](docs/SUPABASE_IMPLEMENTATION.md) để biết kết quả cuối cùng và giới hạn xác minh.

## 7. Kiểm thử sau khi bạn chạy SQL và deploy

1. Chưa đăng nhập: mở trực tiếp `/app/progress?lang=vi`, phải về `/login` với `next`; tự đặt cookie/cờ demo không được vượt bảo vệ.
2. Tạo tài khoản A bằng email mới, tên hiển thị, password ≥8 ký tự và xác nhận khớp. Thử xác nhận khác nhau, email sai, mật khẩu sai và email đã đăng ký; lỗi phải rõ ràng, không có phiên giả.
3. Đăng ký thành công phải vào khu học tập. Đổi VI/EN, reload và mở tab mới: phiên còn hoạt động. Account hiển thị đúng tên/email/UUID/ngày tạo, không có ID hoặc ngày tham gia mẫu.
4. Mở một bài, đánh dấu ký hiệu đã xem và chọn yêu thích. Tải lại: các lựa chọn còn nguyên. Mở cùng tài khoản trên thiết bị khác: dữ liệu được nạp từ server.
5. Hoàn tất một lượt tự luyện, lưu checklist; xem lịch sử Practice/Progress và số liệu Dashboard. Nhấn lưu hai lần nhanh hoặc gửi lại cùng UUID: chỉ có một bản ghi.
6. Nộp quiz: lưu điểm, số câu, thời điểm và lịch sử. Quiz bài học đạt ≥80% hoàn thành bài; thất bại hoặc quiz video tổng hợp không hoàn thành bài cụ thể.
7. Đăng xuất, truy cập lại đường dẫn bảo vệ: về login. Đăng nhập lại A: dữ liệu phục hồi. Tạo B trong cửa sổ riêng: không thấy tiến độ, yêu thích, profile hoặc lịch sử A. Đổi tài khoản ở tab khác rồi thử ghi ở tab cũ: phải tải lại hoặc bị từ chối.
8. Chỉ đăng nhập/mở bài/xem ký hiệu: streak không tăng. Lưu một lượt luyện hoặc nộp quiz: current=1, longest≥1 và calendar hôm nay có hoạt động. Nhiều lượt cùng ngày không tăng số ngày. Kiểm tra tiếp hôm sau theo giờ Việt Nam; bỏ một ngày phải ngắt chuỗi. Không sửa thời gian production để test.
9. Kiểm tra DevTools: API riêng tư có `Cache-Control: private, no-store`; không có token ở localStorage/response JSON; cookie `sh_access`/`sh_refresh` có HttpOnly/Secure. Thử JWT giả, `user_id` tự gửi và đọc bảng bằng tài khoản khác: phải bị chặn hoặc không trả hàng của người khác.
10. Kiểm tra `/`, `/features`, video VSL, camera tự luyện, mascot, sidebar, onboarding và responsive trên điện thoại. Thử mạng lỗi lúc lưu: không báo thành công; thử lại cùng lượt không tạo dữ liệu trùng.

Nếu lỗi `supabase_not_configured`: kiểm tra biến đúng backend service. `learning_unavailable`: kiểm tra migration/RPC/grants/RLS. `origin_rejected`: kiểm tra request qua đúng origin và forwarded host trên Vercel. Không khắc phục bằng tắt RLS hoặc đưa Service Role key vào client.
