# Signaling protocol

The server sends no file contents. All client events are scoped by `roomId` and an opaque bearer token after room creation/join. Room IDs are random 144-bit identifiers; sender and receiver tokens are random 256-bit values. Invitation links are bearer credentials and must be kept private.

| Event | Direction | Payload / result | Authorization |
|---|---|---|---|
| `room:create` | client → server | ack `{ok, roomId, token, inviteToken, expiresAt}` | New socket; basic per-socket creation limit |
| `room:join` | client → server | `{roomId, token}`; ack `{ok, role, expiresAt}` | Invite token; one receiver only |
| `room:participant` | server → sender | `{role, state: joined/disconnected}` | Membership event |
| `file:offer` | sender → server → receiver | `{roomId, token, transferId, name, size, mime}` | Authenticated sender, receiver joined; metadata bounds; database omits name and MIME |
| `receiver:decision` | receiver → server → sender | `{roomId, token, accept}` / `{accepted}` | Authenticated receiver |
| `webrtc:offer`, `webrtc:answer` | either peer via server | `{roomId, token, description}` | Member; receiver must exist and accept |
| `webrtc:ice` | either peer via server | `{roomId, token, candidate}` | Member; receiver must exist and accept |
| `transfer:state` | sender → server → receiver | `{roomId, token, transferId, state, durationMs, averageBps}` | Authenticated sender; completed metrics validated and persisted only when MongoDB is enabled |
| `room:expired` | server → room | no payload | Room TTL cleanup |
| `error:protocol` | server → client | `{code, message}` | Invalid/unauthorized input |
| `disconnect` | Socket.IO lifecycle | server removes sender room or marks receiver gone | Socket lifecycle |

Creation and join attempts are limited per socket (8/minute). Invalid IDs/tokens, repeated receiver entry, large payloads, unknown rooms and unauthenticated signaling are rejected. The backend uses exact origin configuration. Per-socket limits do not replace trusted IP-level rate limiting. Room codes are not authorization on their own. The sender has the invite credential to distribute; protecting the URL remains important.

Rooms expire after `ROOM_TTL_MS` (default one hour). State is process-local and disappears on restart. On sender disconnect the room is removed; on receiver disconnect the slot is released, but active transfer recovery is not implemented.
