import Image from "next/image";
import { DEMO_URL } from "@/components/site-nav";
import { AsciiOverlay } from "@/components/ascii-overlay";

export function FlexpriceCta() {
  return (
    <section className="fp-flex-cta relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10" aria-hidden>
        <Image
          src="/hero/style-archive.webp"
          alt=""
          fill
          sizes="100vw"
          className="fp-flex-cta-art object-cover"
        />
        <AsciiOverlay src="/hero/style-archive.webp" />
        <div className="fp-flex-cta-wash" />
      </div>

      <div className="shell relative py-20 sm:py-28 text-center">
        <h2 className="display text-[clamp(1.75rem,4.2vw,2.85rem)] max-w-[16ch] mx-auto">
          Fix your billing today with Flexprice
        </h2>
        <p className="mt-4 text-[14.5px] sm:text-[15.5px] leading-relaxed text-muted max-w-[48ch] mx-auto">
          FinePrint finds which models can read the contract.
          <br />
          Flexprice already turns those terms into accurate invoices.
        </p>
        <a
          href={DEMO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-lg mt-8 inline-flex"
        >
          Book a demo
        </a>
      </div>
    </section>
  );
}
