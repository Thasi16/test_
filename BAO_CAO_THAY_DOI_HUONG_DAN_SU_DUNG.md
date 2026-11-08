# Báo cáo thay đổi: Hướng dẫn sử dụng SignHearing

Ngày lập: **07/11/2026**.

Thư mục dự án: `C:\Users\Admin\Desktop\demo\signhearing-vsl400`.

## 1. Phạm vi so sánh

Báo cáo liệt kê các file đã thêm hoặc sửa kể từ trước khi triển khai tour **“Hướng dẫn sử dụng”** trong khu học tập `/app`, bao gồm bản sửa lỗi thiếu bản dịch `shell.tour.restart` phát sinh sau đó.

Tổng cộng **13 file thuộc phạm vi này: 4 file mới và 9 file được sửa**. Bản thân file báo cáo không được tính vào 13 file trên.

Trước khi thêm tour, dự án đã có các thay đổi xóa subtitle và xóa ô “Dữ liệu của bạn”. Những thay đổi đó chưa được commit riêng, nên `git diff` so với HEAD hiện chứa cả hai nhóm công việc. Phạm vi trong báo cáo được đối chiếu từ trạng thái trước khi làm tour đã ghi nhận trong phiên làm việc và nội dung thay đổi hiện tại; không có một commit riêng đại diện chính xác cho mốc trước tour để xuất bản so sánh từng dòng độc lập.

## 2. Các file thuộc phần triển khai tour

Nhóm này gồm **9 file: 3 file mới và 6 file được sửa**.

### 1. `app_shell/onboarding.js` — Tạo mới

Điều khiển tour dùng chung cho khu học tập:

- Hướng dẫn lần lượt 8 mục: Tổng quan, Lộ trình học, Từ điển, Tự luyện, Ôn tập, Tiến độ, Cài đặt và Tài khoản.
- Tự mở ở lần truy cập đầu tiên; hỗ trợ Tiếp theo, Quay lại, Bỏ qua và Hoàn tất.
- Bấm vùng nền tối để đi tiếp; chặn thao tác vào liên kết và nút phía dưới.
- Hỗ trợ Escape, Enter, phím mũi tên, quản lý focus và giữ focus trong hộp hướng dẫn.
- Tính lại vị trí khi cuộn, đổi kích thước hoặc thay đổi layout; bỏ qua mục không có hoặc đang ẩn.
- Tạm hiện sidebar nếu đang thu gọn và khôi phục trạng thái khi đóng tour.
- Ghi nhớ hoàn tất/bỏ qua bằng khóa `signhearing_onboarding_v1`; ưu tiên localStorage, dự phòng sessionStorage.
- Dọn listener, observer và phần tử giao diện khi tour kết thúc.

### 2. `app_shell/onboarding.css` — Tạo mới

Định dạng lớp phủ, khung tô sáng, tooltip, bộ đếm bước, thanh tiến trình và các nút. Dùng màu và kiểu chữ của ứng dụng; có bố cục cho điện thoại, hiệu ứng chuyển bước và hỗ trợ giảm chuyển động.

### 3. `app_shell/tests/onboarding.browser.mjs` — Tạo mới

Kiểm tra tour bằng Chrome headless với hồ sơ thử riêng và server Python dùng renderer thật của dự án. Bao phủ điều hướng bước, bấm nền, ngăn kích hoạt link bên dưới, bàn phím, focus, lưu trạng thái, mở lại tour, mục bị thiếu/ẩn, sidebar thu gọn, desktop/mobile và VI/EN. Xuất kết quả và ảnh chụp vào `.runtime/onboarding-qa/`.

### 4. `app_modules.py` — Sửa

- Thêm thuộc tính ổn định `data-tour="<module-id>"` vào các liên kết menu do registry tạo ra.
- Nạp `/static/app/onboarding.css` và `/static/app/onboarding.js` trong layout của các trang học tập.

### 5. `app_shell/layout.html` — Sửa

Thêm nút **“Hướng dẫn sử dụng / Take a Tour”** trên header, có biểu tượng dấu hỏi, nhãn truy cập và thuộc tính `data-tour-start`. Nút cho phép mở lại tour từ bước đầu.

