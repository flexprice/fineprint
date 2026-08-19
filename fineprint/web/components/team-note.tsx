import { Brand } from "@/components/site-nav";

export function TeamNote() {
  return (
    <section id="note" className="shell py-16">
      <div className="paper px-7 sm:px-12 py-11 sm:py-12 max-w-[44rem] mx-auto">
        {/* Handwritten and slightly off-square, matching the wordmark, so the aside reads
            as written rather than composed. */}
        <p className="wordmark hand-tilt mb-9" style={{ fontSize: 29 }}>A Note From The Team</p>

        <div className="relative z-[1] text-[16px] leading-[1.78] space-y-5 max-w-[52ch]">
          <p>
            Flexprice runs usage-based billing. Before any invoice exists, someone has to turn a
            signed contract into structured billing terms: the fees, the cadence, the currency, the
            commitments. <span className="marker">We do that step in production.</span>
          </p>
          <p>
            That is why we can score it. We already know which fields decide an invoice, what counts
            as the same answer when a price is written two different ways, and what it costs when a
            model gets one wrong and sounds certain about it.
          </p>
          <p>
            So we wrote the rubric down, labeled a set of real contracts by hand, and ran every model
            we could reach. We put the whole thing in the open so nobody else picking a model for this
            has to start from scratch, and so the numbers keep updating as new models ship. If your
            contracts look nothing like ours,{" "}
            <span className="underline-hand">point the harness at your own</span>.
          </p>
        </div>

        <div className="relative z-[1] mt-10 pt-6 flex items-end justify-between gap-6"
          style={{ borderTop: "1px solid color-mix(in srgb, currentColor 12%, transparent)" }}>
          <Brand size={19} />
          {/* Drawn rather than typed: Homemade Apple renders ":)" as a bare curve, not a face.
              The circle is deliberately not a perfect ellipse so it reads as pen. */}
          <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden
            fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
            style={{ opacity: .42, transform: "rotate(7deg)" }}>
            <path d="M20.4 3.6c9 .2 16.2 7.6 16 16.7-.2 9-7.7 16.2-16.7 16-9-.2-16.1-7.6-16-16.6.3-9 7.7-16.2 16.7-16.1z" />
            <path d="M13.6 16.8c.6-1.4 1.4-1.4 2 0" />
            <path d="M24.6 16.6c.6-1.4 1.4-1.4 2 .1" />
            <path d="M12.9 24.3c3.6 3.8 10.9 3.9 14.6.1" />
          </svg>
        </div>

        <span className="paper-fold" aria-hidden />
      </div>
    </section>
  );
}
