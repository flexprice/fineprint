"use client";
// Shown while a sample's rendered pages are still in flight (the cold-start fetch can run a
// couple of seconds). The Lottie is public/loading.json — "Loading Files", 800×200 line art in
// neutral greys, so it reads on both the light and dark panel without recolouring.
// Pulled in through next/dynamic by the ContractViewer, so neither lottie-web nor the 25 KB
// animation lands in the initial bundle.
import { useEffect, useState } from "react";
import { Lottie } from "lottie-react";
import animation from "@/public/loading.json";

export default function DocumentLoader() {
  // Honour the OS motion preference — this is a decorative looping graphic. Safe to read
  // straight in an effect: the component is client-only (ssr: false), so there is no
  // server render to disagree with.
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
      {/* Ratio on a wrapper we own, not on the Lottie itself — lottie-react's .lottie-display
          class sets a height, and an explicit height beats aspect-ratio. 800×200 source, so 4/1.
          It carries the whole message; the aria-label names the state for anyone who can't see it. */}
      <div className="w-full max-w-[280px] aspect-[4/1]">
        <Lottie
          src={animation}
          loop={!still}
          autoplay={!still}
          className="w-full h-full"
          role="img"
          aria-label="Rendering the document"
        />
      </div>
    </div>
  );
}
