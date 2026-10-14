# Deployment

## Topology

1. Build React (`npm --prefix frontend run build`) and serve `frontend/dist` from an HTTPS static host/CDN with SPA fallback to `index.html`.
2. Run the Node backend persistently (`npm --prefix backend start`) on a WebSocket-capable Node host/container behind HTTPS/WSS reverse proxy.
3. Operate/contract a separately configured STUN/TURN service. Verify UDP and TLS/TCP relay paths and bandwidth limits.

## Production configuration

- Set backend `PORT`, `ALLOWED_ORIGINS=https://your-app.example`, `ROOM_TTL_MS`, `MAX_ROOMS`.
- Set frontend build-time `VITE_SIGNALING_URL=https://your-api.example` and valid public ICE endpoint configuration. Do not embed a static TURN secret.
- If persistent aggregate metadata is wanted, set backend-only `MONGODB_URI`, `MONGODB_DB_NAME`, and `METADATA_RETENTION_DAYS` in the hosting secret manager. Follow [DATABASE.md](DATABASE.md) for least-privilege access and retention behavior. Never configure MongoDB credentials in frontend `VITE_*` values.
- Configure TLS certificates and reverse proxy HTTP Upgrade/Connection headers, WebSocket idle timeout, request limits, and forwarded headers from a trusted proxy only.
- Ensure browser origin and backend origin match the configured allowlist. Verify HTTPS, WSS, `/health`, and `/api/status` from outside the deployment.
- A production TURN service should issue short-lived credentials; the current app consumes ICE server JSON build-time and does not implement a credential-issuance endpoint. Add a protected credential API before connecting paid/private TURN infrastructure.
- Current room state is in-process; use one backend instance. For multiple instances, implement shared room state plus a Socket.IO adapter and review token/session affinity.
- Review hosting egress, persistent process, WebSocket, connection, timeout and bandwidth policies. Free tiers may sleep, cap sockets, or charge TURN bandwidth.

`docker-compose.yml` is a local development convenience, not a production hardening profile. Do not expose it publicly without TLS, secrets management, monitoring, quotas and security review.
