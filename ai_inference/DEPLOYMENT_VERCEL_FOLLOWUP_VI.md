# B?o c?o ti?p t?c tri?n khai SiFormer CPU tr?n Vercel

Ng?y 16/11/2026. Ti?p t?c t? `dec83ca`, nh?nh l?m vi?c `deploy/vercel-siformer-cpu`.

**Parity v? RAM local ?? ??t. Ch?a c? inference th?nh c?ng tr?n Vercel.** Preview ??u ti?n l?i t?n OCI; project Preview ri?ng b? Vercel ch?n v? deployment ??u b?t bu?c mang nh?n Production. Sau ?? ng??i d?ng y?u c?u ??y code l?n main ?? auto-deploy.

## MediaPipe

?? quan s?t th? ??ng 94 stream native. Graph m? r?ng gi?ng h?t nhau. ?i?m l?ch ??u ti?n ? frame ??u, ph?p quay ROI b?n tay ph?i trong AlignmentPointsRectsCalculator; output landmark/detection ngay tr??c ?? gi?ng t?ng byte. Windows tr? rotation 3.1223742961883545, glibc Linux tr? 3.1223745346069336. `atan2f` l?ch m?t ULP; ? sampled slot 10, hand presence score ??i t? 0.038806241 sang 0.501886010, v??t ng??ng 0.5 g?c.

?? th?m shim t?ng qu?t `float atan2f(float y,float x) { return (float)atan2((double)y,(double)x); }`, ch? load trong worker MediaPipe. TensorFlow kh?ng nh?n LD_PRELOAD. Kh?ng s?a graph, ng??ng, landmark, sampling, normalization hay checkpoint. ??i ch?ng UCRT v?i 100.000 c?p float32 h?u h?n cho 0 sai kh?c so v?i double atan2 ???c l?m tr?n v? float. Th? 1/2 thread v?n gi? c?ng sai kh?c tr??c shim.

MediaPipe 0.10.14, OpenCV 4.11.0.86, NumPy 1.26.4, Protobuf 4.25.8 v? model assets ???c gi? nguy?n. TensorFlow 2.20.0 d?ng NumPy 1.26.4 tr?n Windows, 2.2.6 trong Linux; ??i ch?ng c?ng landmark ch?ng minh ??y kh?ng ph?i ngu?n l?i detector. Kh?ng ??i dependency Python.

| M?u | Confidence Windows | Linux t??ng th?ch | Sai kh?c confidence | K?t qu? |
|---|---:|---:|---:|---|
| an-frames | 0.8516781330 | 0.8516781330 | 0 | ??t |
| an | 0.6453815103 | 0.6453815699 | 5.96e-08 | ??t |
| khoc-frames | 0.3061047196 | 0.3061040640 | 6.56e-07 | ??t |
| khoc | 0.7950112224 | 0.7950114608 | 2.38e-07 | ??t |
| uong-frames | 0.5154168606 | 0.5154170990 | 2.38e-07 | ??t |
| uong | 0.5781494975 | 0.5781493783 | 1.19e-07 | ??t |

6/6 m?u ??t, kh?ng gi?m tolerance: ?nh/mask exact; landmark/tensor 1e-5; logits 5e-6; confidence v? to?n b? softmax 1e-6. Logit max 3.814697e-6; softmax max 6.556511e-7. Kh?ng c?n m?u th?t b?i trong b? 6 fixture. ??y kh?ng ph?i ch?ng minh m?i video hay m?i CPU ??u t??ng ???ng. B?o c?o l?i 5/6 c? ???c gi? nguy?n t?i `reports/vercel-parity.json`.

## B? nh? v? t?c ??

C?c s? sau ?o tr?n Docker local gi?i h?n 1 CPU, 2 GiB, root read-only, tmpfs 384 MiB; kh?ng ph?i s? ?o Vercel.

