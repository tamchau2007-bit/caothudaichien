# Đại Chiến Cao Thủ Online

Game đối kháng 2D platformer 8 cao thủ võ lâm, chạy hoàn toàn trên web (React + Canvas 2D)
với chế độ **đấu online realtime dùng rollback netcode**.

- 8 cao thủ, mỗi người 9 chiêu (J, U, I, W+U, W+I, S+U, S+I, W+J, S+J).
- 4 võ đài: Lôi Đài, Nguyễn Huệ, Châu Phi Safari, Nhật Bản Sakura.
- Chế độ: đấu với máy (AI), luyện tập (hình nhân), 2 người cùng máy, online 1v1.
- Online: phòng mã 4 ký tự, chọn tướng/võ đài, sẵn sàng, tái đấu, tự động kết nối lại.

## Chạy local

**Yêu cầu:** Node.js >= 20.

```bash
npm ci            # hoặc npm install
npm run dev       # server + Vite HMR tại http://localhost:3000
```

Mở 2 tab `http://localhost:3000`, vào **Đấu Online** → một tab *Tạo Phòng*, tab còn lại *Nhập Mã*.

Các lệnh khác:

```bash
npm run typecheck   # tsc --noEmit
npm test            # node:test (vật lý, chiến đấu, rollback)
npm run build       # build client ra dist/ + server ra dist-server/
npm start           # chạy bản production trên $PORT (mặc định 3000)
```

## Chơi online hoạt động thế nào

- `server.ts` là một room server (Node + `ws`): quản lý phòng, chọn tướng/võ đài, chia sẻ
  seed trận đấu và **chuyển tiếp input** giữa 2 máy. Server không mô phỏng trận đấu.
- Mỗi máy chạy mô phỏng **deterministic 60Hz** (`src/game/engine.ts`) và dùng
  `src/game/rollback.ts` để:
  1. dự đoán input của đối thủ (repeat input gần nhất) và chơi ngay, không bị trễ;
  2. khi input thật đến muộn, tua lại snapshot cũ, mô phỏng lại và tua nhanh tới frame hiện tại;
  3. gửi checksum định kỳ để phát hiện lệch trạng thái.
- Vì vậy mọi thứ ảnh hưởng gameplay đều phải deterministic: không `Math.random()`
  (dùng `Rng` có seed), không phụ thuộc `Date.now()` hay delta-time thật trong `step()`.

Độ trễ nhập liệu có thể chỉnh trong **Cài Đặt → Mạng & Rollback Netcode** (mặc định 2 frame).

## Deploy lên Render

Repo đã có `render.yaml`. Trên Render: **New → Blueprint** trỏ tới repo này, Render sẽ dùng:

- Build: `npm ci --include=dev && npm run build`
- Start: `npm start` (`node dist-server/server.js`)
- Health check: `/api/health`

Hoặc tạo **Web Service** thủ công với đúng 2 lệnh trên (Runtime: Node, Node >= 20).
Server đọc `process.env.PORT`, bind `0.0.0.0` và phục vụ `dist/` nên không cần cấu hình thêm.
WebSocket dùng chung cổng `/ws` — không cần bật thêm dịch vụ nào.

Lưu ý: phòng đấu lưu trong RAM. Khi Render khởi động lại (deploy mới / free tier sleep),
các phòng đang mở sẽ mất và client sẽ tự kết nối lại.

## Phím điều khiển

| Hành động | P1 | P2 (2 người cùng máy) |
| --- | --- | --- |
| Di chuyển | A / D | ← / → |
| Hồi sức (W) | W | ↑ |
| Thủ (S) | S | ↓ |
| Nhảy (K) | K hoặc Space | M hoặc Numpad 0 |
| Đánh (J) | J | B hoặc Numpad 1 |
| Chiêu 1 / 2 | U / I | H / Y (Numpad 4 / 5) |
| Lướt | L | . (Period) hoặc Numpad 3 |

Giữ **W + J** để tung Ulti, **S + K** để tụt xuống xuyên bàn.
Hùng Chim Bay: nhảy 2 lần, **giữ K** khi đang rơi để chao lượn (thanh năng lượng cánh cạn dần).
