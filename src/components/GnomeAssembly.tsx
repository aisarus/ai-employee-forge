import { useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";

const TEXTS: Record<"en" | "ru", string[]> = {
  en: [
    "Gnomes are forging your AI employee...",
    "Calibrating personality matrix...",
    "Tightening constraint bolts...",
    "Installing intelligence modules...",
    "Polishing neural pathways...",
  ],
  ru: [
    "Гномы куют вашего AI-сотрудника...",
    "Калибруем матрицу личности...",
    "Затягиваем болты ограничений...",
    "Устанавливаем модули интеллекта...",
    "Полируем нейронные пути...",
  ],
};

type Spark = { id: number; x: number; y: number; vx: number; vy: number };

// ── Left gnome (hammer) ─────────────────────────────────────────────────────
function GnomeLeft({ jacketColor = "#16a34a", hatColor = "#dc2626" }: { jacketColor?: string; hatColor?: string }) {
  return (
    <g>
      {/* Hat */}
      <polygon points="42,0 12,44 72,44" fill={hatColor} />
      <polygon points="42,0 35,44 49,44" fill="rgba(0,0,0,0.18)" />
      <ellipse cx="42" cy="44" rx="31" ry="9" fill={hatColor} opacity="0.85" />
      <ellipse cx="34" cy="16" rx="4" ry="9" fill="rgba(255,255,255,0.22)" transform="rotate(-14,34,16)" />
      {/* Head */}
      <circle cx="42" cy="62" r="19" fill="#fef3c7" />
      <circle cx="42" cy="62" r="19" fill="none" stroke="#fde68a" strokeWidth="1" />
      {/* Ears */}
      <circle cx="23" cy="62" r="6" fill="#fde68a" />
      <circle cx="61" cy="62" r="6" fill="#fde68a" />
      {/* Cheeks */}
      <circle cx="30" cy="67" r="6" fill="rgba(252,165,165,0.45)" />
      <circle cx="54" cy="67" r="6" fill="rgba(252,165,165,0.45)" />
      {/* Eyes */}
      <circle cx="35" cy="58" r="4" fill="#1e293b" />
      <circle cx="49" cy="58" r="4" fill="#1e293b" />
      <circle cx="36.5" cy="56.5" r="1.5" fill="white" />
      <circle cx="50.5" cy="56.5" r="1.5" fill="white" />
      {/* Eyebrows */}
      <path d="M 30 53 Q 35 50 40 52" stroke="#92400e" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 44 52 Q 49 50 54 53" stroke="#92400e" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Nose */}
      <ellipse cx="42" cy="65" rx="3.5" ry="2.5" fill="#f59e0b" />
      {/* Smile */}
      <path d="M 32 72 Q 42 80 52 72" stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Beard */}
      <path d="M 23,78 Q 42,96 61,78 Q 60,108 42,114 Q 24,108 23,78 Z" fill="white" opacity="0.97" />
      {/* Body */}
      <rect x="22" y="106" width="40" height="34" rx="11" fill={jacketColor} />
      {/* Pocket */}
      <rect x="26" y="110" width="12" height="9" rx="3" fill="rgba(0,0,0,0.18)" />
      {/* Belt */}
      <rect x="22" y="127" width="40" height="7" rx="2" fill="#78350f" />
      <rect x="35" y="125" width="14" height="11" rx="3" fill="#a16207" />
      <rect x="38" y="127.5" width="8" height="6" rx="1.5" fill="#ca8a04" />
      {/* Left arm (static) */}
      <rect x="4" y="106" width="20" height="11" rx="5.5" fill={jacketColor} />
      {/* Right arm + hammer (animated around shoulder ~58,111) */}
      <g>
        <rect x="58" y="106" width="18" height="11" rx="5.5" fill={jacketColor} />
        <g>
          {/* Hammer handle */}
          <rect x="73" y="96" width="6" height="26" rx="2.5" fill="#92400e" />
          {/* Hammer head */}
          <rect x="65" y="88" width="18" height="12" rx="4" fill="#475569" />
          <rect x="65" y="89" width="8" height="10" rx="3" fill="#64748b" />
          <rect x="67" y="90" width="4" height="4" rx="1" fill="rgba(255,255,255,0.38)" />
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-32 58 111; 26 58 111; -32 58 111"
            keyTimes="0;0.38;1"
            dur="0.48s"
            repeatCount="indefinite"
          />
        </g>
      </g>
      {/* Legs */}
      <rect x="24" y="138" width="15" height="18" rx="5" fill="#1d4ed8" />
      <rect x="43" y="138" width="15" height="18" rx="5" fill="#1d4ed8" />
      {/* Boots */}
      <ellipse cx="31" cy="155" rx="12" ry="6" fill="#1e3a8a" />
      <ellipse cx="50" cy="155" rx="12" ry="6" fill="#1e3a8a" />
    </g>
  );
}

