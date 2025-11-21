# Receiver Message-Processing Spec (for Node.js receivers)

## Purpose
Define how a Node.js WebSocket client should parse, validate, and route messages from the server so it reliably receives updates (text) and binary artifacts (flags/pictures/translations), requests missing data, and validates translations integrity.

## Frame Types
- Text frames: JSON strings. Always processed as UTF-8 text. The top-level structure is:
  - {"type": "<messageType>", "payload": <object>}
  - Common text message types: `update`, `timer`, `decision`, `database`, `status` (server responses).
- Binary frames: Custom framed binary payloads. Use the WebSocket frame opcode to distinguish: treat only frames where `isBinary === true` as binary frames.

## Binary Frame Format (sender behavior)
- Byte 0..3: 4-byte unsigned integer (big-endian) representing `typeLength` (number of bytes in the following UTF-8 type string). The Java sender uses `ByteBuffer.putInt(...)` (big-endian/network order).
- Byte 4..(4+typeLength-1): UTF-8 bytes of `type` string (e.g., `"translations_zip"`, `"flags_zip"`, `"pictures_zip"`).
- Remaining bytes: binary payload bytes (for this project usually a ZIP archive).
- Receiver must not assume any preceding JSON frame; rely on the WebSocket opcode (`isBinary`) to decide binary handling.

## Message Types & Expected Processing
- Text `database`
  - Format: JSON text frame with `{ "type":"database","payload":{ "databaseChecksum": "<hex>", "database": <object> } }`.
  - Action: Replace or merge local DB; use `databaseChecksum` to detect changes.
- Text `update`
  - Format: `{ "type":"update","payload":{...} }`.
  - Action: Apply UI event updates; may include `database` and `databaseChecksum` for quick sync (on `SwitchGroup`/`GroupDone`).
- Binary `translations_zip`
  - Type string: `"translations_zip"`.
  - Payload: ZIP bytes containing at least `translations.json`.
  - Action: Unzip, parse `translations.json`, validate structure and checksum (see checksum section).
- Binary `flags_zip`
  - Type string: `"flags_zip"`.
  - Payload: ZIP of flag images.
  - Action: Unzip and deploy flags to expected folder or cache; no checksum provided in-band (use local checksum if desired).
- Binary `pictures_zip`
  - Type string: `"pictures_zip"`.
  - Payload: ZIP of pictures.
  - Action: Unzip and store/serve accordingly.

## Parsing Algorithm (high-level)
1. On WebSocket message receive:
   - If `message.isBinary` (or equivalent), treat as binary frame: parse the first 4 bytes as BE uint32 => `typeLength`.
     - Validate: `typeLength` should be > 0 and less than or equal to `(buffer.length - 4)`. If not, error (see troubleshooting).
   - `typeBuf = buffer.slice(4, 4 + typeLength)`; `type = typeBuf.toString('utf8')`.
   - `payloadBuf = buffer.slice(4 + typeLength)`.
   - Route by `type`:
     - `"translations_zip"` -> unzip `payloadBuf` and validate `translations.json`.
     - `"flags_zip"` / `"pictures_zip"` -> unzip and process contents.
     - Unknown type -> log and optionally ignore.
2. If message is text:
   - Parse JSON safely. If parse fails, log and ignore or send error to server.
   - Validate `type` and handle according to type definitions above (e.g., `database`, `update`, `decision`, `status`).
   - If the server sends a `status` object with `statusCode` 428 and a `missing` array, handle (see Missing-Data protocol).

## Missing-Data Request Protocol (server-driven 428)
- Server may respond with a `status` that contains a code `428` and a `missing` array listing requested artifacts (e.g., `{"type":"status","payload":{"statusCode":428,"missing":["database","translations_zip"]}}`).
- Receiver actions:
  - The receiver should verify which artifacts are missing locally and ensure the server's subsequent sends are accepted and validated.
  - If implementing a client that requests server resources, follow the server's missing-data handshake documented in the server API.

## Translations ZIP Format & Checksum Validation
- ZIP must contain `translations.json` at top-level.
- `translations.json` structure example:
  - `{ "locales": { "en": { "key": "value", ... }, "fr": {...} }, "translationsChecksum": "<sha256hex>" }` or direct `{ "en": {...}, "fr": {...}, "translationsChecksum": "..." }`.
- `translationsChecksum` is a server-calculated SHA-256 hex over a deterministic serialization of locale id + keys + values.
- Validation strategy:
  - Prefer reproducing server algorithm (deterministic ordering); otherwise compute a canonical checksum: sort locales by id, sort keys per locale, concatenate locale id + key + value UTF-8 bytes, compute SHA-256 hex.
  - If checksum mismatch: log and optionally request resend; do not silently accept.

## Error Handling & Logging
- Validate every step and return clear logs:
  - Binary parsing errors (too short frame, negative length, typeLength > allowed) => log hex of first 8 bytes and drop frame.
  - Endianness mismatch symptom: unusually large `typeLength` — suspect BE vs LE mismatch or wrong offset.
  - JSON parse errors => log message and content snippet.
  - ZIP extraction errors => log error and payload size/CRC if available.
- Use rate-limited logging for repeated errors to avoid log spam.

## Security & Safety
- Do not execute content from ZIPs. Validate file names (no absolute paths, no `..` sequences). Restrict where files are written.
- Limit maximum accepted binary size to avoid resource exhaustion; if payload exceeds limit, log and request alternate delivery.

## Performance Considerations
- Offload heavy ZIP processing off the main event loop (worker threads or child process) for large archives.
- Cache validated artifacts keyed by checksum to skip reprocessing.

## Tests (recommended)
- Test correct parse: send proper binary frame (4-byte BE length, type, ZIP) and expect translations to process.
- Test endianness/regression: read as LE on receiver to reproduce large typeLength bug.
- Test malformed frames: ensure receiver logs and ignores.

## Minimal Node.js parsing snippet

```js
// on('message', (data, isBinary) => {
//   if (isBinary) {
//     const buf = Buffer.from(data);
//     if (buf.length < 5) throw new Error('Frame too short');
//     const typeLen = buf.readUInt32BE(0);
//     if (typeLen <= 0 || typeLen > buf.length - 4) throw new Error('Invalid type length');
//     const type = buf.slice(4, 4 + typeLen).toString('utf8');
//     const payload = buf.slice(4 + typeLen);
//     // route by type
//   } else {
//     const obj = JSON.parse(data.toString('utf8'));
//     // handle text frame
//   }
// });
```
