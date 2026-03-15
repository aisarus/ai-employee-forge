

## Plan: Redirect deploy-telegram calls to external edge functions

### Problem
You have your own edge functions hosted at `https://bbhypbkanbquuoptbugo.supabase.co/functions/v1/` and want the app to call those instead of the local project's edge functions.

### What changes

**1. Replace `supabase.functions.invoke("deploy-telegram", ...)` with direct `fetch()` calls**

In two files where `deploy-telegram` is invoked:

- **`src/components/DeployWizard.tsx`** (line ~215): Replace `supabase.functions.invoke("deploy-telegram", { body: {...} })` with a `fetch("https://bbhypbkanbquuoptbugo.supabase.co/functions/v1/deploy-telegram", { method: "POST", headers, body })`. Pass the same JSON body. Use the anon key from the current project or hardcode the external project's anon key for authorization.

- **`src/components/DeployModal.tsx`** (line ~45): Same replacement.

**2. telegram-poll — no client-side changes needed**

`telegram-poll` is never called from the frontend — it runs on a cron schedule server-side. If your external function already has its own cron trigger, no changes are needed here. The local `telegram-poll` edge function can be left as-is or removed.

**3. Authorization header**

The external edge functions need an `Authorization: Bearer <anon_key>` header and `apikey` header with the **external project's** anon key (`bbhypbkanbquuoptbugo`). I'll need the anon key for that external project, or we can use the one already hardcoded in `src/lib/supabase.ts` if it's correct.

### Files to modify
- `src/components/DeployWizard.tsx` — replace `supabase.functions.invoke` with `fetch` to external URL
- `src/components/DeployModal.tsx` — same replacement
- Optionally create a shared helper (e.g. `src/lib/externalApi.ts`) for the external function base URL

### What stays unchanged
- All wizard logic, types, i18n, sessionStorage handling
- Local edge functions (can coexist or be removed later)
- Database schema and RLS policies

