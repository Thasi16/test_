# Google OAuth cho SignHearing

## Kiến trúc đã kiểm tra

- `vercel.json` giữ nguyên Services và rewrite `/api/*`, `/app/*`, `/login/*`, `/static/*` sang FastAPI. Callback nằm trong `/api/*`, không cần rewrite mới.
- Next.js không tạo Supabase session riêng. `/login` được `backend/app/api/learning.py` render qua `backend/app/services/legacy.py` từ `login.html`; đăng ký là chế độ của cùng form trong `static/login.js`.
- Email/password tiếp tục dùng `/api/auth/register` và `/api/auth/login`. Chuyển trang sau đăng nhập mặc định `/app?lang=vi|en`, hoặc đường dẫn trong `/app` được kiểm tra.
- `sh_access` và `sh_refresh` là cookie host-only, HttpOnly, SameSite=Lax, Path=/; Secure trên HTTPS, APP_ENV=production hoặc Vercel. Access cookie theo `expires_in`, refresh cookie 30 ngày; thời hạn session thực tế vẫn do Supabase quyết định.
- `sb.identity()` gọi `/auth/v1/user` để xác minh access token; khi hết hạn, đổi refresh token qua `/auth/v1/token?grant_type=refresh_token`, xác minh token mới rồi đặt lại cookie. `/app/*` yêu cầu identity này; API học tập cũng xác minh identity.
- User ID lấy từ Supabase `/auth/v1/user`, không lấy từ email, JWT chỉ decode, hoặc client. RPC dùng access token của người dùng và PostgreSQL `auth.uid()`/RLS.
- Migration `supabase/migrations/202611080001_learning_auth.sql` đã có trigger `sh_auth_user_created` tạo `profiles` khi có `auth.users` mới, không phân biệt provider. Không cần migration bổ sung. Tên hiển thị có thể trống với Google vì trigger hiện chỉ đọc `display_name`; không tự ghi đè hồ sơ cũ.

## Luồng triển khai

1. Nút Google ở Login/Register gửi JSON POST `/api/auth/google`, kèm `lang` và `next`. Backend kiểm tra Origin/Content-Type/Sec-Fetch-Site như các route auth hiện có và đọc `/auth/v1/settings` để phát hiện Google Provider chưa bật.
2. Backend sinh state ngẫu nhiên và verifier PKCE, tạo challenge SHA-256 (`s256`). Context được giữ 10 phút trong cookie HttpOnly, SameSite=Lax. Trên HTTPS dùng `__Host-sh_google_oauth` (Secure, Path=/, không Domain); HTTP local dùng `sh_google_oauth`.
3. Trình duyệt được đưa đến Supabase `/auth/v1/authorize?provider=google&code_challenge=...`. Supabase quản lý state giữa Supabase và Google. State của SignHearing được đặt trong query của `redirect_to`, không ghi đè state do Supabase quản lý.
4. Google trả về Supabase, Supabase trả code về **GET `/api/auth/google/callback?state=...&code=...`**.
5. Backend kiểm tra cookie, thời gian và state; POST `/auth/v1/token?grant_type=pkce` với `auth_code` và `code_verifier`; xác minh access token qua `/auth/v1/user`. Chỉ chấp nhận user có `email_confirmed_at` và Google identity với `identity_data.email_verified=true`.
6. Backend đặt hai cookie session hiện có, xóa context OAuth và trả 303 tới `/app` hoặc `next` hợp lệ, có ngôn ngữ. JavaScript không nhận access/refresh token, không lưu token trong localStorage. Cookie context không phụ thuộc RAM một instance, nên tồn tại qua cold start.
7. Lỗi/hủy/code hết hạn hoặc đã dùng đưa về `/login` với mã lỗi thuộc allowlist; không đưa thông báo thô của provider vào trang. Không tạo cookie session mới khi lỗi. Một session đã có trước đó được giữ nguyên. Refresh và logout dùng luồng cũ; logout cũng xóa context OAuth.

`next` chỉ nhận absolute path trong `/app`, chặn URL ngoài, `//`, backslash, control characters, traversal và path mã hóa không hợp lệ. Luồng OAuth chỉ giữ một context mỗi trình duyệt: bắt đầu lần mới sẽ thay lần cũ; callback của tab cũ thất bại an toàn và cần thử lại.

## Hai callback khác nhau

**Google Cloud → Supabase Auth**: `<SUPABASE_URL>/auth/v1/callback`.

