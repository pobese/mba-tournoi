'use client'

import { useState } from 'react'
import { BRACKET, MEMBERS, COURTS, COURT_LABELS, SCORE_ENTRIES, type CourtSlot } from './data'

type Tab = 'bracket' | 'players' | 'courts'

const TABS: { id: Tab; label: string }[] = [
  { id: 'bracket', label: '🏆 Tableau' },
  { id: 'players', label: '👥 Joueurs' },
  { id: 'courts', label: '🎯 Terrains' },
]

const SLOT_STYLE: Record<CourtSlot, { cls: string; label: string }> = {
  free: { cls: 'border-primary/20 bg-primary/10 text-primary', label: 'Libre' },
  booked: { cls: 'border-danger/20 bg-danger/10 text-danger', label: 'Match' },
  pending: { cls: 'border-accent/20 bg-accent/10 text-accent', label: 'Attente' },
}

export function OrganizerView() {
  const [tab, setTab] = useState<Tab>('bracket')

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-8">
      <h1 className="font-bebas text-3xl tracking-[2px] text-text sm:text-4xl">OPEN AMÉRICAIN MAULE — 🏸</h1>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <span>📅 Samedi 5 Juillet 2026</span>
        <span>👥 24 joueurs inscrits</span>
        <span>🏢 MBA</span>
        <span className="text-primary">✅ Tournoi en cours</span>
      </div>

      {/* Tabs */}
      <div className="mt-6 inline-flex gap-1 rounded-lg bg-surface-alt p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-surface font-bold text-text' : 'text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === 'bracket' && <BracketTab />}
        {tab === 'players' && <PlayersTab />}
        {tab === 'courts' && <CourtsTab />}
      </div>
    </div>
  )
}

function BracketTab() {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-[680px] items-center gap-6">
        {BRACKET.map((round, ri) => {
          const isFinal = ri === BRACKET.length - 1
          return (
            <div key={round.round} className="flex items-center gap-6">
              <div className="flex flex-col gap-5">
                <div className="text-center font-spacemono text-[0.65rem] uppercase tracking-[2px] text-muted">
                  {round.round}
                </div>
                {round.matches.map((m, mi) => (
                  <div
                    key={mi}
                    className={`w-44 overflow-hidden rounded-lg border bg-surface ${
                      isFinal ? 'border-primary/25' : 'border-white/[0.06]'
                    }`}
                  >
                    {[
                      { name: m.p1, score: m.s1, win: m.winner === 1 },
                      { name: m.p2, score: m.s2, win: m.winner === 2 },
                    ].map((p, pi) => (
                      <div
                        key={pi}
                        className={`flex items-center justify-between px-3 py-2 text-sm ${
                          pi === 0 ? 'border-b border-white/[0.04]' : ''
                        } ${p.win ? 'bg-primary/[0.08]' : ''}`}
                      >
                        <span className={p.win ? 'font-bold text-primary' : 'text-text'}>{p.name}</span>
                        <span className="font-spacemono text-sm font-bold text-muted">{p.score}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {!isFinal && <div className="text-xl text-muted">→</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlayersTab() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06] bg-surface">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-white/[0.06] text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-semibold">#</th>
            <th className="px-4 py-3 font-semibold">Joueur</th>
            <th className="px-4 py-3 font-semibold">Niveau</th>
            <th className="px-4 py-3 font-semibold">V/D</th>
            <th className="hidden px-4 py-3 font-semibold sm:table-cell">Badge</th>
          </tr>
        </thead>
        <tbody>
          {MEMBERS.map((p, i) => (
            <tr key={p.email} className="border-b border-white/[0.04] text-sm">
              <td className="px-4 py-3 text-muted">{i + 1}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {p.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-semibold text-text">{p.name}</div>
                    <div className="text-xs text-muted">{p.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-muted">{p.level}</td>
              <td className="px-4 py-3 font-spacemono text-primary">
                {p.wins}V / {p.losses}D
              </td>
              <td className="hidden px-4 py-3 text-muted sm:table-cell">{p.badge}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CourtsTab() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Planning terrains */}
      <div className="rounded-2xl border border-white/[0.06] bg-surface p-5">
        <h2 className="mb-4 font-bold text-text">🗓 Planning des terrains</h2>
        <div className="grid grid-cols-5 gap-1.5 text-center">
          <div />
          {COURT_LABELS.map((c) => (
            <div key={c} className="font-spacemono text-xs text-muted">
              {c}
            </div>
          ))}
          {COURTS.map((row) => (
            <Row key={row.time} time={row.time} slots={row.slots} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
          <Legend cls="bg-primary/30" label="Libre" />
          <Legend cls="bg-danger/30" label="Match" />
          <Legend cls="bg-accent/30" label="Attente" />
        </div>
      </div>

      {/* Saisie des scores */}
      <div className="rounded-2xl border border-white/[0.06] bg-surface p-5">
        <h2 className="mb-4 font-bold text-text">✏️ Saisie des scores</h2>
        <div className="flex flex-col gap-3">
          {SCORE_ENTRIES.map((e) => (
            <div key={e.court} className="rounded-lg border border-white/[0.04] bg-surface-alt p-3">
              <div className="text-xs text-muted">{e.court}</div>
              <div className="mb-2 text-sm font-semibold text-text">{e.teams}</div>
              <div className="flex items-center gap-2">
                <ScoreBox value={e.s1} />
                <span className="font-spacemono text-muted">—</span>
                <ScoreBox value={e.s2} />
                <button
                  type="button"
                  className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Valider
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Row({ time, slots }: { time: string; slots: CourtSlot[] }) {
  return (
    <>
      <div className="self-center font-spacemono text-xs text-muted">{time}</div>
      {slots.map((s, i) => (
        <div
          key={i}
          className={`flex h-9 items-center justify-center rounded-md border text-[0.65rem] font-semibold ${SLOT_STYLE[s].cls}`}
        >
          {SLOT_STYLE[s].label}
        </div>
      ))}
    </>
  )
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ${cls}`} /> {label}
    </span>
  )
}

function ScoreBox({ value }: { value: string }) {
  return (
    <span className="flex h-9 w-12 items-center justify-center rounded-md border border-subtle bg-app font-spacemono text-sm text-text">
      {value || '–'}
    </span>
  )
}
