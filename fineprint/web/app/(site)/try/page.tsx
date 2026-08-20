// fineprint/web/app/(site)/try/page.tsx
import { Playground } from "@/components/playground";

export const metadata = { title: "Try it · FinePrint" };

export default function TryPage() {
  return (
    <section className="shell py-14">
      <p className="eyebrow mb-3">Try it yourself</p>
      <h1 className="display text-[clamp(1.9rem,4vw,2.7rem)]">Watch a model read a contract.</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-muted max-w-[62ch]">
        Pick a sample or bring your own, choose a model, and see it extract the billing terms into a
        structured schema — every field cited back to the exact line it read.
      </p>
      <div className="mt-8"><Playground /></div>
    </section>
  );
}
