# Performance Optimization Impact Analysis

## Proposed Optimizations

### 1. Direct SSE Processing for Timer/Decision Events
- Timer and decision events sent as SSE payloads (no API fetch)
- Language-independent data (no translation needed)
- High frequency: ~60 timer events per minute during active lifting

### 2. Cached Compressed JSON for API Responses
- Pre-serialize JSON once per cache entry
- Pre-compress with gzip and brotli
- Serve 200 browsers from single cached compressed payload

---

## Network Bandwidth Impact Analysis

### Test Environment
- **Competition:** 5 FOPs (A, B, C, D, E)
- **Browsers:** 200 concurrent connections
  - 120 browsers: FOP A, English
  - 40 browsers: FOP B, Spanish
  - 20 browsers: FOP C, English
  - 10 browsers: FOP D, English
  - 10 browsers: FOP E, Spanish
- **Scoreboard types:** 2 (lifting-order, standard)
- **Languages:** 2 (en, es)
- **Variations:** 2 per language (showRecords true/false)
- **Cache entries:** 40 total (5 FOPs × 4 variations × 2 types)

### Message Sizes (Measured from samples/)

**UPDATE message (athlete lifts, weight changes):**
- Raw JSON: 27 KB
- Gzip: 5 KB (5.4:1 ratio)
- Brotli: 4 KB (6.75:1 ratio)

**Timer event (StartTime/StopTime/SetTime):**
- Minimal payload: ~200 bytes
- Compressed: ~150 bytes (negligible)

**Decision event (referee decisions):**
- Minimal payload: ~400 bytes
- Compressed: ~300 bytes (negligible)

---

## Current Architecture Network Usage

### Per Update Cycle (Athlete Lifts)

**SSE broadcast (notification only):**
- Payload size: ~100 bytes (JSON notification)
- Browsers: 200
- **Total:** 200 × 100 bytes = **20 KB**

**API fetch (all 200 browsers):**
- Uncompressed JSON: 27 KB per response
- Total: 200 × 27 KB = **5.4 MB**
- With gzip: 200 × 5 KB = **1 MB**
- With brotli: 200 × 4 KB = **0.8 MB**

**Current total (with compression enabled):**
- SSE: 20 KB
- API: 1 MB (gzip) or 0.8 MB (brotli)
- **Total: ~1 MB per update**

### Per Lifting Cycle

**Realistic lifting frequency:**
- One lift every 80 seconds (1 minute 20 seconds)
- 0.75 lifts per minute

**Events per lift:**
- Timer events: 3-4 (start, maybe 1-2 stops/restarts, final stop)
- Decision events: 3 (down signal, full decision, reset)

**Events per minute:**
- Timer: ~3 events/minute
- Decision: ~2.25 events/minute

**SSE broadcast (notification only):**
- Timer: 3 × 200 × 100 bytes = 60 KB/minute
- Decision: 2.25 × 200 × 100 bytes = 45 KB/minute
- **Total: 105 KB/minute**

**API fetch (triggered by SSE):**
- Timer: 3 × 200 × 4 KB (brotli) = 2.4 MB/minute
- Decision: 2.25 × 200 × 4 KB (brotli) = 1.8 MB/minute
- **Total: 4.2 MB/minute**

**Current total per minute:**
- **~4.3 MB/minute**

---

## Optimized Architecture Network Usage

### Change 1: Timer Events via SSE Payload (No API Fetch)

**SSE broadcast with timer data:**
- Payload: 200 bytes (timer state)
- Browsers: 200
- **Total per event:** 200 × 200 bytes = **40 KB**

**Per minute (3 timer events):**
- 3 × 40 KB = **120 KB/minute**

**Savings:**
- Current: 2.4 MB/minute
- Optimized: 120 KB/minute
- **Reduction: 95%**

### Change 2: Decision Events via SSE Payload (No API Fetch)

**SSE broadcast with decision data:**
- Payload: 400 bytes (decision state)
- Browsers: 200
- **Total per event:** 200 × 400 bytes = **80 KB**

**Per minute (2.25 decision events):**
- 2.25 × 80 KB = **180 KB/minute**

**Savings:**
- Current: 1.8 MB/minute
- Optimized: 180 KB/minute
- **Reduction: 90%**

### Change 3: Cached Compressed JSON for UPDATE Events

**With pre-compressed cache:**
- First browser: Compute + serialize + compress once
- Remaining 199 browsers: Serve same pre-compressed buffer

**No bandwidth change** (same 200 × 4 KB = 0.8 MB)
- But eliminates 199 redundant serializations + compressions
- Reduces server CPU, not bandwidth

---

## Combined Bandwidth Impact

### Active Lifting Session (1 minute)

**Current architecture:**
- SSE notifications: 105 KB
- Timer API fetches: 2.4 MB (brotli)
- Decision API fetches: 1.8 MB (brotli)
- Update API fetches: 0.8 MB (brotli)
- **Total: ~5.1 MB/minute**

**Optimized architecture:**
- Timer SSE (with payload): 120 KB
- Decision SSE (with payload): 180 KB
- Update API (compressed cache): 0.8 MB
- **Total: ~1.1 MB/minute**

**Per-minute savings:**
- **4.0 MB reduction (78%)**

---

## Hourly and Daily Projections

### Competition Day (8 hours active lifting)

**Current architecture:**
- 5.1 MB/minute × 60 minutes × 8 hours = **2.45 GB/day**

**Optimized architecture:**
- 1.1 MB/minute × 60 minutes × 8 hours = **0.53 GB/day**

**Daily savings:**
- **1.92 GB reduction (78%)**

---

## Bandwidth by Event Type

### Current (Per 200 Browsers)

| Event Type | Frequency | Size Each | Total/Minute |
|------------|-----------|-----------|--------------|
| Timer (SSE + API) | 3/min | 800 KB | 2.4 MB |
| Decision (SSE + API) | 2.25/min | 800 KB | 1.8 MB |
| Update (SSE + API) | 0.75/min | 800 KB | 0.6 MB |
| **Total** | | | **4.8 MB** |

### Optimized (Per 200 Browsers)

| Event Type | Frequency | Size Each | Total/Minute |
|------------|-----------|-----------|--------------|
| Timer (SSE only) | 3/min | 40 KB | 120 KB |
| Decision (SSE only) | 2.25/min | 80 KB | 180 KB |
| Update (API compressed) | 0.75/min | 800 KB | 0.6 MB |
| **Total** | | | **0.9 MB** |

### Bandwidth Reduction by Event

| Event Type | Current | Optimized | Reduction |
|------------|---------|-----------|-----------|
| Timer | 2.4 MB/min | 120 KB/min | **95.0%** |
| Decision | 1.8 MB/min | 180 KB/min | **90.0%** |
| Update | 0.6 MB/min | 0.6 MB/min | 0% |
| **Total** | **4.8 MB/min** | **0.9 MB/min** | **81.3%** |

---

## Network Impact Summary

**Per minute (active lifting, realistic frequency):**
- Current: 4.8 MB
- Optimized: 0.9 MB
- **Savings: 3.9 MB (81.3%)**

**Per competition day (8 hours):**
- Current: 2.45 GB
- Optimized: 0.53 GB
- **Savings: 1.92 GB (78%)**

**Primary savings:** Eliminating API fetches for timer and decision events (combined 87% of total traffic).
