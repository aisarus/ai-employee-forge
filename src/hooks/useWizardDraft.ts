import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CloudDraft<T> {
  data: T;
  saved_at: number;
}

/**
 * Hook for persisting wizard state to the cloud (Supabase) so the user can
 * continue filling the wizard from another device.
 *
 * Two storage targets are supported:
 *  - agentId  → saves inside `agents.structured_prompt._wizard_draft`
 *  - metaKey  → saves inside Supabase auth user metadata (for wizards where
 *               no agent record exists yet, e.g. QuickStartWizard early steps)
 *
 * Cloud saves are debounced (default 4 s) to avoid hammering the API.
 */
export function useWizardDraft<T>(
  agentId?: string | null,
  metaKey?: string,
  debounceMs = 4000,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Schedule a debounced cloud save.
   * `onSaved` is called (if provided) once the save succeeds.
   */
  const saveToCloud = useCallback(
    (draft: T, onSaved?: () => void) => {
      if (!agentId && !metaKey) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(async () => {
        try {
          const payload: CloudDraft<T> = { data: draft, saved_at: Date.now() };
          if (agentId) {
            const { data: existing } = await supabase
              .from("agents")
              .select("structured_prompt")
              .eq("id", agentId)
              .single();
            const current =
              (existing?.structured_prompt as Record<string, unknown>) ?? {};
            await supabase
              .from("agents")
              .update({
                structured_prompt: {
                  ...current,
                  _wizard_draft: payload,
                } as any,
              })
              .eq("id", agentId);
          } else if (metaKey) {
            const {
              data: { user },
            } = await supabase.auth.getUser();
            await supabase.auth.updateUser({
              data: {
                ...(user?.user_metadata ?? {}),
                [metaKey]: payload,
              },
            });
          }
          onSaved?.();
        } catch {
          /* non-fatal */
        }
      }, debounceMs);
    },
    [agentId, metaKey, debounceMs],
  );

  /** Load the latest cloud draft, or null if none. */
  const loadFromCloud = useCallback(async (): Promise<CloudDraft<T> | null> => {
    try {
      if (agentId) {
        const { data: agent } = await supabase
          .from("agents")
          .select("structured_prompt")
          .eq("id", agentId)
          .single();
        const sp = agent?.structured_prompt as Record<string, unknown> | null;
        return (sp?._wizard_draft as CloudDraft<T>) ?? null;
      } else if (metaKey) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        return (user?.user_metadata?.[metaKey] as CloudDraft<T>) ?? null;
      }
    } catch {
      /* non-fatal */
    }
    return null;
  }, [agentId, metaKey]);

  /** Remove the cloud draft (call after successful deploy or manual reset). */
  const clearCloud = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      if (agentId) {
        const { data: existing } = await supabase
          .from("agents")
          .select("structured_prompt")
          .eq("id", agentId)
          .single();
        const current =
          (existing?.structured_prompt as Record<string, unknown>) ?? {};
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _wizard_draft, ...rest } = current;
        await supabase
          .from("agents")
          .update({ structured_prompt: rest as any })
          .eq("id", agentId);
      } else if (metaKey) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const meta = { ...(user?.user_metadata ?? {}) };
        delete meta[metaKey];
        await supabase.auth.updateUser({ data: meta });
      }
    } catch {
      /* non-fatal */
    }
  }, [agentId, metaKey]);

  return { saveToCloud, loadFromCloud, clearCloud };
}