- Tr??c t?i ?u: peak cgroup 2048 MiB, ch?m gi?i h?n; MediaPipe sau request kho?ng 1292.8 MiB RSS.
- Sau t?i ?u allocator: peak profile 1289.4 MiB; MediaPipe sau request kho?ng 321.1 MiB RSS. Ch? ??t MALLOC_ARENA_MAX=2, MALLOC_MMAP_THRESHOLD_=131072, MALLOC_TRIM_THRESHOLD_=131072.
- Image t?ch h?p, k? c? video s?t ng?n s?ch decoded bytes: peak 1394.7 MiB (kho?ng 1.36 GiB), c?n kho?ng 32% d? ph?ng; 0 OOM v? 0 cgroup max events.
- RSS sau 30 request: server kho?ng 52.7 MiB, TensorFlow kho?ng 629.6 MiB, MediaPipe kho?ng 323.1 MiB. HWM ri?ng worker kh?ng ???c c?ng th?nh peak container v? trang chia s? v? th?i ?i?m kh?c nhau.
- Profile import: FastAPI kho?ng 52.5 MiB; TensorFlow import kho?ng 541 MiB, model s?n s?ng kho?ng 620?626 MiB; MP import kho?ng 113 MiB, OpenCV kho?ng 62 MiB. JAX kh?ng ???c import th?nh c?ng trong ???ng inference ?? ?o.
- MediaPipe RSS t?i m?c 10/30 sau t?i ?u kho?ng 322.75/324.49 MiB; tr??c t?i ?u kho?ng 966.32/1316.49 MiB. Ch?a c? b?ng ch?ng lo?i tr? leak d?i h?n t? b?i ch?y h?u h?n n?y.
- Decode/QC/sampling t?o c?c b?n sao frame l?n v? heap MediaPipe gi? l?i allocation l? ngu?n t?ng ch?nh. Kh?ng ??i nh?ng thu?t to?n n?y; allocator gi?p tr? b? nh? v? h? ?i?u h?nh. Landmark v? tensor nh? h?n nhi?u; JSON profile ghi ri?ng k?ch th??c array, RSS/PSS/HWM, cgroup anon/file v? temporary files.
- Cold start image ph?t h?nh d?ng Redis cloud TLS: 7.39 gi?y, image ?? c? tr?n ??a local. Warm HTTP 30 request: kho?ng 1.35?3.02 gi?y v?i Redis cloud, ho?c 1.04?1.84 gi?y v?i Redis local; kh?ng so ngang v?i latency cloud th?c t?.
- C? hai b?i 30/30 request ??u th?nh c?ng; video g?n 20 MiB ??t; ??ng th?i ??ng m?t 200, ba 429; ready v?n true. Video 76 x 1080 x 1080 = 265939200 decoded bytes ??t 200, video 77 frame v??t 256 MiB b? 422.

B?n local c? ?? headroom cho m?c ti?u 2 GiB. Ch?a x?c minh RAM/cold start tr?n Vercel, n?n ch?a kh?ng ??nh c?u h?nh Hobby ?? tr?n h? t?ng th?c.

## B?o m?t, l?u tr? v? regression

- HMAC, session Supabase, Origin, expiry, replay, rate limit, schema prediction gi? nguy?n. Worker kh?ng nh?n credential.
- Redis Free cloud qua TLS: 14 ki?m th? ??t. Hai container ??c l?p d?ng chung token cho ??ng m?t 200 v? m?t 401.
- Private Blob th?t: anonymous access b? ch?n; SHA256 ??ng ch?y checkpoint th?t; SHA256 sai b? 400; c? hai ???c x?a trong finally. Orphan b? Workflow t? x?a sau kho?ng 298 gi?y, kh?ng g?i client cleanup.
- Upload grant ch? ???c c?p sau khi enqueue durable Workflow th?nh c?ng; l?ch x?a sau token expiry + 180 gi?y. M?i token c? ttlDays=1 ?? storage t? h?t h?n khi timer g?p s? c?/late upload. TTL ??nh gi? h?ng ng?y, kh?ng ph?i cam k?t x?a ??ng 24 gi?. Cron 5 ph?t ??i th?nh daily backstop ph? h?p Hobby. Workflow ch?y c? Preview; kh?ng d?ng timer trong RAM thay cho persistence.
- ?? ki?m tra l?i workflow ?? ??ng k? v?i graph dependency v? v? Blob th?t b?ng invocation timer 5 gi?y; deadline production trong m? v?n gi? nguy?n.
- AI 26 passed; backend 121 passed, 1 skipped v? thi?u TEST_DATABASE_URL nh? tr??c; frontend unit/deployment/transport 17 passed; HTTP 11 passed; practice rendering 7 passed; Next build, npm ci, lint, typecheck ??t.
- Browser VI/mobile v? EN/desktop: countdown, mirror, quay/h?y, result/error controls ??t. Lu?ng 30 JPEG ? Node ? Linux checkpoint th?t ? UI ??t. X?c th?c local d?ng fixture, kh?ng ph?i ??ng nh?p Supabase th?t. Prediction mock ch? d?ng trong b?i UI ri?ng.
- Dependency Node ???c v? Zod 4.6.7 v? minimatch 11.0.8; audit production hi?n 0 l?i. Kh?ng ??i phi?n b?n Next, React ho?c dependency AI. Local d?ng Node24, c?u h?nh cloud frontend Node22.

## Vercel v? Git

CLI ?? ??ng nh?p. Team thasi1 l? Hobby. Redis `signhearing-preview-replay` g?i Free, t?t auto-upgrade; Blob `signhearing-cpu-preview` private, iad1. T?i nguy?n ?? n?i Preview. Ch?a n?ng c?p g?i hay ch?p thu?n chi ph?.