// ── Right gnome (wrench, mirrored by parent) ────────────────────────────────
function GnomeRight({ jacketColor = "#7c3aed", hatColor = "#2563eb" }: { jacketColor?: string; hatColor?: string }) {
  return (
    <g>
      {/* Hat */}
      <polygon points="42,0 12,44 72,44" fill={hatColor} />
      <polygon points="42,0 35,44 49,44" fill="rgba(0,0,0,0.18)" />
      <ellipse cx="42" cy="44" rx="31" ry="9" fill={hatColor} opacity="0.85" />
      {/* Star on hat */}
      <polygon
        points="42,8 44.4,15.2 52,15.2 46,19.6 48.4,26.8 42,22.4 35.6,26.8 38,19.6 32,15.2 39.6,15.2"
        fill="#fbbf24" opacity="0.9"
      />
      {/* Head */}
      <circle cx="42" cy="62" r="19" fill="#fef3c7" />
      <circle cx="23" cy="62" r="6" fill="#fde68a" />
      <circle cx="61" cy="62" r="6" fill="#fde68a" />
      {/* Cheeks */}
      <circle cx="30" cy="67" r="6" fill="rgba(252,165,165,0.45)" />
      <circle cx="54" cy="67" r="6" fill="rgba(252,165,165,0.45)" />
      {/* Eyes — focused squint */}
      <path d="M 30 57 Q 35 55 40 57" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M 44 57 Q 49 55 54 57" stroke="#1e293b" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Determined brows */}
      <path d="M 30 52 Q 35 49 40 51" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M 44 51 Q 49 49 54 52" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Nose */}
      <circle cx="42" cy="65" r="3" fill="#f59e0b" />
      {/* Serious mouth */}
      <path d="M 33 73 Q 42 70 51 73" stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Beard – gray */}
      <path d="M 23,78 Q 42,96 61,78 Q 60,108 42,114 Q 24,108 23,78 Z" fill="#d1d5db" opacity="0.97" />
      {/* Body */}
      <rect x="22" y="106" width="40" height="34" rx="11" fill={jacketColor} />
      {/* Pocket */}
      <rect x="26" y="110" width="12" height="9" rx="3" fill="rgba(0,0,0,0.18)" />
      {/* Belt */}
      <rect x="22" y="127" width="40" height="7" rx="2" fill="#78350f" />
      <rect x="35" y="125" width="14" height="11" rx="3" fill="#a16207" />
      <rect x="38" y="127.5" width="8" height="6" rx="1.5" fill="#ca8a04" />
      {/* Left arm (static) */}
      <rect x="4" y="106" width="20" height="11" rx="5.5" fill={jacketColor} />
      {/* Right arm + wrench (animated around shoulder ~58,111) */}
      <g>
        <rect x="58" y="106" width="18" height="11" rx="5.5" fill={jacketColor} />
        <g>
          {/* Wrench body */}
          <rect x="73" y="96" width="6" height="26" rx="2.5" fill="#64748b" />
          <circle cx="76" cy="94" r="9" fill="none" stroke="#64748b" strokeWidth="4" />
          <circle cx="76" cy="94" r="4" fill="#94a3b8" />
          <circle cx="76" cy="94" r="2" fill="#475569" />
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-28 58 111; 20 58 111; -28 58 111"
            keyTimes="0;0.5;1"
            dur="0.75s"
            repeatCount="indefinite"
          />
        </g>
      </g>
      {/* Legs */}
      <rect x="24" y="138" width="15" height="18" rx="5" fill="#1d4ed8" />
      <rect x="43" y="138" width="15" height="18" rx="5" fill="#1d4ed8" />
      {/* Boots */}
      <ellipse cx="31" cy="155" rx="12" ry="6" fill="#1e3a8a" />
      <ellipse cx="50" cy="155" rx="12" ry="6" fill="#1e3a8a" />
    </g>
  );
}

