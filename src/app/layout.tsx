import type { Metadata } from 'next'
import { Inter, Barlow_Condensed, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { ThemeInitializer } from '@/components/ThemeInitializer'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-barlow',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MBA Tournoi — Gestion de tournois de badminton',
  description: 'Organisez vos tournois de badminton : américain, classique ou par rounds.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="fr"
      data-theme="dark"
      className={`${inter.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} dark`}
    >
      <body>
        <ThemeInitializer />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
