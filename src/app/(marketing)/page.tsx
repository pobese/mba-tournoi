import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { HomeView } from '@/components/marketing/HomeView'
import { PlayerView } from '@/components/marketing/PlayerView'
import { ClubView } from '@/components/marketing/ClubView'
import { OrganizerView } from '@/components/marketing/OrganizerView'
import type { MarketingView } from '@/components/marketing/data'

const VIEWS: MarketingView[] = ['home', 'player', 'club', 'organizer']

// Landing « single-page experience » : la vue active est pilotée par ?view=…
// (la navbar pointe vers /?view=… → les onglets fonctionnent aussi depuis /settings).
export default function MarketingLanding({ searchParams }: { searchParams: { view?: string } }) {
  const view: MarketingView = VIEWS.includes(searchParams.view as MarketingView)
    ? (searchParams.view as MarketingView)
    : 'home'

  return (
    <main className="rc-landing min-h-screen bg-app font-dmsans text-text">
      <MarketingNav active={view} />

      {view === 'home' && <HomeView />}
      {view === 'player' && <PlayerView />}
      {view === 'club' && <ClubView />}
      {view === 'organizer' && <OrganizerView />}

      <MarketingFooter />
    </main>
  )
}
