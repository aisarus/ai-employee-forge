# BotForge Full Audit Report

**Date:** 2026-03-16
**Auditor:** Claude Sonnet 4.6 (automated)
**Overall Status:** ~70% production-ready — core wizard flow works, but significant gaps in security, real integrations, and observability.

---

## Executive Summary

BotForge is a SaaS Telegram bot constructor with a visual wizard, AI-powered prompt generation, and BYOK (Bring Your Own Key) OpenAI support. The happy path (describe → generate → deploy to Telegram) works. However, connector integrations are stubs, credentials are stored in plaintext, edge functions have timeout risks, and large swaths of the Advanced Wizard UI have no backend wiring.

---

## 1. Wizard Components (`src/components/wizard/`)

### ✅ What Works
- 5-step Quick Start flow: describe → brain_preview → identity → api_key → deploy
- `localStorage` state persistence with `Reset` button
- Telegram token format + live API validation (`getMe`)
- Avatar upload with circular crop (256×256 PNG → Supabase Storage)
- OpenAI key prefix check (`sk-`)
- Real-time progress indicators / step locking (`canNext`)
- Language selector (full list)

### ❌ Broken / Incomplete
| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| W1 | `StepConnections.tsx` — Google Sheets "test connection" always passes if key+ID exist; no real API call | CRITICAL | 3h |
| W2 | `StepActionsData.tsx` — no validation that ≥1 action is selected before proceeding | HIGH | 1h |
| W3 | `StepDataMapping.tsx` — mapping rules saved in memory only, never persisted to DB | HIGH | 4h |
| W4 | `StepWorkflowLogic.tsx` — workflow steps/rules stored in memory only, no backend | HIGH | 8h |
| W5 | `StepTriggers.tsx` — trigger config never sent to DB or executed | HIGH | 4h |
| W6 | Brain generation has no overall timeout; `tri-tfm` errors only log `console.error` | HIGH | 2h |
| W7 | `QuickStartWizard.tsx:282` — `deployRes?.botInfo` treated as non-null | MEDIUM | 30m |
| W8 | `StepConnections.tsx:252` — `connectorDef` type uses long inline `typeof` instead of named type | LOW | 30m |

### 🔲 Missing Entirely
- No real backend execution for Airtable, Shopify, WooCommerce, SMTP connectors — UI exists, zero logic
- No "save draft" of Advanced Wizard to resume later
- No skeleton/loading state while StepConnections loads saved connectors

---

## 2. Pages (`src/pages/`)

### `MyAgents.tsx`
| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| P1 | No loading state while fetching agents list (blank screen flash) | HIGH | 1h |
| P2 | **Edit** menu item exists but triggers nothing | HIGH | 2h |
| P3 | **Test** menu item not implemented | MEDIUM | 2h |
| P4 | No pagination — loads all agents (breaks at scale) | MEDIUM | 3h |
| P5 | No empty-state illustration + CTA when user has zero bots | MEDIUM | 1h |
| P6 | No error boundary — unhandled Supabase error crashes page | HIGH | 1h |
| P7 | No archived/soft-deleted agents view | LOW | 2h |

### `Index.tsx`
| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| P8 | Advanced loading animation has no timeout; hangs if tri-tfm fails | HIGH | 1h |
| P9 | `localStorage.getItem("userOpenAiKey")` used without validation | MEDIUM | 1h |
| P10 | No "unsaved changes" warning when switching wizard modes | LOW | 1h |

### `Auth.tsx`
| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| P11 | No password-reset link on login screen | HIGH | 1h |
| P12 | No email-confirmation-pending UI | MEDIUM | 1h |
| P13 | Generic error messages (no user-friendly copy) | MEDIUM | 1h |
| P14 | No password strength meter | LOW | 2h |

---

## 3. Hooks & Utilities (`src/hooks/`, `src/lib/`)

### `useConnectors.ts`
| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| H1 | `auth_value` stored **plaintext** in `bot_connectors` table — migration comment says "encrypt in production" but it's not done | **CRITICAL** | 4h |
| H2 | No error propagation from `createConnector` to UI — silent failure | HIGH | 1h |

### `useAuth.tsx`
- Works correctly; session persistence and sign-out are good.

---

## 4. Supabase Integrations (`src/integrations/supabase/`)

- Client config is correct (env vars, token auto-refresh).
- RLS policies enforce per-user data isolation — good.

| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| I1 | No rate limiting on any edge function call | HIGH | 4h |
| I2 | No audit log for auth events | MEDIUM | 2h |
| I3 | No soft-delete on `agents` or `bots` (hard delete loses data) | MEDIUM | 2h |

---

## 5. Edge Functions (`supabase/functions/`)

### 5a. `telegram-webhook/index.ts`

**Status: 75% complete**

#### ✅ What Works
- `X-Telegram-Bot-Api-Secret-Token` webhook verification
- Bot lookup and active-status check
- Update deduplication via `telegram_update_id`
- Message storage in `bot_chat_history`
- Last-30-messages context retrieval
- `/start` handler with welcome message + inline keyboard
- Callback query acknowledgement
- BYOK OpenAI → Lovable AI fallback
- Language auto-detect

#### ❌ Issues
| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| TW1 | No overall function timeout — Telegram requires response ≤15s; AI call uses 20s timeout (will fail) | **CRITICAL** | 2h |
| TW2 | No typing indicator (`sendChatAction`) sent while AI generates | MEDIUM | 1h |
| TW3 | No message truncation — AI response >4096 chars crashes `sendMessage` | HIGH | 1h |
| TW4 | Lovable AI key is global/shared — any crafted request gets free AI, no per-user rate limit | HIGH | 4h |
| TW5 | `bot_chat_history` has no retention/TTL policy — grows unbounded | MEDIUM | 2h |
| TW6 | `insertError` on line ~262 is logged but swallowed — failed inserts are invisible | MEDIUM | 1h |
| TW7 | `update: any` type on line ~147 — should define `TelegramUpdate` interface | LOW | 1h |
| TW8 | Fallback error message could leak system-prompt context | MEDIUM | 1h |
| TW9 | `console.error` statements (lines 51, 87, 130) — should use structured logging | LOW | 2h |

### 5b. `deploy-telegram/index.ts`

**Status: 85% complete**

#### ✅ What Works
- JWT auth + ownership check before any Telegram call
- `getMe` token validation
- `setMyName`, `setMyShortDescription`, `setMyDescription`
- Command normalization and `setMyCommands`
- Bot row upsert with `agent_id` conflict key
- `setWebhook` with generated secret token
- `getWebhookInfo` post-deployment verification
- Agent row update with Telegram metadata

#### ❌ Issues
| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| DT1 | `telegram_token` stored **plaintext** in `bots` table | **CRITICAL** | 4h |
| DT2 | Wildcard CORS `"Access-Control-Allow-Origin": "*"` — restrict to frontend domain | HIGH | 30m |
| DT3 | No handling of HTTP 409 (webhook already set by another app) | HIGH | 1h |
| DT4 | No retry on HTTP 429 (Telegram rate limit) | MEDIUM | 1h |
| DT5 | Upsert uses `onConflict: "agent_id"` — only 1 bot per agent allowed; should support multi-platform | MEDIUM | 3h |
| DT6 | `openai_api_key` stored plaintext in `bots` table | **CRITICAL** | see DT1 |
| DT7 | If `agent.system_prompt` is blank, deployed bot has no personality | HIGH | 1h |
| DT8 | JWT `aud` (audience) not verified — potential token substitution | MEDIUM | 1h |

### 5c. `test-bot/index.ts`

**Status: 80% complete**

#### ✅ What Works
- BYOK OpenAI with Lovable AI fallback
- Proper system + user/assistant role formatting
- CORS OPTIONS handler
- Informative error responses

#### ❌ Issues
| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| TB1 | Uses `gpt-4o-mini`; `telegram-webhook` uses `gemini-2.0-flash-exp` as Lovable model — **inconsistency** | MEDIUM | 30m |
| TB2 | No conversation context — each `/test-bot` call is independent | MEDIUM | 2h |
| TB3 | Request body not validated — passing wrong types causes unhandled 500 | MEDIUM | 1h |

---

## 6. Database Schema & Migrations (`supabase/migrations/`)

| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| DB1 | No index on `bots.telegram_token` — full-table scan on every message received | HIGH | 30m |
| DB2 | No TTL/archival policy on `bot_chat_history` | MEDIUM | 2h |
| DB3 | No `bot_webhook_logs` table to track raw webhook calls | MEDIUM | 3h |
| DB4 | No `bot_errors` table for structured error tracking | MEDIUM | 2h |
| DB5 | No `bot_usage_stats` for usage analytics | LOW | 4h |
| DB6 | Credential columns (`openai_api_key`, `telegram_token`, `auth_value`) stored plaintext — need Supabase Vault or column-level encryption | **CRITICAL** | 8h |
| DB7 | No rollback strategy documented for migrations | LOW | 2h |

