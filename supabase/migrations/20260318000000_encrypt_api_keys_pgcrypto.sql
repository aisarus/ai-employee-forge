-- Sprint 2 (Security): API key encryption infrastructure
-- Enables pgcrypto and adds DB-level helpers to validate encrypted values.
-- Application-level encryption uses AES-256-GCM (see _shared/crypto.ts);
-- pgcrypto is used here for the is_botforge_encrypted() validation function
-- and provides symmetric encryption primitives for future Vault migration.

-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Helper: is_botforge_encrypted(text) → boolean
-- Returns TRUE when a column value looks like a botforge AES-256-GCM
-- ciphertext: valid Base64, decoded length > 12 (12-byte IV + ≥1 byte body).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_botforge_encrypted(value text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE STRICT
AS $$
DECLARE
  decoded bytea;
BEGIN
  -- Attempt Base64 decode; any non-base64 string raises an exception.
  decoded := decode(value, 'base64');
  -- Minimum: 12-byte IV + 1 byte ciphertext + 16-byte GCM tag = 29 bytes.
  RETURN length(decoded) > 28;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.is_botforge_encrypted(text) IS
  'Returns TRUE if the value appears to be a botforge AES-256-GCM Base64 ciphertext (IV ≥ 12 bytes + body).';

-- ---------------------------------------------------------------------------
-- Column comments — mark every sensitive column so tooling knows what is
-- stored encrypted. Actual encryption is performed by the application layer
-- (AES-256-GCM, see supabase/functions/_shared/crypto.ts).
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.agents.openai_api_key  IS 'AES-256-GCM encrypted (botforge-v1). Decrypt with tryDecrypt() in edge functions.';
COMMENT ON COLUMN public.agents.telegram_token  IS 'AES-256-GCM encrypted (botforge-v1). Decrypt with tryDecrypt() in edge functions.';
COMMENT ON COLUMN public.bots.openai_api_key    IS 'AES-256-GCM encrypted (botforge-v1). Decrypt with tryDecrypt() in edge functions.';
COMMENT ON COLUMN public.bots.telegram_token    IS 'AES-256-GCM encrypted (botforge-v1). Decrypt with tryDecrypt() in edge functions.';
COMMENT ON COLUMN public.bot_connectors.auth_value IS 'AES-256-GCM encrypted (botforge-v1). Decrypt with tryDecrypt() in edge functions.';
