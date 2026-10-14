# Architecture

## Components

- `frontend/`: Vite/React UI, Socket.IO signaling client, ICE configuration, native `RTCPeerConnection`, ordered `RTCDataChannel`, browser File APIs, incremental SHA-256.
- `backend/`: Express health/status routes and Socket.IO signaling. Room membership and bearer tokens live in process memory for a bounded TTL. Optional MongoDB stores aggregate transfer metadata with TTL expiry, never file bytes or room credentials.
- STUN/TURN: separately operated services. STUN helps discover a viable ICE path; TURN forwards encrypted packets when direct paths fail.

## Data paths

SDP, ICE candidates, consent, and basic file metadata are sent through the signaling service after room authentication. The optional database stores only transfer UUID, size, state, and completion metrics; filenames, room IDs, tokens, and connection details are excluded. The data channel transports file chunks directly between browsers when possible. When ICE selects a relay candidate, TURN temporarily forwards the encrypted WebRTC traffic. `connectionState === connected` does not by itself prove a direct path; inspect selected candidate pair stats (`getStats`) for route diagnostics. This UI does not yet report a definitive direct/relay label.

## Trust boundaries

The browser JavaScript, both endpoints, HTTPS origin, signaling service for rendezvous, and any selected TURN provider are operational trust dependencies. DTLS protects WebRTC transport in transit; it does not protect files on a malicious endpoint, from malicious app code, or from the recipient. Invitation links are bearer secrets.

## Scaling

Rooms are in-memory and local to one Node process. Horizontal scaling requires shared Socket.IO room routing and shared, secure, expiring room authorization state, plus sticky session/routing support as needed. File throughput is peer/TURN/network limited and is not handled by Express. Apply rate limits at the trusted edge, observability and capacity planning before public production use.