**Supabase Auth → SignHearing**: `<PUBLIC_ORIGIN>/api/auth/google/callback?state=<random>`.

Không nhập callback SignHearing vào Authorized redirect URIs của Google. Không nhập callback Supabase vào danh sách Redirect URLs của website trong Supabase.

Hai file môi trường local hiện trỏ tới cùng Supabase project. Không xuất key/secret vào tài liệu này. Muốn lấy chính xác callback Google của project đang dùng, chạy lệnh chỉ in URL công khai:

Với Project URL đang có trong cấu hình local, Authorized redirect URI của Google là **`https://gzbavgkkbfvdvgncdhry.supabase.co/auth/v1/callback`**. Đây chỉ là URL công khai, không phải secret. Nếu thay project, lấy lại URL bằng lệnh sau thay vì dùng URL cũ:

```powershell
Set-Location backend
uv run python -c "from app.core.config import get_settings; print(get_settings().supabase_url + '/auth/v1/callback')"
```

Production domain không được khai báo trong repository hiện tại, nên không suy đoán domain production. Lấy domain thật trong Vercel Project → Settings → Domains. Backend xác định origin theo thứ tự:

1. `SITE_URL` nếu được cấu hình (cùng biến đã dùng trong frontend).
2. Khi `VERCEL_ENV=production`, `https://<VERCEL_PROJECT_PRODUCTION_URL>`; môi trường khác dùng `https://<VERCEL_URL>`, có fallback giữa hai biến hệ thống.
3. Local development dùng Origin đã được kiểm tra của trình duyệt, ví dụ `http://127.0.0.1:3000`, dù Next.js rewrite tới backend cổng 8001.

Nếu dùng custom domain, đặt **cùng `SITE_URL` cho cả hai service** và mở trang login bằng domain đó. Không bắt đầu ở một host rồi callback sang host khác vì cookie OAuth là host-only.

## Google Cloud

