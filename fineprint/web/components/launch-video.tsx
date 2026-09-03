"use client";

import { useState } from "react";

// Flip PROVIDER to "youtube" to restore the YT embed.
type Provider = "mux" | "youtube";
const PROVIDER: Provider = "mux";

const MUX_PLAYBACK_ID = "BSdHeWKgBNbMSiEX3TIyyHBzAGSN44C9YGi16594Z9I";

// Thumbnail: Mux frame at 45.5s. Bump width for retina; swap URL anytime.
const MUX_POSTER =
  `https://image.mux.com/${MUX_PLAYBACK_ID}/thumbnail.png?time=45.5&width=1920`;

const MUX_EMBED =
  `https://player.mux.com/${MUX_PLAYBACK_ID}` +
  `?autoplay=true&muted=false&max_resolution=1080p&accent_color=FFFFFF`;

const YOUTUBE_ID = "JYiEB1ICiVs";
const YOUTUBE_POSTER = `https://i.ytimg.com/vi/${YOUTUBE_ID}/maxresdefault.jpg`;
const YOUTUBE_EMBED = `https://www.youtube.com/embed/${YOUTUBE_ID}?autoplay=1&rel=0&modestbranding=1`;

export function LaunchVideo() {
  const [playing, setPlaying] = useState(false);
  const poster = PROVIDER === "mux" ? MUX_POSTER : YOUTUBE_POSTER;
  const embed = PROVIDER === "mux" ? MUX_EMBED : YOUTUBE_EMBED;

  return (
    <div className="fp-glass-player relative mx-auto w-full max-w-[960px] aspect-video overflow-hidden rounded-2xl bg-black">
      {playing ? (
        // Tiny overscale crops Mux/YT player stage black gutters at the edges
        <iframe
          className="absolute inset-0 size-full origin-center scale-[1.02] border-0"
          src={embed}
          title="FinePrint launch film"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            className="absolute inset-0 size-full object-cover"
            decoding="async"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, transparent 45%, color-mix(in srgb, var(--bg) 55%, transparent) 100%), " +
                "radial-gradient(60% 50% at 50% 45%, transparent, color-mix(in srgb, var(--bg) 35%, transparent))",
            }}
          />
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label="Play launch film"
            className="absolute inset-0 grid place-items-center cursor-pointer"
          >
            <span className="fp-glass-play inline-flex items-center justify-center size-16 rounded-full transition-transform duration-200 hover:scale-105">
              <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden fill="currentColor">
                <path d="M9 7.5c0-.28.22-.5.5-.5.13 0 .25.04.35.12l7.15 4.38c.31.19.31.61 0 .8l-7.15 4.38a.5.5 0 0 1-.35.12.5.5 0 0 1-.5-.5V7.5z" />
              </svg>
            </span>
          </button>
          <span className="absolute bottom-5 left-6 font-mono text-[11px] uppercase tracking-[.1em] text-faint pointer-events-none">
            Launch film
          </span>
        </>
      )}
    </div>
  );
}