// ── Robot being assembled ───────────────────────────────────────────────────
function RobotSVG({ progress }: { progress: number }) {
  const show = (t: number) => progress >= t;
  const op = (t: number, full = 1) => show(t) ? full : 0.12;

  return (
    <g>
      {/* Antenna */}
      <rect x="47" y="0" width="6" height="22" rx="3" fill="#64748b" opacity={op(5)} />
      <circle cx="50" cy="0" r="7" fill={show(10) ? "#f59e0b" : "#374151"} opacity={op(5)}>
        {show(10) && <animate attributeName="opacity" values="1;0.35;1" dur="1.4s" repeatCount="indefinite" />}
      </circle>
      {/* Head */}
      <rect x="18" y="22" width="64" height="54" rx="14" fill="#1e293b" opacity={op(5)} />
      <rect x="20" y="24" width="60" height="50" rx="12" fill="#0f172a" opacity={op(5, 0.7)} />
      {/* Eyes */}
      <circle cx="38" cy="46" r="12" fill={show(22) ? "#0369a1" : "#374151"} opacity={op(15)} />
      <circle cx="62" cy="46" r="12" fill={show(22) ? "#0369a1" : "#374151"} opacity={op(15)} />
      {show(30) && (
        <>
          <circle cx="38" cy="46" r="6" fill="#38bdf8">
            <animate attributeName="r" values="6;7.5;6" dur="2.3s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.6;1" dur="2.3s" repeatCount="indefinite" />
          </circle>
          <circle cx="62" cy="46" r="6" fill="#38bdf8">
            <animate attributeName="r" values="6;7.5;6" dur="2.3s" begin="0.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="1;0.6;1" dur="2.3s" begin="0.4s" repeatCount="indefinite" />
          </circle>
          <circle cx="35" cy="43" r="2.5" fill="rgba(255,255,255,0.5)" />
          <circle cx="59" cy="43" r="2.5" fill="rgba(255,255,255,0.5)" />
        </>
      )}
      {/* Mouth */}
      <rect x="30" y="62" width="40" height="7" rx="3.5"
        fill={show(42) ? "#22c55e" : "#374151"} opacity={op(38)} />
      {show(55) && (
        <rect x="32" y="63.5" width="10" height="4" rx="2" fill="#4ade80">
          <animate attributeName="x" values="32;46;32" dur="0.9s" repeatCount="indefinite" />
        </rect>
      )}
      {/* Neck */}
      <rect x="40" y="75" width="20" height="12" rx="5" fill="#334155" opacity={op(10)} />
      {/* Body */}
      <rect x="8" y="86" width="84" height="76" rx="16" fill="#1e293b" opacity={op(15)} />
      {/* Chest panel */}
      <rect x="20" y="96" width="60" height="48" rx="10" fill="#0f172a" opacity={op(20)} />
      {/* Status lights */}
      {([
        { cx: 36, thresh: 44, color: "#ef4444" },
        { cx: 52, thresh: 60, color: "#f59e0b" },
        { cx: 68, thresh: 76, color: "#22c55e" },
      ] as const).map(({ cx, thresh, color }) => (
        <circle key={cx} cx={cx} cy={112} r={6}
          fill={show(thresh) ? color : "#374151"} opacity={op(thresh - 6)}>
          {show(thresh) && (
            <animate attributeName="opacity" values="1;0.45;1" dur="1.9s" repeatCount="indefinite" />
          )}
        </circle>
      ))}
      {/* Inner stripe */}
      <rect x="22" y="126" width="56" height="5" rx="2.5"
        fill={show(60) ? "#6366f1" : "#374151"} opacity={op(55, 0.7)} />
      {/* Progress fill bar */}
      <defs>
        <linearGradient id="pgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(263 70% 58%)" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <rect x="20" y="134" width="60" height="6" rx="3" fill="#1e293b" opacity={op(25)} />
      <rect x="20" y="134"
        width={Math.max(2, (60 * Math.min(progress, 100)) / 100)} height="6" rx="3"
        fill="url(#pgGrad)" opacity={op(25)}>
        {show(25) && <animate attributeName="opacity" values="1;0.55;1" dur="0.8s" repeatCount="indefinite" />}
      </rect>
      {/* Arms */}
      <rect x="-5" y="88" width="15" height="60" rx="7.5" fill="#1e293b" opacity={op(20)} />
      <rect x="90" y="88" width="15" height="60" rx="7.5" fill="#1e293b" opacity={op(20)} />
      {/* Legs */}
      <rect x="14" y="160" width="28" height="42" rx="12" fill="#1e293b" opacity={op(65)} />
      <rect x="58" y="160" width="28" height="42" rx="12" fill="#1e293b" opacity={op(65)} />
      {/* Feet */}
      <ellipse cx="28" cy="200" rx="18" ry="8" fill="#0f172a" opacity={op(80)} />
      <ellipse cx="72" cy="200" rx="18" ry="8" fill="#0f172a" opacity={op(80)} />
    </g>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export function GnomeAssembly() {
  const { lang } = useI18n();
  const texts = TEXTS[lang] ?? TEXTS.en;
  const [textIdx, setTextIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [sparkIdRef, setSparkIdRef] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTextIdx(i => (i + 1) % texts.length), 2000);
    return () => clearInterval(t);
  }, [texts.length]);

  // Slow progress 0→99 visually
  useEffect(() => {
    const t = setInterval(() => setProgress(p => Math.min(p + 1, 99)), 140);
    return () => clearInterval(t);
  }, []);

  // Sparks at hammer impact point
  useEffect(() => {
    let id = sparkIdRef;
    const t = setInterval(() => {
      const base = { x: 182, y: 112 }; // left side of robot
      const batch: Spark[] = Array.from({ length: 5 }, () => ({
        id: id++,
        x: base.x + (Math.random() - 0.5) * 14,
        y: base.y + (Math.random() - 0.5) * 18,
        vx: (Math.random() - 0.65) * 28,
        vy: -(Math.random() * 22 + 6),
      }));
      setSparks(prev => [...prev.slice(-20), ...batch]);
      setSparkIdRef(id);
    }, 480); // matches hammer dur
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6 animate-fade-in select-none">
      {/* Scene */}
      <div className="relative">
        <svg
          width="390" height="230"
          viewBox="0 0 390 230"
          xmlns="http://www.w3.org/2000/svg"
          className="overflow-visible"
        >
          {/* Ambient glow beneath robot */}
          <ellipse cx="195" cy="222" rx="90" ry="11" fill="hsl(263 70% 58% / 0.14)" />

          {/* ── Left gnome ── */}
          <g transform="translate(8, 60)">
            <GnomeLeft />
          </g>

          {/* ── Robot ── */}
          <g transform="translate(145, 18)">
            <RobotSVG progress={progress} />
          </g>

          {/* ── Right gnome (flip horizontally) ── */}
          <g transform="translate(382, 60) scale(-1, 1)">
            <GnomeRight />
          </g>

          {/* Sparks */}
          {sparks.map(s => (
            <circle key={s.id} cx={s.x} cy={s.y} r="2.5" fill="#fbbf24" opacity="0">
              <animate attributeName="cx" from={String(s.x)} to={String(s.x + s.vx)} dur="0.55s" fill="freeze" />
              <animate attributeName="cy" from={String(s.y)} to={String(s.y + s.vy + 18)} dur="0.55s" fill="freeze" />
              <animate attributeName="opacity" values="0;1;0.8;0" keyTimes="0;0.1;0.5;1" dur="0.55s" fill="freeze" />
              <animate attributeName="r" from="2.5" to="0.5" dur="0.55s" fill="freeze" />
            </circle>
          ))}
        </svg>
      </div>

      {/* Rotating text */}
      <p
        key={textIdx}
        className="text-sm font-medium text-muted-foreground animate-fade-in text-center max-w-xs"
      >
        {texts[textIdx]}
      </p>

      {/* Progress bar */}
      <div className="w-52 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-150"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Pulse dots */}
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"
            style={{ animationDelay: `${i * 0.25}s` }}
          />
        ))}
      </div>
    </div>
  );
}