1. Mở [Google Cloud Console](https://console.cloud.google.com/), tạo hoặc chọn project.
2. Mở Google Auth Platform (hoặc APIs & Services → OAuth consent screen). Khai báo tên SignHearing, email hỗ trợ, thông tin liên hệ và các domain theo hướng dẫn Console.
3. Audience: chọn External cho người dùng bên ngoài tổ chức; Internal chỉ phù hợp Google Workspace của tổ chức. Trong Testing, thêm email người kiểm thử vào Test users. Hoàn thiện yêu cầu xuất bản/verification của Google trước khi mở công khai.
4. Tạo OAuth Client ID loại **Web application**.
5. Authorized JavaScript origins: thêm `http://127.0.0.1:3000` và origin HTTPS thật của SignHearing. Nếu cũng dùng localhost, thêm riêng `http://localhost:3000`. Không có path, query hoặc dấu `/` cuối. Luồng redirect này không sử dụng Google JS SDK; mục này không thay thế Authorized redirect URIs.
6. Authorized redirect URIs: nhập chính xác **`<SUPABASE_URL>/auth/v1/callback`**, hoặc copy Callback URL trên trang Google Provider trong Supabase. Đây là HTTPS callback của cùng Supabase project đang dùng email/password, không phải local website. Local SignHearing vẫn dùng callback Supabase hosted này.
7. Lưu Client ID và Client Secret để nhập trực tiếp vào Supabase. Không đưa secret vào frontend, Git, chat hoặc Vercel.

## Supabase

1. Mở đúng project đang dùng email/password → Authentication → Sign In / Providers (hoặc Providers) → Google.
2. Bật Google Provider; nhập Google Client ID và Client Secret; Save. Giữ yêu cầu xác minh email của provider, không bật tùy chọn bỏ qua kiểm tra bảo mật để chữa lỗi đăng nhập.
3. Authentication → URL Configuration → Site URL: production dùng origin HTTPS thật; project chỉ dành cho local dùng `http://127.0.0.1:3000`.
4. Redirect URLs: thêm các mẫu sau (ký tự `*` ở cuối là glob cho state ngẫu nhiên; không nhập placeholder production nguyên văn):

```text
http://127.0.0.1:3000/api/auth/google/callback?state=*
https://YOUR_ACTUAL_PRODUCTION_HOST/api/auth/google/callback?state=*
```

Nếu cần localhost hoặc preview, thêm chính xác host tin cậy:

```text
http://localhost:3000/api/auth/google/callback?state=*
https://YOUR_EXACT_PREVIEW_HOST/api/auth/google/callback?state=*
```

Chỉ wildcard giá trị state, không wildcard toàn bộ host/path. Có thể thêm callback không query để tham khảo nhưng ứng dụng thực tế luôn gửi `?state=...`, nên cần mẫu trên. Theo cơ chế Supabase, cùng origin với Site URL có thể được chấp nhận mặc định; vẫn khai báo rõ callback để dễ kiểm tra.

5. Save. Giữ nguyên cấu hình Confirm Email trong lần tích hợp này. Xem phần rủi ro bên dưới trước khi mở đăng ký công khai.
6. Nếu thấy lỗi Redirect URL hoặc quay về Site URL thay vì callback, kiểm tra đúng scheme, hostname, port, path, query glob và `SITE_URL` của service backend. Không sửa bằng wildcard rộng như `https://**`.

## Vercel và môi trường

- Giữ Framework Preset **Services**, `vercel.json` và cơ chế build hiện có.
- Backend đã dùng `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`; frontend đã dùng `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Tất cả phải thuộc cùng project. Không thay các key hiện có.
- Không cần Google Client ID/Secret ở Vercel, không cần secret/service-role key, thư viện auth frontend mới hoặc session secret mới.
- Không bắt buộc thêm biến mới nếu Vercel cung cấp system environment variables cho backend. Kiểm tra `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` khả dụng cho service này. Nếu không khả dụng, hoặc dùng custom domain, đặt biến **`SITE_URL=https://your-real-domain`** cho backend, cùng giá trị frontend. Đây là tái sử dụng biến hiện có, không tạo biến OAuth origin trùng lặp.
- Có thể dùng `APP_ENV=production` để bảo đảm Secure cookies ngoài Vercel; HTTPS và Vercel cũng tự bật Secure. Không dùng APP_ENV=production khi thử bằng HTTP local vì trình duyệt sẽ không gửi Secure cookie.
- Không sửa `.env` thật trong lần tích hợp này. Chỉ bổ sung ghi chú SITE_URL trong `backend/.env.example`.
- Chưa kiểm thử Google/Supabase E2E thật hoặc thay dữ liệu Production; không deploy thủ công. Xem kiểm tra trước push bên dưới.

## Tài khoản cũ, identity linking và Confirm Email

Supabase quản lý automatic identity linking. Khi Supabase xác nhận cùng user ID, dữ liệu học cũ tiếp tục lấy theo ID đó và RLS/RPC hiện có; ứng dụng không tra email để tự ghép, đổi ID, sao chép dữ liệu hoặc ghi lại lịch sử. User Google mới đi qua trigger tạo profile hiện có.

**Confirm Email đang tắt là rủi ro cần giải quyết trước khi mở đăng ký công khai.** Supabase ngầm đánh dấu email đã được xác nhận khi tùy chọn này tắt. Một người có thể đăng ký email của người khác và đặt mật khẩu mà chưa chứng minh sở hữu email; sau đó Google identity của chủ email có thể được liên kết với tài khoản đó. Không thể xem `email_confirmed_at` là bằng chứng tài khoản email/password cũ từng được xác minh thật.

Supabase mô tả việc bỏ các identity chưa xác nhận để chống pre-account takeover. Tuy nhiên, cơ chế đó không bảo đảm xử lý được các email đã bị auto-confirm trong MVP. Backend kiểm tra Google identity đã xác minh giúp chặn kết quả OAuth không đáng tin, **không loại bỏ mật khẩu/refresh session có sẵn của tài khoản auto-confirm**. Không có API publishable an toàn để suy ra lịch sử xác minh thật của mọi tài khoản này.

Phương án vận hành trước khi mở công khai:

1. Dùng project staging hoặc nhóm test đóng để kiểm thử Google trước; chưa coi việc thêm nút Google là đã giải quyết rủi ro MVP.
2. Quản trị viên xem xét bật Confirm Email cho đăng ký mới, chuẩn bị SMTP và quy trình xác minh email. Backend hiện trả `email_confirmation_required` khi đăng ký không cấp session; cần hoàn thiện UX xác minh/gửi lại email trước khi thay cấu hình này trên dịch vụ công khai.
3. Lập danh sách tài khoản đã tạo trong giai đoạn auto-confirm bằng quy trình quản trị được duyệt. Xác minh lại chủ email, đặt lại thông tin đăng nhập và thu hồi các session cũ nếu cần. Bật Confirm Email chỉ cho tương lai không tự khắc phục tài khoản cũ.
4. Với email trùng, phải kiểm tra user ID/identities và dữ liệu cũ trong staging. Nếu có hai ID hoặc dấu hiệu nhầm chủ sở hữu, dừng xử lý và liên hệ quản trị viên; không tự merge hoặc sửa SQL Production.

Tích hợp này không tự bật/tắt Confirm Email hay cấu hình manual linking, không sửa password/identity của tài khoản cũ. Hành vi linking thật phụ thuộc Supabase project, nên cần kiểm thử với tài khoản do bạn kiểm soát.

## Kiểm thử

Đã chạy offline/mocked, không dùng Google credentials hoặc ghi dữ liệu Supabase thật:

- Backend: `python -m pytest -q -p no:cacheprovider` — 99 passed, 1 skipped (test PostgreSQL cần DATABASE_URL). Trong workspace này dùng Python tại `.runtime/loading-qa-venv/Scripts/python.exe` vì launcher `backend/.venv/Scripts/python.exe` trỏ tới Python cũ không còn chạy. Ruff `check app tests` cũng đạt.
- Trong đó 32 test mới ở `backend/tests/test_google_oauth.py`: PKCE S256 và verifier exchange; state sai/Unicode; cookie thiếu/hỏng/hết hạn; code hết hạn/replay; hủy; Google Provider chưa bật; CSRF; open redirect; local rewrite/Vercel/custom domain và cấu hình origin sai; giới hạn kích thước cookie với next mã hóa dài; Google identity chưa xác minh; giữ user ID và snapshot lịch sử cũ; session, refresh, logout, đăng nhập lại; localization và asset; lọc query khỏi Uvicorn access log.
- Frontend: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` (8 passed), `npm run test:deployment` (4 passed).
- Database sandbox: `node --test supabase/tests/migration.test.mjs` — 1 passed, gồm RLS, ownership timestamp, migration rerun và idempotent activity writes. Không chạy trên Production.
- Giao diện: `frontend/tests/google-oauth.browser.mjs` dùng Playwright với Chrome headless, POST OAuth được intercept — 4 scenarios passed. Kiểm tra VI/EN ở 390px và 1440px: Login/Register, mascot, không tràn ngang (kể cả bên trong card), focus/Enter, loading và chống click lặp, lỗi provider, giữ form mật khẩu, thông báo hủy, chuyển tới provider giả lập. Ảnh QA lưu tại `.runtime/oauth-ui/`. Đã kiểm tra ảnh desktop/mobile và sửa việc card bị cuộn ngang khi focus bằng `overflow:clip`. Đây không phải Google E2E.

Chạy lại UI test bằng Playwright đã cài ngoài dependency production:

```powershell
# Terminal 1: từ backend/, chạy backend local (không cần bấm auth thật).
uv run uvicorn app.main:app --host 127.0.0.1 --port 8008

# Terminal 2: từ frontend/; nếu playwright không nằm trong module path, dùng biến dưới.
$env:PLAYWRIGHT_MODULE = 'ABSOLUTE_PATH_TO_PLAYWRIGHT_OR_PLAYWRIGHT_CORE'
$env:TEST_URL = 'http://127.0.0.1:8008'
node tests/google-oauth.browser.mjs
```

Chưa xác minh E2E Google/Supabase thật. Sau cấu hình, dùng tài khoản test trên project staging:

1. Chạy Next.js tại `http://127.0.0.1:3000`, backend tại 8001 theo hướng dẫn Supabase hiện có. Dùng cùng hostname từ lúc mở Login đến callback.
2. Thử Login và Register, cả VI/EN: bấm Google, chọn tài khoản, quay lại `/app`; URL cuối không có code/token, cookie HttpOnly được đặt; DevTools không đọc được cookie qua `document.cookie`.
3. Refresh `/app`, chờ/ép access token hết hạn trong môi trường test và xác nhận refresh; logout rồi đăng nhập Google lại. Hủy chọn tài khoản phải trở về login và không tạo session mới.
4. Thử code cũ/đã dùng, cookie bị chặn, state sai, next ra ngoài; tất cả phải thất bại an toàn.
5. Email/password: đăng ký, đăng nhập đúng, từ chối sai mật khẩu, logout vẫn hoạt động.
6. User Google mới: profile được trigger tạo, progress/streak ban đầu trống. User email/password cùng email: so sánh chính xác `auth.users.id` trước/sau, kiểm tra learning progress, practice/quiz history, current/longest streak vẫn đúng. Thử riêng tài khoản auto-confirm trong staging để đánh giá rủi ro liên kết nêu trên.
7. Hai tài khoản test khác nhau không được đọc/ghi dữ liệu của nhau; kiểm tra RLS bằng token của từng user. API mock không thay thế kiểm thử quyền với project thật.
8. Thử lại trên đúng production origin khi bạn tự quyết định triển khai và hoàn tất các bước an toàn. Kiểm tra Secure cookies, HTTPS callback, custom domain và hệ thống log.

## Logging và giới hạn

Ứng dụng không log password, token, verifier, authorization code hoặc provider error description. Bộ lọc Uvicorn access log loại query của callback; callback trả `Referrer-Policy: no-referrer`, các route auth trả `Cache-Control: private, no-store`. Chỉ code một lần và state xuất hiện trong callback theo Authorization Code Flow; access/refresh token không nằm trong URL.

Reverse proxy/CDN/Vercel có hệ thống log riêng ngoài phạm vi bộ lọc Python. Trước khi mở công khai, kiểm tra cấu hình redaction/exclusion cho query callback trong logging/analytics của deployment và không bật debug HTTP body. Nếu tùy biến ASGI server/log format, phải kiểm tra lại redaction; bộ lọc hiện xử lý access log chuẩn của Uvicorn.

## Các file của lần tích hợp

- Backend: `backend/app/api/auth.py`, `backend/app/services/oauth.py` (mới), `backend/app/services/supabase.py`, `backend/app/core/config.py`, `backend/app/main.py`, `backend/.env.example`.
- UI: `login.html`, `static/login.js`, `static/login.css`, `static/google.svg` (mới).
- VI/EN: `locales/vi.json`, `locales/en.json`; `frontend/src/locales/vi.json`, `frontend/src/locales/en.json` được script sync hiện có cập nhật.
- Kiểm thử mới: `backend/tests/test_google_oauth.py`, `frontend/tests/google-oauth.browser.mjs`.
- Tài liệu: `GOOGLE_OAUTH_SETUP.md` (mới), liên kết và callback cập nhật trong `SUPABASE_SETUP.md`.

Các thay đổi chưa commit đã tồn tại trước lần tích hợp trong app shell, renderer, learning/progress, timing và test tương ứng được giữ nguyên. Không chạy SQL migration hoặc deploy Vercel thủ công.

## Kiểm tra trước push — 2026-11-10

- Remote đích: `https://github.com/Thasi16/test_.git`. Nhánh Production `main` được chủ dự án xác nhận; GitHub báo Vercel đã deploy thành công commit `5a11c71` trên nhánh này. Chưa đọc trực tiếp cấu hình Production Branch trong Dashboard Vercel.
- Bản Google Login được tách trên `origin/main` mới nhất để giữ hai commit cải thiện loading/cache đã có; không đưa commit tài liệu local chưa push hoặc các thay đổi ngoài phạm vi Google Login vào commit này.
- Build, typecheck, ESLint, Ruff và 99 backend tests đạt; 1 test kết nối PostgreSQL bỏ qua do thiếu DATABASE_URL. 8 frontend unit tests, 4 deployment tests và 4 kịch bản UI VI/EN desktop/mobile đều đạt trên bản tách riêng.
- Test routing xác nhận chính xác `/api/auth/google` và `/api/auth/google/callback` vào backend service. Test gói backend độc lập chạy với `VERCEL=1` xác nhận callback được đăng ký, trả 303 an toàn khi thiếu cookie, loại code khỏi redirect và phục vụ Google icon. `vercel.json` giữ nguyên.
- Quét nội dung 20 file chuẩn bị commit, các định dạng Google/Supabase/GitHub/AWS secret, private key, JWT service-role và đối chiếu credential riêng trong cấu hình local: không phát hiện secret. Chỉ `.env.example` được theo dõi; `.env` thật và `.env.local` bị ignore.
- Không tự chạy SQL migration. Kiểm thử RLS/migration từ lần triển khai trước đã được ghi ở trên; lần kiểm tra trước push không chạy lại migration. Google OAuth E2E thật vẫn cần cấu hình Provider và tài khoản test của chủ dự án.

## Nguồn chính thức đã đối chiếu

- [Google OAuth qua Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Identity linking và unconfirmed identities](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Confirm Email và auto-confirm](https://supabase.com/docs/guides/auth/general-configuration)
- [Redirect URLs và glob](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Auth JS: PKCE exchange dùng auth_code/code_verifier](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts)
