# Logos ZIP Binary Message Implementation for OWLCMS

## Overview

Implement support for sending team/federation logos as a binary ZIP archive (`logos_zip`) over WebSocket to the OWLCMS tracker, similar to the existing `flags_zip` implementation.

## Implementation Pattern (Based on Flags)

The logos implementation follows the exact same pattern as flags. See the existing flags implementation in OWLCMS:

- **File**: `WebSocketEventForwarder.java` or `WebSocketSender.java`
- **Pattern**: `FlagsZipHelper.createFlagsZipBytes()` → `sender.sendBinary("flags_zip", zipBytes)`

## Required Changes in OWLCMS

### 1. Create LogosZipHelper Class

Similar to `FlagsZipHelper`, create a new helper class:

**Location**: `app/owlcms/monitors/websocket/` or `app/owlcms/monitors/` 

**Class**: `LogosZipHelper.java`

**Implementation**:
```java
public class LogosZipHelper {
    
    /**
     * Create a ZIP archive containing all team/federation logos
     * @return byte array of ZIP file, or empty array if no logos available
     */
    public static byte[] createLogosZipBytes() {
        try {
            // Get logos from configuration directory
            // Typical location: /logos or /resources/logos
            // File naming: <team-name>.png or <logo-id>.png
            
            ZipOutputStream zos = new ZipOutputStream(new ByteArrayOutputStream());
            
            // Add logo files to ZIP
            // For each logo file:
            //   - ZipEntry entry = new ZipEntry(filename)
            //   - zos.putNextEntry(entry)
            //   - zos.write(fileBytes)
            //   - zos.closeEntry()
            
            zos.close();
            return baos.toByteArray();
        } catch (Exception e) {
            logger.error("Failed to create logos ZIP", e);
            return new byte[0];
        }
    }
}
```

### 2. Add sendLogos Method to WebSocketSender

Add a new method to `WebSocketSender.java` (alongside existing `sendFlags`):

```java
/**
 * Send all team logos as a zipped binary archive via WebSocket
 */
public void sendLogos(String url) {
    logger.debug("{}sendLogos called for url: {}", FieldOfPlay.getLoggingName(fop), url);

    if (url == null) {
        logger.error("cannot send logos, url is null");
        return;
    }

    // Check if URL is WebSocket
    if (url.startsWith("ws://") || url.startsWith("wss://")) {
        WebSocketEventSender sender = WebSocketEventSender.getOrCreate(url);
        if (sender != null) {
            byte[] logosZipBytes = LogosZipHelper.createLogosZipBytes();
            if (logosZipBytes.length > 0) {
                boolean sent = sender.sendBinary("logos_zip", logosZipBytes);
                if (sent) {
                    logger.debug("{}sent logos_zip ZIP via WebSocket binary to {} ({} bytes)",
                            FieldOfPlay.getLoggingName(fop), url, logosZipBytes.length);
                } else {
                    logger.debug("{}could not send logos_zip ZIP via WebSocket to {} (socket not ready)",
                            FieldOfPlay.getLoggingName(fop), url);
                }
            } else {
                logger.debug("{}failed to create logos ZIP for {}", FieldOfPlay.getLoggingName(fop), url);
            }
        }
        return;
    }

    logger.debug("{}HTTP endpoint for logos not implemented ({})", FieldOfPlay.getLoggingName(fop), url);
}
```

### 3. Call sendLogos During Initial Handshake

In `WebSocketEventForwarder` or the connection initialization code, after sending database/flags/translations, add:

```java
// Send logos along with flags and translations on connection startup
sender.sendLogos(url);
```

**Typical location**: Same method that calls `sendFlags()` and `sendTranslations()` on socket open.

### 4. Update sendBinary Method (if needed)

Ensure the existing `sendBinary()` method supports the new message type:

```java
boolean sent = sender.sendBinary("logos_zip", logosZipBytes);
```

If not already generic, update it to handle any message type string (not just specific types).

## Tracker Side (Already Implemented)

The tracker automatically supports logos_zip and will:

1. **Receive** binary frames with type `"logos_zip"`
2. **Extract** all files to `/local/logos/` directory
3. **Log** statistics: `[LOGOS] ✓ Extracted 42 logo files`
4. **Mark as ready**: `competitionHub.markLogosLoaded()`
5. **Include in preconditions**: Will request `logos_zip` if not received (428 Precondition Required)

## Message Format

**WebSocket Binary Frame Format**:

```
[4 bytes: typeLength (big-endian)] [typeLength bytes: UTF-8 type] [ZIP payload]

Example for logos_zip (9 bytes):
[00 00 00 09] [6c 6f 67 6f 73 5f 7a 69 70] [50 4B 03 04 ... ZIP data ...]
```

**Binary Frame via JavaScript** (for testing):
```javascript
const typeString = "logos_zip";
const header = Buffer.alloc(4);
header.writeUInt32BE(typeString.length, 0);
const message = Buffer.concat([
  header,
  Buffer.from(typeString, 'utf8'),
  zipFileBuffer
]);
socket.send(message);
```

## Preconditions Tracking

The tracker tracks `logos_zip` as a precondition. If not received, it will respond with **428 Precondition Required**:

```json
{
  "status": 428,
  "missing": ["logos_zip"],
  "message": "Precondition Required: Missing required data"
}
```

When OWLCMS receives a 428 with `"logos_zip"` in the missing array, it should send the logos ZIP binary frame.

## Testing

### 1. Verify Extraction
Check logs for:
```
[LOGOS] Starting extraction of XXXX bytes
[LOGOS] ✓ Extracted 42 logo files in 45ms
[LOGOS] First 10 logos from this message:
  1. USA.png
  2. CAN.png
  3. MEX.png
...
[Sanity] ✅ Logos: 42 total files in /local/logos
```

### 2. Verify Files
Check that files exist in: `./local/logos/`

### 3. Verify Preconditions
Before logos are sent, tracker should respond with 428:
```json
{ "missing": ["logos_zip"] }
```

After logos are sent and processed:
```json
{ "status": 200 }
```

## References

- **Tracker Documentation**: [WEBSOCKET_MESSAGE_SPEC.md](./docs/WEBSOCKET_MESSAGE_SPEC.md)
- **Existing Implementation**: FlagsZipHelper and sendFlags() in OWLCMS
- **Usage in Tracker**: `/local/logos/<team-name>.png`

## Example File Structure

After receiving logos_zip, tracker will have:
```
local/logos/
  ├── USA.png
  ├── CAN.png
  ├── MEX.png
  ├── BRA.png
  └── ... (all team logos)
```

Scoreboards can reference via:
```html
<img src="/local/logos/USA.png" alt="USA Logo" />
```

## Similar Implementations in OWLCMS

- **Flags**: `FlagsZipHelper.createFlagsZipBytes()` → `sendBinary("flags_zip", ...)`
- **Translations**: `TranslationsZipHelper.createTranslationsZip()` → `sendBinary("translations_zip", ...)`
- **Pictures**: `PicturesZipHelper.createPicturesZipBytes()` → `sendBinary("pictures", ...)`

**Follow the same pattern for logos.**
