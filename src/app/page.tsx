import Link from 'next/link'
import { ArrowRight, Zap, Trophy, Users } from 'lucide-react'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-app flex flex-col">
      {/* Hero */}
      <section className="hero-section flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-primary-dim/30 text-primary border border-primary/30 rounded-full px-4 py-1.5 text-sm font-medium mb-8">
          <Zap className="w-3.5 h-3.5" />
          Tournois de badminton en temps réel
        </div>

        <h1 className="font-display text-5xl sm:text-7xl font-extrabold text-white mb-6 leading-tight">
          MBA{' '}
          <span className="text-primary">Tournoi</span>
        </h1>

        <p className="text-muted text-lg sm:text-xl max-w-xl mb-10">
          Organisez vos tournois de badminton — américain, classique ou par rounds.
          Scores en temps réel, classements automatiques.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 bg-primary text-app font-bold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
          >
            Créer un tournoi
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 bg-surface border border-subtle text-white font-medium px-6 py-3 rounded-lg hover:bg-surface-alt transition-colors"
          >
            Se connecter
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-subtle py-16 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            {
              icon: Users,
              title: 'Tournoi Américain',
              desc: 'Partenaires rotatifs, classement individuel par points marqués.',
            },
            {
              icon: Trophy,
              title: 'Tournoi Classique',
              desc: 'Bracket à élimination directe avec tableau principal et consolante.',
            },
            {
              icon: Zap,
              title: 'Tournoi par Rounds',
              desc: 'Système serpent — niveau équilibré à chaque round.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-surface border border-subtle rounded-xl p-6">
              <Icon className="w-8 h-8 text-primary mb-3" />
              <h3 className="font-display font-bold text-white text-lg mb-2">{title}</h3>
              <p className="text-muted text-sm">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
