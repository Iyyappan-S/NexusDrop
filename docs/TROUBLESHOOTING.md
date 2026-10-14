# Troubleshooting

- **Cannot connect to signaling:** verify backend process, `VITE_SIGNALING_URL`, `ALLOWED_ORIGINS`, TLS/WSS proxy upgrade settings, and `/health`.
- **Invite says not found/full/unauthorized:** ensure the complete private link including both `room` and `invite` parameters is used before the room's one-hour expiry; sender disconnect or restart destroys the in-memory room.
- **Stuck connecting / ICE fails:** confirm both networks allow WebRTC, use valid STUN configuration, then configure a TURN relay with current short-lived credentials and reachable UDP/TLS ports. STUN alone is not sufficient on every NAT/firewall. The app doesn't prove a connection is direct or expose selected ICE route yet.
- **No receiver metadata:** sender must keep the tab/room alive; only the invited joined peer receives offered metadata.
- **Download memory use:** Chromium HTTPS pages with File System Access support can stream to a selected file. Other browsers use an in-memory Blob fallback. Avoid testing multi-gigabyte files in that fallback.
- **Transfer stalls:** keep both devices awake and tabs open, avoid network changes, verify free disk space, and consider TURN relay bandwidth. Pause only works on an open channel; reconnect after loss is not implemented.
- **Hash failure:** discard the received result, repeat in stable networks, and compare source/received SHA-256 using a local trusted tool. Do not assume a UI success without the final verification status.
- **Slow or expensive relay:** TURN carries traffic when selected and can incur bandwidth costs. Check actual ICE candidate-pair stats in browser developer tools; no route label is currently implemented.
