import React, { useState, useRef, useCallback } from "react";
import type { WizardData } from "./types";
import {
  PROMPT_BLOCK_DEFS,
  DEFAULT_PROMPT_BLOCK_ORDER,
  buildFullSystemPrompt,
} from "./promptBuilder";

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

export function PromptBuilderPanel({ data, onChange }: Props) {
  const savedOrder = data.prompt_block_order ?? DEFAULT_PROMPT_BLOCK_ORDER;
  const [order, setOrder]       = useState<string[]>([...savedOrder]);
  const [isDirty, setIsDirty]   = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const dragSrcIdx = useRef<number | null>(null);

  // ── Drag handlers ───────────────────────────────────────────────────────
  const handleDragStart = useCallback(
    (idx: number) => (e: React.DragEvent<HTMLDivElement>) => {
      dragSrcIdx.current = idx;
      e.dataTransfer.effectAllowed = "move";
      // Minimal ghost image
      e.dataTransfer.setDragImage(e.currentTarget, 16, 16);
    },
    []
  );

  const handleDragOver = useCallback(
    (idx: number) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverIdx(idx);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIdx(null);
  }, []);

  const handleDrop = useCallback(
    (targetIdx: number) => (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOverIdx(null);
      const srcIdx = dragSrcIdx.current;
      if (srcIdx === null || srcIdx === targetIdx) return;

      setOrder((prev) => {
        const next = [...prev];
        const [moved] = next.splice(srcIdx, 1);
        next.splice(targetIdx, 0, moved);
        return next;
      });
      setIsDirty(true);
      dragSrcIdx.current = null;
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDragOverIdx(null);
    dragSrcIdx.current = null;
  }, []);

  // ── Move helpers (keyboard-accessible alternative to drag) ──────────────
  const moveBlock = useCallback((idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= order.length) return;
    setOrder((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setIsDirty(true);
  }, [order.length]);

  // ── Toggle block enabled/disabled ───────────────────────────────────────
  const toggleBlock = useCallback((blockId: string) => {
    const def = PROMPT_BLOCK_DEFS.find((b) => b.id === blockId);
    if (def?.required) return; // required blocks cannot be removed

    setOrder((prev) => {
      if (prev.includes(blockId)) {
        return prev.filter((id) => id !== blockId);
      }
      // Re-insert at its default position
      const defaultPos = DEFAULT_PROMPT_BLOCK_ORDER.indexOf(blockId);
      const next = [...prev];
      let insertAt = next.length;
      for (let i = 0; i < next.length; i++) {
        if (DEFAULT_PROMPT_BLOCK_ORDER.indexOf(next[i]) > defaultPos) {
          insertAt = i;
          break;
        }
      }
      next.splice(insertAt, 0, blockId);
      return next;
    });
    setIsDirty(true);
  }, []);

  // ── Disabled blocks (present in DEFS but not in current order) ──────────
  const disabledBlocks = PROMPT_BLOCK_DEFS
    .filter((b) => !b.required && !order.includes(b.id))
    .map((b) => b.id);

  // ── Save / Reset ────────────────────────────────────────────────────────
  const handleSave = () => {
    onChange({ prompt_block_order: order });
    setIsDirty(false);
  };

  const handleReset = () => {
    setOrder([...DEFAULT_PROMPT_BLOCK_ORDER]);
    setIsDirty(true);
  };

  // ── Live preview ────────────────────────────────────────────────────────
  const previewText = showPreview
    ? buildFullSystemPrompt({ ...data, prompt_block_order: order })
    : "";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Prompt Block Order</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Drag blocks to reorder sections in the system prompt
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-white/70 hover:text-white hover:bg-white/5 transition-all active:scale-[0.95] active:brightness-90"
          >
            {showPreview ? "Hide Preview" : "Preview Prompt"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty && order.length === DEFAULT_PROMPT_BLOCK_ORDER.length}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-all active:scale-[0.95] active:brightness-90 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty}
            className={[
              "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.95]",
              isDirty
                ? "bg-indigo-600 hover:bg-indigo-500 hover:shadow-[0_0_14px_hsl(239_84%_67%/0.45)] active:brightness-90 text-white shadow-md"
                : "bg-white/5 text-white/30 cursor-not-allowed",
            ].join(" ")}
          >
            Save Order
          </button>
        </div>
      </div>

      {/* Active blocks — draggable list */}
      <div className="flex flex-col gap-1.5" role="list" aria-label="Prompt sections">
        {order.map((blockId, idx) => {
          const def = PROMPT_BLOCK_DEFS.find((b) => b.id === blockId);
          if (!def) return null;
          const isOver = dragOverIdx === idx;

          return (
            <div
              key={blockId}
              role="listitem"
              draggable
              onDragStart={handleDragStart(idx)}
              onDragOver={handleDragOver(idx)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={[
                "flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-grab active:cursor-grabbing",
                "border transition-all duration-150 select-none",
                isOver
                  ? "border-indigo-500/60 bg-indigo-500/10 scale-[1.02] animate-drop-glow"
                  : "border-white/8 bg-white/4 hover:bg-white/7 hover:border-white/15 hover:-translate-y-px",
              ].join(" ")}
            >
              {/* Drag handle */}
              <span className="text-white/25 hover:text-white/50 transition-colors flex-shrink-0" aria-hidden>
                ⋮⋮
              </span>

              {/* Position badge */}
              <span className="w-5 h-5 rounded-full bg-white/8 text-white/40 text-[10px] font-mono flex items-center justify-center flex-shrink-0">
                {idx + 1}
              </span>

              {/* Icon */}
              <span className="text-base flex-shrink-0">{def.icon}</span>

              {/* Label + description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/90">{def.label}</span>
                  {def.required && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
                      required
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/40 truncate">{def.description}</p>
              </div>

              {/* Move up/down buttons */}
              <div className="flex gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => moveBlock(idx, -1)}
                  disabled={idx === 0}
                  aria-label={`Move ${def.label} up`}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/8 transition-all active:scale-[0.85] active:brightness-90 disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveBlock(idx, 1)}
                  disabled={idx === order.length - 1}
                  aria-label={`Move ${def.label} down`}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/8 transition-all active:scale-[0.85] active:brightness-90 disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  ▼
                </button>
              </div>

              {/* Toggle off (non-required only) */}
              {!def.required && (
                <button
                  type="button"
                  onClick={() => toggleBlock(blockId)}
                  aria-label={`Remove ${def.label} from prompt`}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-[0.8] flex-shrink-0"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Disabled / available blocks */}
      {disabledBlocks.length > 0 && (
        <div className="mt-1">
          <p className="text-xs text-white/40 mb-2 uppercase tracking-wider font-medium">
            Disabled sections (click to re-enable)
          </p>
          <div className="flex flex-wrap gap-2">
            {disabledBlocks.map((blockId) => {
              const def = PROMPT_BLOCK_DEFS.find((b) => b.id === blockId)!;
              return (
                <button
                  key={blockId}
                  type="button"
                  onClick={() => toggleBlock(blockId)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/3 text-white/40 hover:text-white/70 hover:bg-white/8 hover:border-white/20 transition-all active:scale-[0.93] animate-pop-in text-xs"
                >
                  <span>{def.icon}</span>
                  <span>{def.label}</span>
                  <span className="text-white/25">+</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Live preview */}
      {showPreview && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/50 font-medium">
              Live preview ({previewText.length.toLocaleString()} chars)
            </p>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(previewText)}
              className="text-xs text-white/40 hover:text-white/70 transition-colors px-2 py-1 rounded hover:bg-white/5"
            >
              Copy
            </button>
          </div>
          <textarea
            readOnly
            value={previewText}
            rows={18}
            className="w-full rounded-xl border border-white/8 bg-black/30 text-white/70 text-xs font-mono p-3 resize-y focus:outline-none focus:border-indigo-500/50"
            aria-label="System prompt preview"
          />
        </div>
      )}
    </div>
  );
}
