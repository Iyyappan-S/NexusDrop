# Transfer protocol

The sender creates one ordered `RTCDataChannel` (`nexusdrop-v1`). The receiver accepts the transfer before signaling is permitted. Metadata is sent as a JSON text message only after the channel opens:

```json
{"type":"meta","transferId":"uuid","name":"file.bin","size":123,"mime":"application/octet-stream","chunkSize":61440,"lastModified":0}
```

Each binary message is: 4-byte big-endian header byte length, UTF-8 JSON header, then raw chunk bytes. Header fields are `{type:"chunk", transferId, seq, offset, len}`. Chunks are currently 60 KiB, sequence starts at zero, offsets are contiguous. Receiver rejects invalid headers, IDs, sequence, offsets, lengths, chunks above 256 KiB, or bytes above expected size. Messages `end` include total size and lowercase SHA-256 hex. Receiver verifies byte count and incremental SHA-256 before declaring completion. A `complete` message includes transfer UUID, size and hash; the sender reports only UUID/state/duration/average throughput to signaling for optional metadata persistence. `error`, and `cancel` text messages report control state. `ack` messages carry the accepted offset for diagnostics/future recovery; present sender pacing is bounded by RTCDataChannel `bufferedAmount`, not a stop-and-wait acknowledgement window.

## Memory and flow control

Sender slices the `File` and reads one chunk at a time. It waits while `bufferedAmount` is at/above a 1 MiB window, and uses `bufferedAmountLowThreshold`. Hash updates are incremental. Receiver serially writes chunks to a `FileSystemWritableFileStream` when available and hashes incrementally. Without that API, it accumulates chunks for a Blob fallback: receiver memory then scales with file size, so multi-gigabyte transfers are not reliable in that mode.

## State and recovery

States rendered include waiting, connecting, transferring, paused, verifying, completed, failed, and cancelled. Pause stops scheduling new chunks; browser/channel buffers may still drain. Resume continues on the same live channel. Channel loss, reload, or device closure ends the transfer; no resume cursor or persistent partial-file recovery exists. The sender must remain online with the original selected file. Treat the UI maximum as a guardrail only.
