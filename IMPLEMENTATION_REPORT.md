# NexusDrop implementation report

## Summary

Implemented a complete first-release project in this workspace. It contains a React/Vite frontend, Express/Socket.IO signaling backend, optional MongoDB metadata persistence, authenticated one-sender/one-receiver rooms, WebRTC peer setup and trickle ICE, a real chunked RTCDataChannel file-transfer path, incremental SHA-256, responsive UI, automated tests, deployment docs and local Docker Compose configuration.

## Completed

Room identifiers and role-specific bearer tokens are generated cryptographically. The server validates room membership, invite tokens and signaling payload sizes; rejects a second receiver; applies a basic per-socket create/join rate limit; expires rooms; and exposes `/health` and `/api/status`. Sender and receiver metadata, explicit receiver consent, offer/answer and ICE candidate exchange are implemented. Signaling carries metadata only, not file bytes.

The optional MongoDB adapter creates a TTL-indexed `transfer_metadata` collection for transfer UUID, byte size, state, created/completed timestamps, duration and average throughput. It deliberately excludes file contents, file names, MIME type, room IDs, tokens and IP addresses. MongoDB is disabled unless `MONGODB_URI` is set; no live MongoDB instance was available for a real database integration test.

The sender reads file slices into 60 KiB chunks and updates SHA-256 incrementally. The RTCDataChannel uses `bufferedAmount` / `bufferedamountlow` pacing under a 1 MiB threshold. The receiver checks transfer ID, sequence, offset, lengths and final size/hash. Where available, the receiver selects a destination during the consent click and writes incrementally through the File System Access API. Pause, same-channel resume, cancel, success, errors, byte-count progress, ETA, current average throughput, elapsed time, QR code, share link, receiver consent, result messaging, help and mobile CSS are implemented.

The interface was opened in the sandbox browser and both the home and Send screens rendered. Production frontend build and the local signaling service were run successfully.

## Tests and checks actually run

- `npm --prefix frontend run build` — passed with Vite 8.3.4.
- `npm test` — backend: 5 tests passed; frontend: 3 tests passed.
- Backend integration coverage: health/status, room create, unauthorized invite rejection, unique receiver, signaling forward after consent, and oversized payload rejection.
- Frontend unit coverage: binary chunk framing, byte/header round-trip, truncated/oversize/corrupt frames.
- `npm audit --audit-level=moderate` in both backend and frontend — 0 vulnerabilities reported in each dependency tree after updating frontend development tooling.
- Local HTTP checks: frontend returned HTTP 200; backend `/health` and `/api/status` returned successful JSON responses.
- Visual browser smoke check: landing page and Send workflow inspected on a desktop viewport.

## Not verified / limitations

A real two-browser WebRTC transfer was not run. No TURN service, credentials, public HTTPS/WSS deployment, second device, separate network, Playwright E2E setup, browser compatibility matrix, 1 GB/5 GB benchmark, or measured memory profile is available here. Therefore this report does not claim a tested large-file transfer or cross-network success. WebRTC negotiation is implemented but network conditions can still prevent a connection.

The receiver's File System Access API streaming path is browser-dependent. Other browsers use a Blob fallback that retains received file data in memory and is not appropriate for multi-gigabyte transfers. The 50 GB UI/protocol guardrail is not a device capability guarantee. Current pause/resume only works while the same data channel remains alive; there is no reconnection, reload recovery, or persistent partial-file resume.

Room state is process-local and is lost on restart; horizontal scaling needs a shared store and Socket.IO adapter. Rate limiting is per socket, not a trusted-proxy IP-level limiter. The status UI does not currently inspect selected ICE candidate-pair statistics, so it does not label a route as direct or relayed.

## Remaining manual steps before production

1. Deploy the static frontend over HTTPS and the Node signaling server on persistent WebSocket-capable hosting; configure exact CORS origins and WSS reverse proxy support.
2. Select and configure an authorized STUN/TURN service. Do not put long-lived TURN secrets in Vite variables. Add an authenticated short-lived ICE credential endpoint or provider integration; this project does not yet implement that issuer.
3. Verify receiver file-writing support on target browsers and test a multi-megabyte file across two real browsers, then a 1 GB file, and only then larger files. Record SHA-256, throughput, memory and selected ICE candidate type. Do not use memory fallback for very large transfers.
4. Add IP-level abuse controls, security headers, operational monitoring and shared room state before scaling beyond one backend process.
5. If metadata persistence is desired, set a least-privilege MongoDB URI and retention on the backend host; the live MongoDB connection was not tested in this environment.

See the root README and `docs/` for protocol, security, deployment, troubleshooting and coturn guidance.
