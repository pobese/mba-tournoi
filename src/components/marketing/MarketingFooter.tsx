export function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-surface/40 px-4 py-10 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <span className="font-bebas text-xl tracking-[2px] text-primary">
          RACKET<span className="text-text">CLUB</span>
        </span>
        <span className="text-2xl">🏸</span>
        <p className="text-sm text-muted">
          © 2026 RacketClub — Tournois publics &amp; clubs privés. Construit par des joueurs.
        </p>
      </div>
    </footer>
  )
}