### 6. `app_shell/locales/vi.json` — Sửa

Thêm **24 khóa `shell.tour.*`** cho tiếng Việt: nhãn nút, bộ đếm, gợi ý thao tác và tiêu đề/nội dung của 8 bước. Nội dung mô tả đúng bản hiện tại, gồm giới hạn AI và trạng thái mẫu của thông tin thành viên.

### 7. `app_shell/locales/en.json` — Sửa

Thêm **24 khóa `shell.tour.*`** tương ứng bằng tiếng Anh; giữ cùng bộ khóa với tiếng Việt.

### 8. `frontend/src/locales/vi.json` — Cập nhật từ nguồn

Đồng bộ các khóa tour tiếng Việt bằng `frontend/scripts/sync-content.mjs`. Đây là file được sinh từ các nguồn bản dịch của dự án, không sửa tay để thêm tour.

File này cũng có các thay đổi mô tả Cài đặt từ trước khi làm tour. Khi đọc diff tổng so với HEAD, chỉ phần khóa `shell.tour.*` mới thuộc việc thêm hướng dẫn.

### 9. `frontend/src/locales/en.json` — Cập nhật từ nguồn

Đồng bộ các khóa tour tiếng Anh theo cùng cơ chế. Các thay đổi mô tả Cài đặt có từ trước được giữ lại; không tính chúng là thay đổi do tour.

## 3. Các file thuộc bản sửa lỗi bản dịch sau khi thêm tour

Nhóm này gồm **4 file: 1 file mới và 3 file được sửa**.

Lỗi quan sát được: `/app` trả HTTP 500 với thông báo `Missing template translation/context: shell.tour.restart`. Tiến trình backend đang giữ bản dịch cũ trong bộ nhớ trong khi template trên đĩa đã dùng khóa mới.

### 10. `i18n.py` — Sửa

- Thêm `refresh_locales()` và dấu nhận biết thay đổi của các file bản dịch dựa trên đường dẫn, thời gian sửa và kích thước.
- Nạp lại JSON khi nguồn thay đổi; dùng khóa `RLock` để kiểm soát việc cập nhật đồng thời.
- Cho các hàm ghép và kiểm tra bản dịch xử lý một bộ dữ liệu mới trước khi công bố.
- Kiểm tra bộ khóa VI/EN và giá trị hợp lệ trước khi thay cache. Nếu kiểm tra thất bại, bộ dữ liệu lỗi không được ghi đè lên cache hợp lệ trước đó.
- Giữ đối tượng `DICTIONARIES` dùng chung để các nơi đã import vẫn nhận được bản dịch cập nhật; các dictionary đang dùng bởi request cũ vẫn còn hiệu lực.

### 11. `serve.py` — Sửa

Import và gọi `refresh_locales()` ở đầu `page_context()`, trước khi lấy bản dịch để dựng trang. FastAPI cũng sử dụng hàm dựng context này qua adapter hiện có.

### 12. `backend/app/services/legacy.py` — Sửa phần mô tả

Cập nhật docstring để ghi rõ context của trang sẽ cập nhật bản dịch đã thay đổi trước khi render template. Diff của file này chỉ thay nội dung mô tả; phần thực thi cập nhật bản dịch nằm trong `i18n.py` và `serve.py`.

### 13. `backend/tests/test_i18n_reload.py` — Tạo mới

Thêm 4 kiểm tra hồi quy:

- Request `/app` khôi phục được bản dịch tour từ tình trạng cache cũ thiếu khóa.
- Thay đổi bản dịch được nạp lại và giữ hiệu lực các tham chiếu đang dùng.
- File không đổi thì không bị đọc/parse JSON lại.
- Bản cập nhật VI/EN không hợp lệ không được công bố vào cache; cập nhật hợp lệ sau đó vẫn được nạp.

## 4. Những file có thay đổi từ trước, không thuộc việc thêm tour

