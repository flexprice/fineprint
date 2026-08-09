import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";

// Chrome for the public site (nav + footer + grid backdrop). The /embed route lives
// outside this group, so it renders bare — only the root <html>/<body> shell.
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen flex flex-col bg-grid">
      <SiteNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
