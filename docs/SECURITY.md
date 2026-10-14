# Security and privacy

- Use HTTPS and WSS in production; configure exact `ALLOWED_ORIGINS`.
- Rooms use unpredictable IDs and separate random sender/invite tokens. The invitation URL is a bearer credential; share it only with the recipient. Do not log it.
- The Socket.IO service carries signaling and file metadata, not file bytes. It holds transient room state in memory and expires rooms. If MongoDB is enabled, only transfer UUID, size, state and aggregate completion metrics are retained temporarily; filenames, room tokens and file contents are excluded.
- WebRTC data channels inherit DTLS transport security. A TURN provider may relay encrypted packets. Neither DTLS nor peer-to-peer routing proves an endpoint or the application code is trustworthy.
- Receiver consent is required before the sender opens the data channel and transfers bytes. Metadata is disclosed to a joined invite holder for consent.
- Avoid logging signaling payloads. Health/status endpoints expose no secret values.
- Never commit TURN shared secrets or place long-lived credentials into Vite `VITE_*` variables; browser values are public. Use short-lived scoped TURN credentials from an authenticated service.
- The in-memory per-socket request throttle is minimal. Production needs trusted-proxy-aware IP throttling, abuse defenses, monitoring, dependency scanning, security headers, deployment secrets management and multi-instance authorization design.
- A malicious/compromised sender, receiver, browser, extension, OS, page code or relay operator is not defeated by this design. There is no end-to-end signature/key verification independent of the hosted app.