---

## 7. Security Issues (Summary)

| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| S1 | `openai_api_key` stored plaintext in `agents` + `bots` tables | **CRITICAL** | 8h |
| S2 | `telegram_token` stored plaintext in `bots` table | **CRITICAL** | 8h |
| S3 | `auth_value` (connector credentials) stored plaintext in `bot_connectors` | **CRITICAL** | 4h |
| S4 | Wildcard CORS on all edge functions | HIGH | 1h |
| S5 | Shared Lovable AI key — no per-user rate limiting | HIGH | 4h |
| S6 | JWT audience (`aud`) not checked in `deploy-telegram` | MEDIUM | 1h |

---

## 8. Console Logs to Remove / Convert

All should be replaced with structured logging (e.g., Sentry, Axiom, or `structuredLog()`):

| File | Line | Statement |
|------|------|-----------|
| `QuickStartWizard.tsx` | ~204 | `console.error("TRI-TFM error:", e)` |
| `Index.tsx` | ~73 | `console.error("TRI-TFM pipeline error:", e)` |
| `telegram-webhook/index.ts` | ~51 | `console.error("OpenAI fetch error:", ...)` |
| `telegram-webhook/index.ts` | ~87 | `console.error("Lovable AI error:", ...)` |
| `telegram-webhook/index.ts` | ~130 | `console.error("Bot not found or inactive:", ...)` |
| `deploy-telegram/index.ts` | ~23 | `console.error(\`Telegram ${method} failed:\`)` |

---

## 9. TypeScript / Type Safety

| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| TS1 | `update: any` in `telegram-webhook` — define `TelegramUpdate` interface | LOW | 1h |
| TS2 | `req.json()` in `test-bot` not validated — runtime crash on bad input | MEDIUM | 1h |
| TS3 | `deployRes?.botInfo` used as non-null in QuickStartWizard | MEDIUM | 30m |
| TS4 | Long inline `typeof AVAILABLE_CONNECTORS[number]` — extract named type | LOW | 30m |

---

## 10. Mobile Responsiveness

| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| M1 | Wizard footer buttons don't wrap on xs screens (<375px) | MEDIUM | 1h |
| M2 | Connector names overflow their grid cell on mobile | LOW | 30m |
| M3 | Data-mapping 4-column grid breaks on tablet (768px) | MEDIUM | 1h |
| M4 | Modal dialogs may exceed viewport height on small phones | MEDIUM | 1h |

---

## 11. Accessibility

| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| A1 | Bot-type selection buttons missing `aria-label` in `StepBotType.tsx` | HIGH | 30m |
| A2 | Tone/style selector pills missing `aria-label` in `StepIdentity.tsx` | HIGH | 30m |
| A3 | Progress bar in `QuickStartWizard.tsx` not labeled for screen readers | HIGH | 30m |
| A4 | All form inputs missing `aria-describedby` linking to validation messages | HIGH | 2h |
| A5 | Select/dropdown triggers missing `aria-label` | MEDIUM | 1h |
| A6 | "Connected" checkmarks in `StepConnections.tsx` need `aria-label` | LOW | 30m |
| A7 | Muted-foreground on muted-background color contrast likely fails WCAG AA | MEDIUM | 2h |

---

## 12. Loading & Empty States

| ID | Issue | Priority | Effort |
|----|-------|----------|--------|
| UX1 | `MyAgents.tsx` has no loading skeleton while fetching | HIGH | 1h |
| UX2 | `Index.tsx` advanced loading has no timeout/error fallback | HIGH | 1h |
| UX3 | `MyAgents.tsx` empty-state copy is generic — add custom illustration + CTA | MEDIUM | 2h |
| UX4 | No "Create your first bot" prompt on Dashboard when list is empty | MEDIUM | 1h |
| UX5 | No skeleton for connector list while loading saved connectors | LOW | 1h |

---

## 13. Missing Features (Stubs / Not Implemented)

| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| Google Sheets read/write | UI only, no API calls | HIGH | 8h |
| Webhook connector testing | No real HTTP call | HIGH | 3h |
| Airtable integration | UI only | MEDIUM | 8h |
| SMTP email sending | UI only | MEDIUM | 4h |
| Shopify / WooCommerce | UI only | LOW | 16h |
| Workflow rule execution | No backend engine | HIGH | 16h |
| Trigger execution | Not wired to anything | HIGH | 8h |
| Field mapping transforms | UI only | MEDIUM | 8h |
| Bot analytics dashboard | Completely absent | MEDIUM | 16h |
| Admin panel | Completely absent | LOW | 24h |
| Error tracking (Sentry) | Not integrated | HIGH | 2h |
| Uptime monitoring | Not integrated | MEDIUM | 2h |
| Password reset flow | Missing page | HIGH | 2h |
| Email confirmation UI | Missing | MEDIUM | 2h |

---

## Priority Summary

### 🔴 CRITICAL (Fix Before First User)
| ID | Description | Effort |
|----|-------------|--------|
| S1/S2/S3/DB6 | Encrypt all credentials at rest (Supabase Vault) | 8h |
| TW1 | Telegram-webhook function timeout — must respond in <15s | 2h |
| W1 | Google Sheets connector test is a stub — misleads users | 3h |
| DT1/DT6 | Telegram token + OpenAI key plaintext in DB | see above |

### 🟠 HIGH (Fix This Week)
| ID | Description | Effort |
|----|-------------|--------|
| DT2/S4 | Restrict CORS to frontend domain | 1h |
| TW3 | Truncate AI responses >4096 chars | 1h |
| TW4/S5 | Rate-limit shared Lovable AI key per user | 4h |
| DT3 | Handle HTTP 409 on webhook conflict | 1h |
| P1/UX1 | Loading skeleton for MyAgents | 1h |
| P2 | Wire Edit action in MyAgents | 2h |
| P6 | Error boundary on all pages | 1h |
| P11 | Password reset link on Auth page | 1h |
| DB1 | Index on `bots.telegram_token` | 30m |
| A1–A4 | Critical accessibility labels | 3h |
| W2–W5 | Wizard step validation + DB persistence | 17h |
| DT7 | Guard against empty `system_prompt` on deploy | 1h |

### 🟡 MEDIUM (Next Sprint)
| ID | Description | Effort |
|----|-------------|--------|
| TW2 | Typing indicator in webhook | 1h |
| TW5 | Bot chat history retention policy | 2h |
| TB1 | Unify AI model selection across functions | 30m |
| TB3 | Validate `test-bot` request body | 1h |
| DB2–DB4 | Logging tables | 7h |
| M1–M4 | Mobile responsiveness fixes | 3.5h |
| A5–A7 | Remaining accessibility | 3.5h |
| UX2–UX5 | Empty states + timeouts | 5h |
| P8 | Advanced-mode loading timeout | 1h |
| P12–P13 | Auth UX improvements | 2h |

### 🟢 LOW (Backlog)
| ID | Description | Effort |
|----|-------------|--------|
| W8/TS4 | Code quality / named types | 1h |
| TW9 | Structured logging across edge functions | 2h |
| P7 | Archived agents view | 2h |
| DB7 | Migration rollback docs | 2h |
| P14 | Password strength meter | 2h |
| M2 | Connector name overflow | 30m |

---

## Total Estimated Effort

| Priority | Issues | Est. Effort |
|----------|--------|-------------|
| CRITICAL | 5 | ~14h |
| HIGH | 20 | ~35h |
| MEDIUM | 25 | ~30h |
| LOW | 10 | ~10h |
| **Total** | **60** | **~89h** |

---

## Deployment Readiness Checklist

- [ ] Encrypt all API keys at rest (Supabase Vault or pgcrypto)
- [ ] Restrict CORS headers to frontend domain
- [ ] Add index on `bots.telegram_token`
- [ ] Edge function timeout < 14s guaranteed
- [ ] Set up error tracking (Sentry or Axiom)
- [ ] Add per-user rate limiting to Lovable AI key usage
- [ ] Implement password reset flow
- [ ] Fix all CRITICAL and HIGH accessibility issues
- [ ] Load test with 100+ concurrent webhook calls
- [ ] Set up uptime monitoring
- [ ] Wire Edit/Test actions in MyAgents
- [ ] Add DB retention policy on `bot_chat_history`

---

*Generated by automated audit — 2026-03-16*
