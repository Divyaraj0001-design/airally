import { useId } from 'react';
import { motion } from 'framer-motion';
import { aqiColor } from '../../lib/aqi';

/** 270° arc gauge with glow + tick marks. `value` is scaled against US AQI 0–300+. */
export default function AqiGauge({ value, label, emoji }: { value: number; label: string; emoji: string }) {
  const R = 78, C = 2 * Math.PI * R, ARC = C * 0.75;
  const pct = Math.min(value / 300, 1);
  const color = aqiColor(value);
  const gid = useId().replace(/:/g, '');
  // ticks every 50 AQI across the 270° sweep (start at 135° = bottom-left)
  const ticks = Array.from({ length: 7 }, (_, i) => {
    const a = (135 + (i / 6) * 270) * Math.PI / 180;
    return { x1: 100 + Math.cos(a) * 94, y1: 100 + Math.sin(a) * 94, x2: 100 + Math.cos(a) * 99, y2: 100 + Math.sin(a) * 99 };
  });
  return (
    <div className="relative mx-auto w-60 h-60 sm:w-64 sm:h-64" role="img" aria-label={`US AQI ${value}, ${label}`}>
      <div className="absolute inset-6 rounded-full blur-3xl opacity-25" style={{ background: color }} aria-hidden="true" />
      <span className="absolute inset-10 rounded-full border-2 animate-[pulse-ring_2.6s_ease-out_infinite]" style={{ borderColor: color }} aria-hidden="true" />
      <svg viewBox="0 0 200 200" className="relative w-full h-full overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={color} stopOpacity="0.55" /><stop offset="1" stopColor={color} /></linearGradient>
        </defs>
        {ticks.map((t, i) => <line key={i} {...t} stroke="currentColor" strokeOpacity="0.3" strokeWidth="1.5" strokeLinecap="round" />)}
        <g transform="rotate(135 100 100)">
          <circle cx="100" cy="100" r={R} fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="13" strokeLinecap="round" strokeDasharray={`${ARC} ${C}`} />
          <motion.circle cx="100" cy="100" r={R} fill="none" stroke={`url(#${gid})`} strokeWidth="13" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 8px ${color}99)` }}
            strokeDasharray={`${ARC} ${C}`} initial={{ strokeDashoffset: ARC }} animate={{ strokeDashoffset: ARC * (1 - pct) }}
            transition={{ duration: 1.3, ease: [0.2, 0.7, 0.2, 1] }} />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-10">
        <span className="text-4xl drop-shadow" aria-hidden="true">{emoji}</span>
        <motion.span key={value} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-6xl font-extrabold tabular-nums leading-none mt-1 tracking-tighter">{value}</motion.span>
        <span className="label mt-1.5">US AQI</span>
        <span className="text-sm font-bold mt-1 leading-tight" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}
