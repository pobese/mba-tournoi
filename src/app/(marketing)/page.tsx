'use client'

import { useState } from 'react'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { HomeView } from '@/components/marketing/HomeView'
import { PlayerView } from '@/components/marketing/PlayerView'
import { ClubView } from '@/components/marketing/ClubView'
import { OrganizerView } from '@/components/marketing/OrganizerView'
import type { MarketingView } from '@/components/marketing/data'

// Landing « single-page experience » : navigation Accueil/Joueur/Club/Organisateur
// via state local (pas de routing Next), comme la maquette de référence.
export default function MarketingLanding() {
  const [view, setView] = useState<MarketingView>('home')

  return (
    <main className="rc-landing min-h-screen bg-app font-dmsans text-text">
      <MarketingNav active={view} onChange={setView} />

      {view === 'home' && <HomeView />}
      {view === 'player' && <PlayerView />}
      {view === 'club' && <ClubView />}
      {view === 'organizer' && <OrganizerView />}

      <MarketingFooter />
    </main>
  )
}
