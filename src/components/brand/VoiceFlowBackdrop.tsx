import { useEffect, useRef } from "react";

type Props = {
  /** Optional Google Flow looping mp4 under /public — plays under the canvas. */
  videoSrc?: string;
  className?: string;
};

/**
 * Cinematic Wayam-orange “voice flow” for auth — plasma orbs, speech ribbons,
 * and a soft spectrum pulse. Optional video sits underneath.
 */
export function VoiceFlowBackdrop({ videoSrc, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;

    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 2.2,
      vx: 0.02 + Math.random() * 0.08,
      vy: -0.01 + Math.random() * 0.02,
      a: 0.15 + Math.random() * 0.45,
      tw: Math.random() * Math.PI * 2,
    }));

    const bands = [
      { y: 0.32, amp: 0.07, speed: 0.55, hue: 0, thick: 0.09 },
      { y: 0.48, amp: 0.11, speed: 0.4, hue: 1, thick: 0.13 },
      { y: 0.62, amp: 0.08, speed: 0.65, hue: 2, thick: 0.1 },
      { y: 0.78, amp: 0.05, speed: 0.35, hue: 0, thick: 0.07 },
    ];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const waveY = (x: number, t: number, y0: number, amp: number, speed: number, seed: number) => {
      const n =
        Math.sin(x * 0.0038 + t * speed + seed) * amp +
        Math.sin(x * 0.009 + t * speed * 0.6 + seed * 1.7) * amp * 0.45 +
        Math.sin(x * 0.0018 - t * 0.25 + seed) * amp * 0.55;
      return h * y0 + n * h;
    };

    const paintBase = (t: number) => {
      const drift = Math.sin(t * 0.15) * 0.08;
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#080302");
      g.addColorStop(0.35 + drift, "#1c0904");
      g.addColorStop(0.7, "#3d1408");
      g.addColorStop(1, "#8a2a0c");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const orbs = [
        { x: 0.72 + Math.sin(t * 0.2) * 0.04, y: 0.28, r: 0.42, c0: "rgba(255,161,43,0.55)", c1: "rgba(220,68,12,0.0)" },
        { x: 0.22 + Math.cos(t * 0.18) * 0.05, y: 0.7, r: 0.38, c0: "rgba(240,115,26,0.4)", c1: "rgba(12,5,3,0)" },
        { x: 0.5, y: 0.5 + Math.sin(t * 0.12) * 0.04, r: 0.55, c0: "rgba(255,180,70,0.18)", c1: "rgba(12,5,3,0)" },
        { x: 0.85, y: 0.75, r: 0.28, c0: "rgba(220,68,12,0.35)", c1: "rgba(12,5,3,0)" },
      ];
      for (const o of orbs) {
        const rg = ctx.createRadialGradient(w * o.x, h * o.y, 0, w * o.x, h * o.y, Math.max(w, h) * o.r);
        rg.addColorStop(0, o.c0);
        rg.addColorStop(1, o.c1);
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
      }
    };

    const drawBand = (t: number, band: (typeof bands)[0], seed: number) => {
      const step = Math.max(6, Math.floor(w / 120));
      const amp = band.amp;
      ctx.beginPath();
      ctx.moveTo(-20, h);
      for (let x = -20; x <= w + 20; x += step) {
        ctx.lineTo(x, waveY(x, t, band.y, amp, band.speed, seed));
      }
      ctx.lineTo(w + 20, h);
      ctx.closePath();

      const fill = ctx.createLinearGradient(0, h * (band.y - band.thick), 0, h);
      if (band.hue === 0) {
        fill.addColorStop(0, "rgba(255,161,43,0.22)");
        fill.addColorStop(0.45, "rgba(240,115,26,0.08)");
        fill.addColorStop(1, "rgba(8,3,2,0)");
      } else if (band.hue === 1) {
        fill.addColorStop(0, "rgba(255,200,120,0.28)");
        fill.addColorStop(0.4, "rgba(220,68,12,0.12)");
        fill.addColorStop(1, "rgba(8,3,2,0)");
      } else {
        fill.addColorStop(0, "rgba(250,141,35,0.2)");
        fill.addColorStop(0.5, "rgba(220,68,12,0.1)");
        fill.addColorStop(1, "rgba(8,3,2,0)");
      }
      ctx.fillStyle = fill;
      ctx.fill();

      // Bright crest line
      ctx.beginPath();
      for (let x = -20; x <= w + 20; x += step) {
        const y = waveY(x, t, band.y, amp, band.speed, seed);
        if (x === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const stroke = ctx.createLinearGradient(0, 0, w, 0);
      stroke.addColorStop(0, "rgba(255,161,43,0)");
      stroke.addColorStop(0.2, "rgba(255,200,120,0.55)");
      stroke.addColorStop(0.5, "rgba(255,161,43,0.85)");
      stroke.addColorStop(0.8, "rgba(220,68,12,0.5)");
      stroke.addColorStop(1, "rgba(220,68,12,0)");
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.5 + band.hue * 0.4;
      ctx.lineCap = "round";
      ctx.stroke();
    };

    const drawSpectrum = (t: number) => {
      const bars = 36;
      const cx = w * 0.5;
      const cy = h * 0.42;
      const totalW = Math.min(w * 0.55, 520);
      const gap = totalW / bars;
      const baseX = cx - totalW / 2;

      for (let i = 0; i < bars; i++) {
        const n =
          0.35 +
          0.65 *
            Math.abs(
              Math.sin(t * 1.8 + i * 0.35) *
                Math.cos(t * 0.9 + i * 0.12) *
                (0.4 + 0.6 * Math.sin(i * 0.4 + t)),
            );
        const bh = 18 + n * 90 * (0.55 + 0.45 * Math.sin((i / bars) * Math.PI));
        const x = baseX + i * gap;
        const g = ctx.createLinearGradient(x, cy - bh, x, cy + bh * 0.35);
        g.addColorStop(0, "rgba(255,220,160,0.0)");
        g.addColorStop(0.35, "rgba(255,161,43,0.55)");
        g.addColorStop(0.7, "rgba(220,68,12,0.35)");
        g.addColorStop(1, "rgba(220,68,12,0)");
        ctx.fillStyle = g;
        const bw = Math.max(2, gap * 0.45);
        ctx.fillRect(x, cy - bh, bw, bh + bh * 0.2);
      }
    };

    const drawParticles = (t: number) => {
      for (const p of particles) {
        p.x += p.vx * 0.002;
        p.y += p.vy * 0.002;
        if (p.x > 1.05) p.x = -0.05;
        if (p.y < -0.05) p.y = 1.05;
        if (p.y > 1.05) p.y = -0.05;
        const twinkle = 0.5 + 0.5 * Math.sin(t * 2.5 + p.tw);
        const px = p.x * w;
        const py = p.y * h + Math.sin(t + p.tw) * 6;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 210, 150, ${p.a * twinkle})`;
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawRipple = (t: number) => {
      const cx = w * 0.5;
      const cy = h * 0.42;
      for (let i = 0; i < 3; i++) {
        const pulse = ((t * 0.35 + i * 0.33) % 1);
        const r = 40 + pulse * Math.min(w, h) * 0.35;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,161,43,${(1 - pulse) * 0.18})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    const frame = (now: number) => {
      const t = now / 1000;
      paintBase(t);
      drawRipple(t);
      bands.forEach((b, i) => drawBand(t, b, i * 1.7));
      drawSpectrum(t);
      drawParticles(t);

      // Soft top/bottom vignette so the form stays readable
      const vig = ctx.createLinearGradient(0, 0, 0, h);
      vig.addColorStop(0, "rgba(8,3,2,0.55)");
      vig.addColorStop(0.35, "rgba(8,3,2,0)");
      vig.addColorStop(0.7, "rgba(8,3,2,0)");
      vig.addColorStop(1, "rgba(8,3,2,0.7)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      raf = requestAnimationFrame(frame);
    };

    resize();
    window.addEventListener("resize", resize);

    if (reduceMotion) {
      paintBase(0);
      bands.forEach((b, i) => drawBand(0, b, i * 1.7));
      drawSpectrum(0);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      {/* Slow CSS plasma under the canvas for extra depth */}
      <div className="auth-flow-mesh absolute inset-0" />
      {videoSrc ? (
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
        />
      ) : null}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(8,3,2,0.35)_100%)]" />
    </div>
  );
}