Image ph?t h?nh local build th?nh c?ng: Docker b?o 1219084954 bytes; id `sha256:28b00e9549d1732359d277970fdad8fa9145151b7ee8dabd0b4f3cea76902be3`. Ch? s? Docker kh?ng ???c coi l? function bundle size tr?n Vercel.

Preview l?i: https://test-rhvvx30p4-thasi1.vercel.app (ERROR). Log: `vcr.vercel.com/thasi1/test_/siformer:vercel-buildah-store: invalid reference format`. T?n project `test_` h?p l? v?i Vercel nh?ng kh?ng h?p l? nh? th?nh ph?n ???ng d?n OCI k?t th?c b?ng underscore.

Project ri?ng `signhearing-cpu-preview` ???c t?o tr?n Hobby, ch?a c? deployment. Vercel b?t bu?c deployment ??u l? Production; ch?a th?c hi?n bootstrap v? ng??i d?ng chuy?n sang y?u c?u push main. ??i t?n project Production `test_` ?? b? automatic approval review t? ch?i v? ch?a c? quy?n ??i t?n; ch?a ch?y thao t?c ??. Domain hi?n h?u v?n l? https://test-signhearing.vercel.app.

C?c bi?n Preview ?? chu?n b?: AI_TOKEN_SECRET, AI_STATE_BACKEND, AI_REDIS_URL, AI_STATE_NAMESPACE, AI_ALLOWED_ORIGINS, AI_BLOB_ORIGIN, BLOB_READ_WRITE_TOKEN, CRON_SECRET, APP_ENV v? c?u h?nh Supabase public. Source `.env` v? credentials kh?ng ???c commit. Production v?n thi?u Redis/Blob/cleanup config cho ki?n tr?c m?i; kh?ng ???c coi l? ?? s?n s?ng.

Git auto-deploy c?n c? ch? ??a private generated model/src v?o build context: c?c th? m?c n?y c? ? kh?ng v?o Git c?ng khai. CLI Preview ?? upload bundle ri?ng 55 file/29257547 bytes v? pass integrity. Kh?ng c?ng khai checkpoint ?? s?a nhanh l?i CI.

## Ph?m vi thay ??i v? rollback

Ch? s?a c?u h?nh worker/native math, Docker/allocator, c?ng c? profile/parity, transport cleanup, script deploy, dependency transport v? b?ng ch?ng ki?m th?. Kh?ng s?a backend nghi?p v?, CSS, giao di?n, translations, model architecture, checkpoint, landmark_worker, model_worker hay thu?t to?n video.

Kh?ng ??ng working tree main ?ang c? thay ??i c?a ??ng ??i. Push ph?i fast-forward t? worktree c? l?p, kh?ng force-push. Danh s?ch file ch?nh x?c n?m trong commit m?i. Rollback source b?ng revert commit tri?n khai; gi? deployment Vercel ?ang ho?t ??ng ??n khi cloud inference ???c x?c minh.

## ?i?u ki?n c?n thi?u

1. Quy?n x? l? t?n project OCI ho?c m?t ???ng tri?n khai Vercel ???c ch?p thu?n.
2. Private model artifact trong Git auto-build, c?u h?nh Production Redis/Blob/cleanup n?u chuy?n sang Production.
3. Build cloud th?nh c?ng; /ready, inference/parity CPU th?t tr?n Vercel; RAM v? latency cloud.
4. ??ng nh?p th?t v? video qua website, ki?m tra Supabase/Blob/Redis/cleanup cloud end-to-end, r?i x?c minh khi local AI/tunnel t?t.

UI/UX, preprocessing, checkpoint v? Supabase/Google OAuth ch?a b? ch?nh s?a. Ch?a ch?ng minh website ??c l?p laptop; ch?a th? g?i tri?n khai SiFormer tr?n Vercel l? th?nh c?ng.

## T?i li?u n?n t?ng ?? ??i chi?u

- [Container Runtime](https://vercel.com/docs/functions/runtimes/container): Beta tr?n m?i plan; scale-to-zero v? d?ng gi?i h?n Functions.
- [Function limits](https://vercel.com/docs/functions/limitations), [Registry limits](https://vercel.com/docs/container-registry/limits-and-pricing). CLI th?c t? t? ch?i CPU tier standard tr?n Hobby; kh?ng n?ng c?p.
- [Workflow Next integration](https://workflow-sdk.dev/docs/getting-started/next), [durable sleep](https://workflow-sdk.dev/docs/api-reference/workflow/sleep), [Workflow pricing](https://vercel.com/docs/workflows/pricing).
- [Blob TTL](https://vercel.com/docs/vercel-blob/using-blob-sdk#expire-blobs-automatically), [Hobby Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing).
- [MediaPipe detection rotation source](https://github.com/google-ai-edge/mediapipe/blob/v0.10.14/mediapipe/calculators/util/detections_to_rects_calculator.cc).
- [Vercel project rename semantics](https://vercel.com/kb/guide/how-do-i-change-the-name-of-my-vercel-project).