Các file sau đang xuất hiện trong trạng thái Git nhưng đã thay đổi trước khi triển khai hướng dẫn. Chúng liên quan đến việc lược subtitle, gỡ ô “Dữ liệu của bạn”, điều chỉnh mã/kiểm thử đi kèm hoặc file Next.js tự sinh:

```text
frontend/next-env.d.ts
modules/account/page.html
modules/courses/page.html
modules/dashboard/page.html
modules/dashboard/script.js
modules/dashboard/tests/test_dashboard.js
modules/dashboard/view.py
modules/dictionary/page.html
modules/lesson/page.html
modules/practice/page.html
modules/practice/session.html
modules/progress/page.html
modules/review/page.html
modules/review/quiz.html
modules/settings/locales/en.json
modules/settings/locales/vi.json
modules/settings/page.html
modules/settings/script.js
modules/settings/style.css
modules/settings/tests/check_browser.mjs
modules/settings/tests/check_render.py
```

Hai file `frontend/src/locales/vi.json` và `frontend/src/locales/en.json` chứa cả thay đổi trước tour lẫn khóa tour mới, nên đã được ghi riêng ở mục 2.

## 5. Kết quả kiểm tra đã thực hiện

Các kết quả dưới đây đã được chạy trong quá trình triển khai và sửa lỗi; không phải một lần chạy lại toàn bộ khi lập báo cáo:

- Tour trên Chrome: **131 kiểm tra đạt**, gồm VI/EN, desktop, điện thoại và màn hình ngang. Kết quả lưu tại `.runtime/onboarding-qa/results.json`.
- Kiểm tra HTTP/i18n/nội dung bằng `verify.py`: **2.856 kiểm tra đạt** ở giai đoạn triển khai tour.
- Các bộ kiểm tra render module và tích hợp store của Dashboard: đạt ở giai đoạn triển khai tour.
- Kiểm tra nội dung frontend: **2 kiểm tra đạt** ở giai đoạn triển khai tour.
- Backend sau bản sửa lỗi bản dịch: **38 kiểm tra đạt, 1 bỏ qua**. Kiểm tra bỏ qua cần PostgreSQL `DATABASE_URL` được cấu hình.
- Riêng `tests/test_i18n_reload.py`: **4 kiểm tra đạt** khi chạy độc lập.
- Ruff cho `backend/app` và `backend/tests`: đạt sau bản sửa lỗi.
- Đã xác nhận `/app?lang=vi` và `/app?lang=en` trả **HTTP 200** qua cả cổng **8001** và **3000** sau khi sửa lỗi.

Các ảnh kiểm tra được tạo tại:

```text
.runtime/onboarding-qa/desktop-vi.png
.runtime/onboarding-qa/mobile-en.png
.runtime/onboarding-qa/landscape.png
```

Đây là sản phẩm kiểm tra trong thư mục runtime, không tính vào 13 file nguồn/kiểm thử ở trên.

## 6. Cách chạy và giới hạn liên quan

Lệnh chạy frontend/backend và các địa chỉ truy cập vẫn giữ nguyên. Việc thêm tour không yêu cầu thêm thư viện runtime, đổi cổng hoặc chạy migration database.

Để kiểm tra lại riêng tour, chạy từ thư mục gốc dự án:

```powershell
node app_shell/tests/onboarding.browser.mjs
```

Bộ kiểm tra này cần Python, Node.js, các thư viện frontend đã được cài và Chrome. Đường dẫn Chrome mặc định theo máy Windows hiện tại; có thể cấu hình biến môi trường `CHROME_PATH` nếu dùng vị trí khác.

Để kiểm tra backend, chạy trong thư mục `backend`:

```powershell
.venv\Scripts\python.exe -m pytest -q
```

Trạng thái tour gắn với bộ nhớ trình duyệt và origin đang truy cập. Nếu localStorage bị chặn, ứng dụng thử sessionStorage; nếu cả hai bị chặn, trạng thái chỉ được giữ trong trang hiện tại. Kiểm tra giao diện thực tế đã thực hiện trên Chrome; chưa xác nhận bằng chạy thử trên Safari hoặc Firefox.

Các thay đổi được giữ trong workspace; chưa commit hoặc push GitHub.
