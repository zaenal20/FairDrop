import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-bg grid-bg flex flex-col items-center justify-center text-center px-6">
      <p className="font-mono text-accent text-7xl font-bold mb-4">404</p>
      <h1 className="font-display text-2xl font-bold text-text mb-2">Page not found</h1>
      <p className="font-body text-muted text-sm mb-8 max-w-xs">
        This drop may have ended, or the link might be incorrect.
      </p>
      <div className="flex gap-3">
        <Link
          href="/"
          className="px-6 py-3 rounded-xl bg-accent text-bg font-display font-bold text-sm hover:bg-accent/90 transition-all"
        >
          Go Home
        </Link>
        <Link
          href="/create"
          className="px-6 py-3 rounded-xl border border-border text-muted font-display font-bold text-sm hover:border-accent/30 hover:text-text transition-all"
        >
          Create Drop
        </Link>
      </div>
    </div>
  );
}
