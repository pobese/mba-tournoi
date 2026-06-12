import { create } from 'zustand'
import type { Tournament, Round } from '@/types/app'

interface TournamentState {
  activeTournament: Tournament | null
  currentRound: Round | null
  setActiveTournament: (t: Tournament) => void
  setCurrentRound: (r: Round) => void
  reset: () => void
}

export const useTournamentStore = create<TournamentState>((set) => ({
  activeTournament: null,
  currentRound: null,
  setActiveTournament: (activeTournament) => set({ activeTournament }),
  setCurrentRound: (currentRound) => set({ currentRound }),
  reset: () => set({ activeTournament: null, currentRound: null }),
}))
