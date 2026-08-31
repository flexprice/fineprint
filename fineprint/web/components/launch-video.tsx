// Placeholder for the launch film. Drop a hosted URL into VIDEO_SRC when ready
// (Mux / Cloudflare Stream / Vercel Blob — TBD). Until then this is a glass shell
// that reads as a player, not an empty gap.

const VIDEO_SRC: string | null = null;

export function LaunchVideo() {
  return (
    <div className="fp-glass-player relative mx-auto w-full max-w-[960px] aspect-video overflow-hidden rounded-2xl">
      {VIDEO_SRC ? (
        <video
          className="absolute inset-0 size-full object-cover"
          src={VIDEO_SRC}
          controls
          playsInline
          preload="metadata"
        />
      ) : (
        <>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(80% 70% at 50% 40%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%), " +
                "linear-gradient(145deg, color-mix(in srgb, var(--surface-2) 80%, transparent), color-mix(in srgb, var(--bg) 40%, transparent))",
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              maskImage: "radial-gradient(ellipse at center, black 20%, transparent 72%)",
            }}
          />
          <button
            type="button"
            disabled
            aria-label="Launch video coming soon"
            className="absolute inset-0 grid place-items-center cursor-default"
          >
            <span className="fp-glass-play inline-flex items-center justify-center size-16 rounded-full">
              <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden fill="currentColor">
                <path d="M9 7.5c0-.28.22-.5.5-.5.13 0 .25.04.35.12l7.15 4.38c.31.19.31.61 0 .8l-7.15 4.38a.5.5 0 0 1-.35.12.5.5 0 0 1-.5-.5V7.5z" />
              </svg>
            </span>
          </button>
          <span className="absolute bottom-5 left-6 font-mono text-[11px] uppercase tracking-[.1em] text-faint">
            Launch film · coming soon
          </span>
        </>
      )}
    </div>
  );
}
