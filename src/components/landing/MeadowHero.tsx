"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";

/** Rose palette – deep → light. */
const ROSE = {
  flowers: ["#3a0d22", "#6d1c45", "#ad4278", "#e38bb3", "#f8d0e1", "#fff6fa"],
  straw: ["#b98a6a", "#d9b48f", "#8f6a55"],
  deep: "#3a1b2d",
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LAYERS = 9;

/**
 * Paints the meadow. `from`..`to` selects which depth layers to draw so the foreground can be a
 * separate canvas sitting above the coins (they look nestled into the flowers).
 */
function paint(ctx: CanvasRenderingContext2D, w: number, h: number, from: number, to: number) {
  ctx.clearRect(0, 0, w, h);
  const P = ROSE.flowers;
  const area = (w * h) / 1_000_000;
  for (let L = 0; L < LAYERS; L++) {
    const r = rng(1009 + L * 7919);
    const depth = L / (LAYERS - 1); // 0 = far, 1 = near
    // ridge: where this layer's flowers start
    const base = h * (0.08 + depth * 0.62);
    const amp = h * (0.05 + 0.04 * (1 - depth));
    const ph1 = r() * 6.28, ph2 = r() * 6.28;
    const ridge = (x: number) => base + Math.sin(x / w * 5.2 + ph1) * amp * 0.6 + Math.sin(x / w * 13 + ph2) * amp * 0.25;
    if (L < from || L > to) continue;
    const size = 2.2 + depth * 5.5; // floret radius
    const clusters = Math.round((900 + depth * 1600) * area * (1.15 - depth * 0.35));
    // grass stems behind this layer
    ctx.lineCap = "round";
    for (let i = 0; i < clusters * 0.06; i++) {
      const x = r() * w, y = ridge(x) + r() * h * 0.08;
      const len = (10 + r() * 40) * (0.5 + depth);
      ctx.strokeStyle = ROSE.straw[Math.floor(r() * 3)];
      ctx.globalAlpha = 0.35 + depth * 0.4;
      ctx.lineWidth = 0.6 + depth * 0.9;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (r() - 0.5) * 8, y - len * 0.6, x + (r() - 0.5) * 14, y - len); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // dark underbody so gaps read as shadow, not sky
    ctx.fillStyle = depth > 0.5 ? P[0] : P[1];
    ctx.globalAlpha = 0.55 + depth * 0.35;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, ridge(x) + size * 3);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < clusters; i++) {
      const x = r() * w;
      const top = ridge(x);
      const y = top + Math.pow(r(), 1.6) * (h - top);
      const lightness = 1 - Math.min(1, (y - top) / (h * 0.35)); // sunlit crown, shaded body
      const tone = Math.min(5, Math.max(0, Math.round(1 + lightness * 3 + (1 - depth) * 1.2 + (r() - 0.5) * 1.6)));
      const n = 5 + Math.floor(r() * 7);
      const spread = size * (1.4 + r() * 1.4);
      for (let k = 0; k < n; k++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread;
        const fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d * 0.8;
        const fr = size * (0.45 + r() * 0.45);
        const t = Math.max(0, Math.min(5, tone - (k % 3 === 0 ? 1 : 0)));
        ctx.fillStyle = P[t];
        ctx.beginPath(); ctx.arc(fx, fy, fr, 0, Math.PI * 2); ctx.fill();
        if (t >= 3 && r() < 0.5) { // tiny highlight
          ctx.fillStyle = P[5];
          ctx.globalAlpha = 0.7;
          ctx.beginPath(); ctx.arc(fx - fr * 0.3, fy - fr * 0.3, fr * 0.35, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }
  }
}

function useMeadow(ref: React.RefObject<HTMLCanvasElement>, from: number, to: number) {
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    let raf = 0, last = "";
    const draw = () => {
      const w = c.clientWidth, h = c.clientHeight;
      const key = `${w}x${h}`;
      if (!w || !h || key === last) return;
      last = key;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(ctx, w, h, from, to);
      c.dataset.ready = "1";
    };
    draw();
    const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); });
    ro.observe(c);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [ref, from, to]);
}

