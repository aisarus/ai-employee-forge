# BotForge

**BotForge** is a no-code SaaS platform for building, configuring, and deploying AI-powered Telegram bots. Connect your OpenAI API key (BYOK), write a system prompt, and have a live bot in minutes — no backend coding required.

---

## Table of Contents

1. [What is BotForge?](#what-is-botforge)
2. [Architecture](#architecture)
3. [Create Your First Bot (5 Steps)](#create-your-first-bot-5-steps)
4. [Webhook API](#webhook-api)
5. [Edge Function Reference](#edge-function-reference)
6. [Database Schema](#database-schema)
7. [Tech Stack](#tech-stack)
8. [Environment Variables](#environment-variables)
9. [Local Development](#local-development)
10. [Security](#security)

---

## What is BotForge?

BotForge turns a Telegram bot token and an OpenAI API key into a fully functional AI assistant. Every bot:

- Replies to messages using GPT-4o-mini (your key) with automatic fallback to the platform's AI gateway.
- Maintains per-chat conversation history (last 30 turns).
- Sends a configurable welcome message and quick-action buttons on `/start`.
- Can forward events to your own endpoint via the **Webhook Connector**.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      User Browser                           │
│          React 18 + TypeScript + Vite + Tailwind CSS        │
│                                                             │
│  ┌──────────────┐  ┌─────────────────┐  ┌───────────────┐  │
│  │  Auth pages  │  │  Bot wizard /   │  │  My Agents    │  │
│  │  (login/    │  │  Deploy wizard  │  │  (list/edit/  │  │
│  │   signup)   │  │                 │  │   delete)     │  │
│  └──────┬───────┘  └────────┬────────┘  └───────┬───────┘  │
└─────────┼───────────────────┼────────────────────┼─────────┘
          │  Supabase JS SDK  │                    │
          ▼                   ▼                    ▼
┌──────────────────────────────────────────────────────────────┐
│                      Supabase Platform                       │
│                                                              │
│  ┌──────────────┐   ┌──────────────────────────────────────┐ │
│  │  Auth        │   │  PostgreSQL + RLS                    │ │
│  │  (JWT/magic  │   │  agents · bots · bot_chat_history    │ │
│  │   link)      │   │  bot_connectors · profiles           │ │
│  └──────────────┘   └──────────────────────────────────────┘ │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Edge Functions (Deno runtime)                        │   │
│  │                                                       │   │
│  │  deploy-telegram    — register webhook with Telegram  │   │
│  │  telegram-webhook   — receive & respond to messages   │   │
│  │  webhook-connector  — deliver events to user endpoint │   │
│  │  llm-proxy          — AI gateway proxy               │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
          │                             │
          ▼                             ▼
  ┌───────────────┐           ┌──────────────────────┐
  │  Telegram     │           │  OpenAI / Lovable AI  │
  │  Bot API      │           │  (BYOK or fallback)   │
  └───────────────┘           └──────────────────────┘
```

### Request flow for an incoming Telegram message

```
User sends message in Telegram
        │
        ▼
Telegram Bot API
        │  POST /functions/v1/telegram-webhook/<botId>
        │  Header: X-Telegram-Bot-Api-Secret-Token: <secret>
        ▼
telegram-webhook Edge Function
        │
        ├─ 1. Verify webhook secret
        ├─ 2. Parse update (message / callback_query)
        ├─ 3. Handle /start (welcome message + keyboard)
        ├─ 4. Deduplicate by telegram_update_id
        ├─ 5. Store user message → bot_chat_history
        ├─ 6. Load last 30 turns → LLM context
        ├─ 7. Call OpenAI BYOK  ──► on error ──► Lovable AI fallback
        ├─ 8. Send reply via Telegram sendMessage
        └─ 9. Store assistant reply → bot_chat_history
```

---

## Create Your First Bot (5 Steps)

### Step 1 — Sign up and open the wizard

Create an account and click **Create new bot** to launch the step-by-step wizard.

### Step 2 — Name your bot and write a system prompt

Give your bot a display name and write the system prompt that defines its personality and capabilities (e.g. *"You are a helpful customer support agent for Acme Corp."*).

### Step 3 — Paste your OpenAI API key

Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys), create a key, and paste it in the **API Keys** step. The key is encrypted with AES-256-GCM before being stored.

### Step 4 — Connect your Telegram bot token

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot` and follow the prompts.
3. Copy the token BotFather gives you and paste it into the **Telegram Config** step.

### Step 5 — Deploy

Click **Deploy**. BotForge registers a webhook with Telegram automatically. Your bot is now live — open it in Telegram and say hello.

---

## Webhook API

BotForge exposes three HTTP endpoints via Supabase Edge Functions.

### Base URL

```
https://<project-ref>.supabase.co/functions/v1
```

---

### POST /telegram-webhook/:botId

Receives incoming Telegram updates for a deployed bot. **This endpoint is called by Telegram, not by you.**

#### URL parameters

| Parameter | Type   | Description                           |
|-----------|--------|---------------------------------------|
| `botId`   | UUID   | The `bots.id` value assigned on deploy |

#### Request headers

| Header                              | Required | Description                                    |
|-------------------------------------|----------|------------------------------------------------|
| `X-Telegram-Bot-Api-Secret-Token`   | Yes      | Must match the `webhook_secret` stored for this bot |

#### Request body (Telegram Update object)

```jsonc
{
  "update_id": 123456789,
  "message": {
    "message_id": 42,
    "chat": { "id": 987654321, "type": "private" },
    "from": { "id": 111222333, "username": "alice" },
    "text": "Hello!"
  }
}
```

Or a `callback_query` for inline keyboard button presses:

```jsonc
{
  "update_id": 123456790,
  "callback_query": {
    "id": "cq_abc123",
    "data": "option_a",
    "message": { "chat": { "id": 987654321 }, "message_id": 41 }
  }
}
```

#### Response

Always `200 OK` with `{"ok": true}` — even on handled errors — so Telegram does not retry the update.

```jsonc
{ "ok": true }
```

#### Special commands

| Command  | Behavior                                                          |
|----------|-------------------------------------------------------------------|
| `/start` | Sends `welcome_message` (or default greeting) + `starter_buttons` keyboard. Does **not** invoke the LLM. |

#### AI fallback chain

```
1. BYOK OpenAI key (gpt-4o-mini, 20 s timeout)
        │ on error / timeout / rate-limit
        ▼
2. Lovable AI gateway (Gemini 2.0 Flash, 20 s timeout)
        │ on error
        ▼
3. bot.fallback_message  (or built-in "AI temporarily unavailable" message)
```

---

### POST /deploy-telegram

Validates a Telegram token, creates or updates the bot record, and registers the webhook with Telegram.

#### Authentication

```
Authorization: Bearer <supabase-user-jwt>
```

#### Request body

```jsonc
{
  "agentId":        "uuid",           // required — must belong to the calling user
  "telegramToken":  "123456:ABC...",  // required — Telegram bot token
  "openaiApiKey":   "sk-...",         // optional — BYOK key; null = platform fallback
  "systemPrompt":   "You are...",     // optional
  "welcomeMessage": "👋 Hello!",      // optional
  "fallbackMessage":"AI unavailable", // optional
  "starterButtons": [                 // optional — up to 6 items
    { "text": "Get started" },
    { "text": "Help" }
  ]
}
```

#### Response `200 OK`

```jsonc
{
  "ok": true,
  "botId": "uuid",
  "webhookUrl": "https://<project>.supabase.co/functions/v1/telegram-webhook/<botId>",
  "webhookInfo": { /* Telegram getWebhookInfo response */ },
  "botInfo": { /* Telegram getMe response */ }
}
```

#### Error responses

| HTTP | Code                          | Meaning                                       |
|------|-------------------------------|-----------------------------------------------|
| 401  | `deploy_error.tg_unauthorized` | Invalid or revoked Telegram token             |
| 409  | `deploy_error.tg_conflict`     | Token already used in another Telegram project|
| 429  | `deploy_error.tg_rate_limit`   | Telegram API rate limit; retry after a few seconds |
| 500  | `deploy_error.webhook_failed`  | `setWebhook` call to Telegram failed          |

---

### POST /webhook-connector

Delivers an event payload to a user-configured HTTP endpoint with automatic retries. See [docs/WEBHOOK_API.md](docs/WEBHOOK_API.md) for the full specification, retry behaviour, HMAC signing details, and SSRF protection.

#### Authentication

```
Authorization: Bearer <supabase-anon-key>
```

#### Request body

```jsonc
{
  "agentId":    "uuid",                              // required
  "webhookUrl": "https://your-server.example.com/hook", // required
  "payload":    { /* any JSON object */ }            // required
}
```

#### Response `200 OK`

```jsonc
{ "success": true, "message": "Delivered on attempt 1" }
```

#### Response `502 Bad Gateway` (all retries exhausted)

```jsonc
{
  "error":          "All delivery attempts failed",
  "lastError":      "connect ECONNREFUSED",
  "lastHttpStatus": 502
}
```

#### Retry policy

| Attempt | Delay before attempt |
|---------|----------------------|
| 1       | immediately          |
| 2       | 1 second             |
| 3       | 2 seconds            |

A `2xx` response is considered success. Any other status code or network error triggers the next attempt. After all attempts fail the connector row in `bot_connectors` is updated to `status = 'error'`.

#### Trigger manually

```bash
curl -X POST https://<project>.supabase.co/functions/v1/webhook-connector \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId":    "your-agent-uuid",
    "webhookUrl": "https://your-server.example.com/hook",
    "payload":    { "hello": "world" }
  }'
```

---

## Edge Function Reference

| Function            | Path                                    | Auth            | Description                                  |
|---------------------|-----------------------------------------|-----------------|----------------------------------------------|
| `telegram-webhook`  | `POST /functions/v1/telegram-webhook/:botId` | Telegram secret | Receive & process Telegram updates           |
| `deploy-telegram`   | `POST /functions/v1/deploy-telegram`    | User JWT        | Deploy/update a bot and register webhook     |
| `webhook-connector` | `POST /functions/v1/webhook-connector`  | Anon key        | Deliver event payload to external endpoint  |
| `llm-proxy`         | `POST /functions/v1/llm-proxy`          | Anon key        | Proxy requests to OpenAI-compatible APIs     |

---

## Database Schema

All tables have Row-Level Security (RLS) enabled. Users can only access rows they own.

### `profiles`

Automatically created when a user signs up.

| Column         | Type        | Description                     |
|----------------|-------------|---------------------------------|
| `id`           | UUID (PK)   | Mirrors `auth.users.id`         |
| `email`        | TEXT        |                                 |
| `display_name` | TEXT        |                                 |
| `created_at`   | TIMESTAMPTZ |                                 |

### `agents`

Top-level bot configuration object owned by a user.

| Column             | Type        | Description                                   |
|--------------------|-------------|-----------------------------------------------|
| `id`               | UUID (PK)   |                                               |
| `user_id`          | UUID (FK)   | Owner (`auth.users.id`) — indexed             |
| `name`             | TEXT        | Display name                                  |
| `system_prompt`    | TEXT        | LLM system prompt                             |
| `telegram_token`   | TEXT        | Telegram bot token                            |
| `openai_api_key`   | TEXT        | BYOK OpenAI key (encrypt in production)       |
| `is_active`        | BOOLEAN     |                                               |
| `platform`         | TEXT        | `'telegram'` or `'none'`                      |
| `created_at`       | TIMESTAMPTZ |                                               |
| `updated_at`       | TIMESTAMPTZ | Auto-updated via trigger                      |

### `bots`

Runtime configuration for a deployed Telegram bot. Created / updated by `deploy-telegram`.

| Column             | Type        | Description                                          |
|--------------------|-------------|------------------------------------------------------|
| `id`               | UUID (PK)   |                                                      |
| `user_id`          | UUID (FK)   | Owner — indexed                                      |
| `agent_id`         | UUID (FK)   | One-to-one link to `agents` (unique, nullable) — indexed |
| `name`             | TEXT        |                                                      |
| `system_prompt`    | TEXT        | Cached from `agents.system_prompt` at deploy time    |
| `telegram_token`   | TEXT        | Telegram bot token — indexed                         |
| `openai_api_key`   | TEXT        | BYOK key                                             |
| `webhook_secret`   | TEXT        | Random 32-byte hex; sent in `X-Telegram-Bot-Api-Secret-Token` |
| `is_active`        | BOOLEAN     |                                                      |
| `welcome_message`  | TEXT        | Sent on `/start`                                     |
| `fallback_message` | TEXT        | Sent when AI is unavailable                          |
| `starter_buttons`  | JSONB       | Array of `{ text: string }` objects                  |
| `created_at`       | TIMESTAMPTZ |                                                      |
| `updated_at`       | TIMESTAMPTZ | Auto-updated via trigger                             |

### `bot_chat_history`

Conversation messages for each (bot, Telegram chat) pair. Used to build LLM context.

| Column               | Type        | Description                                      |
|----------------------|-------------|--------------------------------------------------|
| `id`                 | UUID (PK)   |                                                  |
| `bot_id`             | UUID (FK)   | Parent bot — indexed with `chat_id` and `created_at` |
| `chat_id`            | BIGINT      | Telegram chat ID                                 |
| `role`               | TEXT        | `'user'` or `'assistant'`                        |
| `content`            | TEXT        | Message text                                     |
| `telegram_update_id` | BIGINT      | Telegram `update_id`; used for deduplication — indexed |
| `created_at`         | TIMESTAMPTZ |                                                  |

**Indexes:** `(bot_id, chat_id, created_at DESC)` · `(bot_id, telegram_update_id)`

### `bot_connectors`

External integrations (Google Sheets, Airtable, custom webhook, etc.) linked to an agent.

| Column           | Type     | Description                                                   |
|------------------|----------|---------------------------------------------------------------|
| `id`             | UUID (PK)|                                                               |
| `agent_id`       | UUID (FK)| Parent agent — indexed                                        |
| `user_id`        | UUID (FK)| Owner — indexed                                               |
| `connector_type` | TEXT     | `'google_sheets'` · `'airtable'` · `'webhook'` · etc.        |
| `display_name`   | TEXT     |                                                               |
| `status`         | TEXT     | `'connected'` · `'disconnected'` · `'error'` · `'pending'`   |
| `auth_value`     | TEXT     | Encrypted with AES-256-GCM (client-side)                      |
| `capabilities`   | TEXT[]   | `['read', 'write']`                                           |
| `config`         | JSONB    | Connector-specific config (spreadsheet ID, range, etc.)       |
| `created_at`     | TIMESTAMPTZ |                                                            |
| `updated_at`     | TIMESTAMPTZ | Auto-updated via trigger                                  |

---

## Tech Stack

| Layer         | Technology                                              |
|---------------|---------------------------------------------------------|
| Frontend      | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui     |
| State / data  | TanStack Query, React Hook Form, Zod                    |
| Backend / DB  | Supabase (Postgres + Auth + Storage + RLS)              |
| Edge Functions| Deno (Supabase Edge Runtime)                            |
| AI            | OpenAI GPT-4o-mini (BYOK) · Lovable AI gateway (fallback) |
| Telegram      | Bot API webhooks via `deploy-telegram` Edge Function    |
| Client crypto | Web Crypto API — AES-256-GCM + PBKDF2 key derivation   |
| Testing       | Vitest (unit) · Playwright (E2E)                        |

---

## Environment Variables

### Frontend (`.env`)

| Variable                    | Required | Description                             |
|-----------------------------|----------|-----------------------------------------|
| `VITE_SUPABASE_URL`         | Yes      | Your Supabase project URL               |
| `VITE_SUPABASE_ANON_KEY`    | Yes      | Supabase anon/public key                |

### Edge Functions (Supabase Secrets)

Set via `supabase secrets set KEY=value` or the Supabase dashboard.

| Secret                      | Required | Description                                    |
|-----------------------------|----------|------------------------------------------------|
| `SUPABASE_URL`              | Auto     | Injected automatically by Supabase             |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto     | Injected automatically by Supabase             |
| `LOVABLE_API_KEY`           | Yes      | API key for the Lovable AI fallback gateway    |
| `ALLOWED_ORIGIN`            | No       | Allowed CORS origin for the webhook-connector (defaults to `localhost`) |

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
# then edit .env with your Supabase project URL and anon key
```

---

## Local Development

```bash
# Install dependencies
bun install

# Start the dev server (http://localhost:8080)
bun run dev

# Run unit tests
bun run test

# Run E2E tests (requires Playwright browsers)
bunx playwright test

# Serve Edge Functions locally (requires Supabase CLI)
supabase functions serve
```

### Supabase CLI setup

```bash
# Install the Supabase CLI (if not already installed)
brew install supabase/tap/supabase   # macOS
# or: https://supabase.com/docs/guides/cli/getting-started

# Link to your project
supabase link --project-ref <project-ref>

# Push database migrations
supabase db push

# Deploy all Edge Functions
supabase functions deploy
```

---

## Security

### Webhook authentication

Every incoming Telegram update is authenticated via the `X-Telegram-Bot-Api-Secret-Token` header. The secret is a random 32-byte hex string generated at deploy time and stored in `bots.webhook_secret`. Requests that fail this check are rejected with `401`.

### Row-Level Security

All database tables have RLS enabled. Users can only read, insert, update, or delete rows they own (matched by `user_id = auth.uid()`). The `telegram-webhook` Edge Function uses a service-role key specifically to bypass RLS for system-level reads.

### Encryption

Connector credentials (`bot_connectors.auth_value`) are encrypted client-side with AES-256-GCM using a PBKDF2-derived key before being sent to the database.

### API key storage

OpenAI BYOK keys are stored in the database. For production deployments, consider encrypting them at rest using Postgres column encryption or Vault.

### Rate limiting

The Edge Functions do not currently implement per-IP or per-bot rate limiting. For production workloads, add rate limiting at the Supabase or reverse-proxy layer.

---

## License

MIT © BotForge contributors
