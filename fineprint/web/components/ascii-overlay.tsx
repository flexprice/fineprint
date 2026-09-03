"use client";

import { useEffect, useRef } from "react";

// Dense → sparse. Bright areas get dense glyphs so the sky still reads as a filled field.
const RAMP = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";

/** Full-bleed ASCII over the CTA art. */
export function AsciiOverlay({ src }: { src: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      canvas.style.display = "none";
      return;
    }

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let cancelled = false;
    const img = new Image();
    img.decoding = "async";

    const paint = () => {
      if (cancelled || !img.naturalWidth) return;

      const parent = canvas.parentElement;
      const w = Math.max(1, parent?.clientWidth || canvas.clientWidth);
      const h = Math.max(1, parent?.clientHeight || canvas.clientHeight);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // 1) Draw the photo into a full-size buffer with the SAME cover crop as CSS
      //    (fixes empty left/top — previous code passed layout offsets as image sx/sy).
      const cover = 1.22;
      const ox = 0.5;
      const oy = 0.08;
      const ir = img.naturalWidth / img.naturalHeight;
      const cr = w / h;
      let dw: number, dh: number;
      if (ir > cr) {
        dh = h * cover;
        dw = dh * ir;
      } else {
        dw = w * cover;
        dh = dw / ir;
      }
      const dx = (w - dw) * ox;
      const dy = (h - dh) * oy;

      const stage = document.createElement("canvas");
      stage.width = w;
      stage.height = h;
      const st = stage.getContext("2d");
      if (!st) return;
      st.drawImage(img, dx, dy, dw, dh);

      // 2) Sample that buffer into a character grid that spans the full width
      const fontSize = w < 640 ? 11 : 10;
      ctx.font = `700 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
      const charW = Math.max(5, ctx.measureText("M").width);
      const cols = Math.ceil(w / charW);
      const rows = Math.ceil(h / fontSize);

      const sample = document.createElement("canvas");
      sample.width = cols;
      sample.height = rows;
      const sctx = sample.getContext("2d", { willReadFrequently: true });
      if (!sctx) return;
      sctx.drawImage(stage, 0, 0, w, h, 0, 0, cols, rows);
      const { data } = sctx.getImageData(0, 0, cols, rows);

      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      const ink = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#171717";
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#0070f3";

      for (let y = 0; y < rows; y++) {
        const band = y / rows;
        // Faint sky texture only — gone before the headline so CTA copy stays clean
        let alpha = 0;
        if (band < 0.22) alpha = 0.28;
        else if (band < 0.38) alpha = 0.28 - ((band - 0.22) / 0.16) * 0.22;
        else if (band < 0.48) alpha = 0.06 - ((band - 0.38) / 0.1) * 0.06;
        else alpha = 0;
        if (alpha <= 0.03) continue;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = band < 0.18 ? accent : ink;

        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
          const idx = Math.min(RAMP.length - 1, Math.floor((1 - lum) * (RAMP.length - 1)));
          const ch = RAMP[idx];
          // Still draw light dots so the grid never leaves holes on the left/top
          ctx.fillText(ch === " " ? "." : ch, x * charW, y * fontSize);
        }
      }
      ctx.globalAlpha = 1;
    };

    const ro = new ResizeObserver(() => requestAnimationFrame(paint));
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    img.onload = () => paint();
    img.src = src;
    if (img.complete) paint();

    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [src]);

  return (
    <canvas
      ref={ref}
      className="fp-flex-cta-ascii absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    />
  );
}
