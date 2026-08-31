export function TeamNote() {
  return (
    <section id="note" className="shell py-16">
      <div className="paper px-7 sm:px-12 py-11 sm:py-12 max-w-[44rem] mx-auto">
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

        <div className="relative z-[1] mt-10 pt-6"
          style={{ borderTop: "1px solid color-mix(in srgb, currentColor 12%, transparent)" }}>
          <p className="text-[14.5px] font-medium tracking-[-.01em] paper-muted">Flexprice team</p>
        </div>

        <span className="paper-fold" aria-hidden />
      </div>
    </section>
  );
}
