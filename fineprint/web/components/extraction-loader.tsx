"use client";
// The Extracted schema panel while a run is in flight. public/Document OCR Scan.json is a
// 920×538 loop of a page being scanned — it says "we are reading the contract right now"
// far better than the shimmering rows it replaced, which promised a shape the result might
// not match. The cycling status line lives in the panel's footer, so this carries no caption.
// Pulled in through next/dynamic by the OutputPanel: the animation is ~314 KB and has no
// business in the initial bundle.
import { useEffect, useState } from "react";
import { Lottie } from "lottie-react";
import animation from "@/public/Document OCR Scan.json";

export default function ExtractionLoader() {
  // Decorative loop — hold it on a single frame if the OS asks for reduced motion. Safe to
  // read in an effect: this component is client-only (ssr: false), so nothing to rehydrate.
  const [still, setStill] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setStill(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div className="flex items-center justify-center h-full px-6">
      {/* The animation fills its box, so the box needs a size. It can't be the Lottie element
          itself: lottie-react puts a .lottie-display class on it that sets its own height, and
          an explicit height beats aspect-ratio. So the ratio lives on a wrapper we own (920×538
          source) and the animation just fills it. */}
      <div className="w-full max-w-[320px] aspect-[920/538]">
        <Lottie
          src={animation}
          loop={!still}
          autoplay={!still}
          className="w-full h-full"
          role="img"
          aria-label="Reading the contract"
        />
      </div>
    </div>
  );
}