/** Brushed-metal rose coin with an engraved rupee mark. */
function Coin({ tilt = 1, className = "", style }: { tilt?: 1 | -1; className?: string; style?: React.CSSProperties }) {
  const id = tilt === 1 ? "a" : "b";
  const rx = 40, ry = 50, edge = 9 * tilt;
  return (
    <svg viewBox="-62 -60 124 120" className={className} style={style} aria-hidden>
      <defs>
        <linearGradient id={`face-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset=".35" stopColor="#f8e2ec" /><stop offset=".7" stopColor="#dba5bd" /><stop offset="1" stopColor="#a2607f" />
        </linearGradient>
        <linearGradient id={`edge-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c48aa5" /><stop offset=".5" stopColor="#efc6d8" /><stop offset="1" stopColor="#8d4d6b" />
        </linearGradient>
        <radialGradient id={`gloss-${id}`} cx=".3" cy=".25" r=".6">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {Array.from({ length: 12 }, (_, i) => (
        <ellipse key={i} cx={(edge * (12 - i)) / 12} cy={0} rx={rx} ry={ry} fill={`url(#edge-${id})`} stroke="#a2607f" strokeOpacity=".35" strokeWidth=".6" />
      ))}
      <ellipse rx={rx} ry={ry} fill={`url(#face-${id})`} />
      <ellipse rx={rx * 0.82} ry={ry * 0.82} fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="1.6" />
      <ellipse rx={rx * 0.82} ry={ry * 0.82} fill="none" stroke="#a2607f" strokeOpacity=".35" strokeWidth=".8" transform="translate(.8 .8)" />
      <text x="0" y="14" textAnchor="middle" fontSize="40" fontWeight="600" fill="#a2607f" fillOpacity=".55" style={{ fontFamily: "var(--font-inter), system-ui" }}>₹</text>
      <text x="-1" y="13" textAnchor="middle" fontSize="40" fontWeight="600" fill="#fff" fillOpacity=".7" style={{ fontFamily: "var(--font-inter), system-ui" }}>₹</text>
      <ellipse cx={-rx * 0.3} cy={-ry * 0.42} rx={rx * 0.42} ry={ry * 0.16} fill={`url(#gloss-${id})`} transform="rotate(-24)" />
      <ellipse rx={rx - 0.4} ry={ry - 0.4} fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth=".8" />
    </svg>
  );
}

export function MeadowHero({ signedIn, dashboardHref }: { signedIn: boolean; dashboardHref: string }) {
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  useMeadow(back, 0, LAYERS - 4);
  useMeadow(front, LAYERS - 3, LAYERS - 1);
  return (
    <section
      className="relative isolate flex min-h-[640px] flex-col overflow-hidden rounded-b-[2rem] lg:h-[min(94vh,880px)]"
      style={{ background: "radial-gradient(120% 70% at 50% 38%, #fbf3f6 0%, #f3dde7 45%, #e6c0d1 100%)" }}
    >
      <div className="relative z-30 mx-auto mt-[12vh] max-w-3xl px-6 text-center sm:mt-[13vh]">
        <svg className="mx-auto mb-6 h-5 w-5 animate-[lml-twinkle_3.2s_ease-in-out_infinite]" viewBox="-12 -12 24 24" aria-hidden>
          <path d="M0-11C1 -3 3-1 11 0 3 1 1 3 0 11-1 3-3 1-11 0-3-1-1-3 0-11Z" fill={ROSE.deep} />
        </svg>
        <h1 className="text-[clamp(2.6rem,7.2vw,5.6rem)] font-medium leading-[1.02] tracking-[-0.035em]" style={{ color: ROSE.deep }}>
          Revenue in<br className="sm:hidden" /> Full Bloom
        </h1>
        <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed sm:text-base" style={{ color: "#6b4a5c" }}>
          Plans, subscriptions, GST invoices and payments that quietly grow while you sleep. Billing runs itself; your MRR does the rest.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          {signedIn ? (
            <Link href={dashboardHref} className="rounded-full px-6 py-3 text-sm font-medium text-white shadow-lg shadow-rose-900/20 transition hover:-translate-y-0.5 hover:shadow-xl" style={{ background: ROSE.deep }}>Open dashboard</Link>
          ) : (
            <>
              <Link href="/register" className="rounded-full px-6 py-3 text-sm font-medium text-white shadow-lg shadow-rose-900/20 transition hover:-translate-y-0.5 hover:shadow-xl" style={{ background: ROSE.deep }}>Start for free</Link>
              <Link href="/login" className="rounded-full border border-white/70 bg-white/50 px-6 py-3 text-sm font-medium backdrop-blur transition hover:bg-white/80" style={{ color: ROSE.deep }}>Sign in</Link>
            </>
          )}
        </div>
      </div>

      {/* meadow */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[52%] min-h-[300px]">
        <canvas ref={back} className="absolute inset-0 h-full w-full opacity-0 transition-opacity duration-700 data-[ready='1']:opacity-100" />
        <Coin tilt={1} className="lml-coin absolute left-[11%] top-[24%] w-[clamp(90px,13vw,170px)] drop-shadow-[0_18px_24px_rgba(58,13,34,0.35)]" style={{ transform: "rotate(-14deg)" }} />
        <Coin tilt={-1} className="lml-coin lml-coin-2 absolute right-[10%] top-[22%] w-[clamp(70px,10vw,130px)] drop-shadow-[0_18px_24px_rgba(58,13,34,0.3)]" style={{ transform: "rotate(16deg)" }} />
        <canvas ref={front} className="absolute inset-0 z-10 h-full w-full opacity-0 transition-opacity duration-700 data-[ready='1']:opacity-100" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-24 bg-gradient-to-t from-[#3a0d22]/40 to-transparent" />
    </section>
  );
}
