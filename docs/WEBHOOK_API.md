# Webhook Connector — API Specification

The `webhook-connector` Supabase Edge Function delivers outbound event payloads from BotForge bots to any user-configured HTTP endpoint. This document describes the full request/response contract, retry behaviour, security model, and how to verify incoming requests on the receiving server.

---

## Table of Contents

1. [Overview](#overview)
2. [Endpoint](#endpoint)
3. [Authentication](#authentication)
4. [Request body](#request-body)
5. [Response codes](#response-codes)
6. [Retry policy](#retry-policy)
7. [Request headers sent to the destination](#request-headers-sent-to-the-destination)
8. [HMAC-SHA256 signature verification](#hmac-sha256-signature-verification)
9. [SSRF protection](#ssrf-protection)
10. [Delivery logging](#delivery-logging)
11. [Error reference](#error-reference)
12. [Examples](#examples)

---

## Overview

```
BotForge platform
      │
      │  POST /functions/v1/webhook-connector
      │  { agentId, webhookUrl, payload, webhookSecret? }
      ▼
webhook-connector Edge Function
      │
      │  POST <webhookUrl>                  ← up to 3 attempts
      │  Content-Type: application/json
      │  X-BotForge-Attempt: 1 | 2 | 3
      │  X-Hub-Signature-256: sha256=<hmac>  ← when webhookSecret provided
      ▼
Your server endpoint
```

The function is called internally by the BotForge platform whenever a bot event should be forwarded to an external system. You can also invoke it directly via the Supabase anon key (see [Examples](#examples)).

---

## Endpoint

```
POST https://<project-ref>.supabase.co/functions/v1/webhook-connector
```

---

## Authentication

Pass the Supabase anon key in the `Authorization` header:

```
Authorization: Bearer <VITE_SUPABASE_ANON_KEY>
```

This key is the public key for the project and is safe to include in frontend code. Server-side row access is guarded separately by the service-role key inside the function.

---

## Request body

```jsonc
{
  "agentId":       "uuid",                                // required — UUID of the agent triggering the event
  "webhookUrl":    "https://your-server.example.com/hook", // required — destination URL (http or https, public only)
  "payload":       { /* any JSON-serialisable object */ }, // required — the event data to deliver
  "webhookSecret": "your-signing-secret"                  // optional — used to sign the request (HMAC-SHA256)
}
```

### Field rules

| Field           | Type   | Required | Constraints                                                                 |
|-----------------|--------|----------|-----------------------------------------------------------------------------|
| `agentId`       | string | Yes      | Must be a non-empty string (UUID format expected)                           |
| `webhookUrl`    | string | Yes      | Must be a valid `http://` or `https://` URL pointing to a public host       |
| `payload`       | any    | Yes      | Must be JSON-serialisable; serialised size must not exceed **1 MB**         |
| `webhookSecret` | string | No       | If provided, the function computes `X-Hub-Signature-256` for the request   |

---

## Response codes

### `200 OK` — delivered successfully

```jsonc
{
  "success": true,
  "message": "Webhook delivered successfully.",
  "attempts": 1,          // number of delivery attempts made (1–3)
  "httpStatus": 200       // HTTP status returned by the destination
}
```

### `400 Bad Request` — validation error

```jsonc
{ "error": "Missing or invalid field: agentId" }
{ "error": "Missing or invalid field: webhookUrl" }
{ "error": "Missing field: payload" }
{ "error": "webhookUrl is not a valid URL." }
{ "error": "webhookUrl must use http or https." }
{ "error": "webhookUrl must not target a private, loopback, or link-local address." }
{ "error": "Payload is not JSON-serialisable." }
{ "error": "Invalid JSON body." }
```

### `405 Method Not Allowed`

```jsonc
{ "error": "Method not allowed. Use POST." }
```

### `413 Payload Too Large`

```jsonc
{ "error": "Payload exceeds the 1 MB limit." }
```

### `502 Bad Gateway` — all delivery attempts failed

```jsonc
{
  "error":          "Webhook delivery failed after 3 attempt(s).",
  "lastError":      "HTTP 503: Service Unavailable",  // or network error message
  "lastHttpStatus": 503,
  "attempts":       3
}
```

---

## Retry policy

The function makes up to **3 delivery attempts** with exponential back-off:

| Attempt | Delay before attempt | Notes                                                     |
|---------|----------------------|-----------------------------------------------------------|
| 1       | none (immediate)     | First try                                                 |
| 2       | 1 000 ms             | Only if attempt 1 failed with a retryable error           |
| 3       | 2 000 ms             | Only if attempt 2 failed with a retryable error           |

Each attempt has a **10-second timeout** (`AbortSignal.timeout`). A network-level timeout counts as a retryable error.

### Retryable vs permanent errors

| Condition                       | Retried? | Reason                                                   |
|---------------------------------|----------|----------------------------------------------------------|
| Network / DNS error             | Yes      | Transient connectivity issue                             |
| Timeout (10 s)                  | Yes      | Server may be temporarily slow                           |
| `5xx` server error              | Yes      | Server-side error that may be transient                  |
| `408 Request Timeout`           | Yes      | Server explicitly asked for retry                        |
| `429 Too Many Requests`         | Yes      | Rate-limited; retry after back-off                       |
| `4xx` (except 408 and 429)      | **No**   | Permanent client error (bad URL, auth failure, etc.)     |
| `2xx`                           | **No**   | Success — loop exits immediately                         |

If any attempt returns `2xx`, delivery is considered successful regardless of the response body.

### Flow diagram

```
attempt 1
    │ success (2xx) ──────────────────────────────► return 200
    │ permanent error (4xx ≠ 408/429) ────────────► return 502
    │ retryable error
    ▼
  wait 1 s
attempt 2
    │ success (2xx) ──────────────────────────────► return 200
    │ permanent error ─────────────────────────────► return 502
    │ retryable error
    ▼
  wait 2 s
attempt 3
    │ success (2xx) ──────────────────────────────► return 200
    │ any error ───────────────────────────────────► return 502
```

---

## Request headers sent to the destination

Every delivery attempt includes these headers:

| Header                  | Value                          | Description                                                    |
|-------------------------|--------------------------------|----------------------------------------------------------------|
| `Content-Type`          | `application/json`             | Always JSON                                                    |
| `User-Agent`            | `BotForge-Webhook/1.0`         | Identifies requests from BotForge                              |
| `X-BotForge-Attempt`    | `1`, `2`, or `3`               | Which attempt this is (useful for idempotency checks)          |
| `X-Hub-Signature-256`   | `sha256=<hex>`                 | Present only when `webhookSecret` is supplied (see below)      |

The request body is the **serialised JSON of `payload`** exactly as received (no wrapper object added).

---

## HMAC-SHA256 signature verification

When `webhookSecret` is provided, the function computes an HMAC-SHA256 digest of the raw request body and sends it as:

```
X-Hub-Signature-256: sha256=<hex-digest>
```

### Verifying the signature on your server

```typescript
// Node.js / Deno example
import { createHmac } from "node:crypto"; // Node.js — or use Web Crypto API in Deno/browser

function verifySignature(
  rawBody: string,
  secret: string,
  signatureHeader: string,
): boolean {
  const expected = "sha256=" +
    createHmac("sha256", secret).update(rawBody).digest("hex");
  return expected === signatureHeader; // use a timing-safe comparison in production
}
```

```python
# Python example
import hmac, hashlib

def verify_signature(raw_body: str, secret: str, header: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), raw_body.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header)
```

**Always compare signatures using a constant-time comparison** (e.g. `hmac.compare_digest` in Python, or the `timingSafeEqual` function in Node.js) to prevent timing attacks.

---

## SSRF protection

The function rejects `webhookUrl` values that target private or internal network addresses. The following patterns are blocked:

| Pattern                     | Example                   | Reason                          |
|-----------------------------|---------------------------|---------------------------------|
| `localhost`                 | `http://localhost/hook`   | Loopback                        |
| `127.x.x.x`                 | `http://127.0.0.1/`       | IPv4 loopback                   |
| `0.0.0.0`                   | `http://0.0.0.0/`         | Null route                      |
| `::1`                       | `http://[::1]/`           | IPv6 loopback                   |
| `10.x.x.x`                  | `http://10.0.0.1/`        | RFC 1918 private                |
| `172.16.x.x–172.31.x.x`    | `http://172.16.0.1/`      | RFC 1918 private                |
| `192.168.x.x`               | `http://192.168.1.1/`     | RFC 1918 private                |
| `169.254.x.x`               | `http://169.254.169.254/` | Link-local / AWS metadata IMDS  |
| `fd…:` (IPv6 ULA)           | `http://[fd00::1]/`       | IPv6 private range              |
| `*.local`                   | `http://my-host.local/`   | mDNS / LAN                      |
| `metadata.google.internal`  |                           | GCP metadata service            |

Requests to a blocked host return `400 Bad Request`:

```jsonc
{ "error": "webhookUrl must not target a private, loopback, or link-local address." }
```

> **Note:** SSRF protection is hostname-based only. DNS rebinding attacks are not prevented at this layer. For production use, consider adding DNS-level protection at your network perimeter.

---

## Delivery logging

After each delivery (success or failure), the function updates the `bot_connectors` table for the `webhook` connector row belonging to the agent:

```jsonc
// bot_connectors row after a successful delivery
{
  "status": "connected",
  "config": {
    "last_delivery_at":   "2026-03-18T12:00:00.000Z",
    "last_webhook_url":   "https://your-server.example.com/hook",
    "last_attempt_count": 1,
    "last_http_status":   200,
    "last_error":         null
  }
}

// bot_connectors row after a failed delivery
{
  "status": "error",
  "config": {
    "last_delivery_at":   "2026-03-18T12:00:00.000Z",
    "last_webhook_url":   "https://your-server.example.com/hook",
    "last_attempt_count": 3,
    "last_http_status":   503,
    "last_error":         "HTTP 503: Service Unavailable"
  }
}
```

Logging failures are non-fatal — the HTTP response to the caller is not affected if the database write fails.

---

## Error reference

| HTTP | Message                                                      | Cause                                            |
|------|--------------------------------------------------------------|--------------------------------------------------|
| 400  | `Invalid JSON body.`                                         | Request body is not valid JSON                   |
| 400  | `Missing or invalid field: agentId`                          | `agentId` absent or not a string                 |
| 400  | `Missing or invalid field: webhookUrl`                       | `webhookUrl` absent or not a string              |
| 400  | `Missing field: payload`                                     | `payload` is `null` or `undefined`               |
| 400  | `webhookUrl is not a valid URL.`                             | URL cannot be parsed                             |
| 400  | `webhookUrl must use http or https.`                         | Non-HTTP protocol (e.g. `ftp://`)                |
| 400  | `webhookUrl must not target a private … address.`            | SSRF guard triggered                             |
| 400  | `Payload is not JSON-serialisable.`                          | `payload` contains circular references or BigInt |
| 405  | `Method not allowed. Use POST.`                              | Request is not `POST`                            |
| 413  | `Payload exceeds the 1 MB limit.`                            | Serialised payload > 1 048 576 bytes             |
| 502  | `Webhook delivery failed after N attempt(s).`                | All retry attempts exhausted                     |

---

## Examples

### Minimal delivery

```bash
curl -X POST \
  https://<project-ref>.supabase.co/functions/v1/webhook-connector \
  -H "Authorization: Bearer <VITE_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId":    "11111111-1111-1111-1111-111111111111",
    "webhookUrl": "https://your-server.example.com/hook",
    "payload":    { "event": "message", "chatId": 987654321, "text": "Hello!" }
  }'
```

**Success response:**

```jsonc
{
  "success": true,
  "message": "Webhook delivered successfully.",
  "attempts": 1,
  "httpStatus": 200
}
```

---

### Delivery with HMAC signing

```bash
curl -X POST \
  https://<project-ref>.supabase.co/functions/v1/webhook-connector \
  -H "Authorization: Bearer <VITE_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId":       "11111111-1111-1111-1111-111111111111",
    "webhookUrl":    "https://your-server.example.com/hook",
    "payload":       { "event": "message", "chatId": 987654321, "text": "Hello!" },
    "webhookSecret": "super-secret-signing-key"
  }'
```

Your server will receive:

```
POST /hook HTTP/1.1
Content-Type: application/json
User-Agent: BotForge-Webhook/1.0
X-BotForge-Attempt: 1
X-Hub-Signature-256: sha256=e3b0c44298fc1c149afb...

{"event":"message","chatId":987654321,"text":"Hello!"}
```

---

### Typical bot event payload

Although `payload` is free-form, the BotForge platform sends structured event objects like:

```jsonc
{
  "event":       "message_received",        // event type
  "agentId":     "11111111-...",
  "botId":       "22222222-...",
  "chatId":      987654321,                 // Telegram chat ID
  "userId":      111222333,                 // Telegram user ID
  "username":    "alice",
  "text":        "What are your prices?",
  "timestamp":   "2026-03-18T12:00:00Z",
  "reply":       "Our pricing starts at..."  // AI reply that was sent
}
```

---

### Failure scenario

```bash
# Destination server is down
curl -X POST \
  https://<project-ref>.supabase.co/functions/v1/webhook-connector \
  -H "Authorization: Bearer <VITE_SUPABASE_ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId":    "11111111-1111-1111-1111-111111111111",
    "webhookUrl": "https://down-server.example.com/hook",
    "payload":    { "event": "test" }
  }'
```

**After 3 attempts (~3 seconds total):**

```jsonc
{
  "error":          "Webhook delivery failed after 3 attempt(s).",
  "lastError":      "fetch failed",
  "lastHttpStatus": null,
  "attempts":       3
}
```
