import Link from "next/link";

export default function Home() {
  return (
    <div className="relative min-h-screen bg-grid flex flex-col">
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-accent/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-4 sm:px-6 py-20 sm:py-24">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/20 bg-accent/5 text-accent text-xs font-mono mb-6 sm:mb-8 opacity-0 animate-fade-up"
          style={{ animationFillMode: "forwards" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
          Powered by FairScale reputation
        </div>

        <h1
          className="font-display text-4xl sm:text-5xl md:text-7xl font-bold text-text leading-[0.95] tracking-tight mb-4 sm:mb-6 opacity-0 animate-fade-up animation-delay-100"
          style={{ animationFillMode: "forwards" }}
        >
          Drop it<br />
          <span className="text-accent">let real people claim it.</span>
        </h1>

        <p
          className="font-body text-muted text-base sm:text-lg max-w-sm sm:max-w-md mb-8 sm:mb-10 opacity-0 animate-fade-up animation-delay-200"
          style={{ animationFillMode: "forwards" }}
        >
          Create on-chain token drops gated by wallet reputation.
          Share a link. Let your community claim.
        </p>

        <div
          className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto opacity-0 animate-fade-up animation-delay-300"
          style={{ animationFillMode: "forwards" }}
        >
          <Link
            href="/create"
            className="px-8 py-4 rounded-xl bg-accent text-bg font-display font-bold text-sm hover:bg-accent/90 transition-all active:scale-[0.98] text-center"
          >
            Create Drop →
          </Link>
          <a
            href="https://fairscale.xyz"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 rounded-xl border border-border text-muted font-display font-bold text-sm hover:border-accent/40 hover:text-text transition-all text-center"
          >
            What is FairScale?
          </a>
        </div>
      </section>

      {/* How it works */}
      <section className="relative max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24 w-full">
        <h2 className="font-display text-xs font-bold text-muted uppercase tracking-widest text-center mb-8 sm:mb-10">
          How it works
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {[
            { n: "01", title: "Create", body: "Deposit SOL or any SPL token. Set the number of winners and optionally require a minimum FairScale reputation score." },
            { n: "02", title: "Share", body: "Get a unique claim link. Post it on X, Discord, or anywhere. First come, first served." },
            { n: "03", title: "Claim", body: "Claimers connect their wallet. Our backend verifies their FairScale score and issues a signed claim token on-chain." },
          ].map(item => (
            <div key={item.n} className="bg-surface border border-border rounded-2xl p-5 sm:p-6 space-y-3">
              <span className="font-mono text-xs text-accent/60">{item.n}</span>
              <h3 className="font-display font-bold text-text">{item.title}</h3>
              <p className="font-body text-muted text-sm leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="border-t border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-3 divide-x divide-border text-center">
          {[
            { label: "Platform fee", value: "1%" },
            { label: "Any SPL token", value: "✓" },
            { label: "Bot protection", value: "FairScale" },
          ].map(s => (
            <div key={s.label} className="px-3 sm:px-6">
              <p className="font-display text-xl sm:text-2xl font-bold text-text">{s.value}</p>
              <p className="font-body text-xs text-muted mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
