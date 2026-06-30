import type { Metadata, Viewport } from 'next'
import { Inter, Barlow_Condensed, JetBrains_Mono, Bebas_Neue, DM_Sans, Space_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { ThemeInitializer } from '@/components/ThemeInitializer'
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister'

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

// Fonts de la landing — désormais globales (réutilisées par /settings et la nav app).
// preload: false → pas de poids ajouté aux pages app qui ne s'en servent pas.
const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas',
  display: 'swap',
  preload: false,
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-dmsans',
  display: 'swap',
  preload: false,
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-spacemono',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  title: 'RacketClub — La plateforme des clubs de badminton',
  description:
    'Tournois, classements, entraînement — tout ce dont votre club de badminton a besoin.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  applicationName: 'RacketClub',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.svg',
    apple: '/icon-192.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RacketClub',
  },
}

export const viewport: Viewport = {
  themeColor: '#0f1117',
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
      className={`${inter.variable} ${barlowCondensed.variable} ${jetbrainsMono.variable} ${bebas.variable} ${dmSans.variable} ${spaceMono.variable} dark`}
    >
      <body>
        <ThemeInitializer />
        <ServiceWorkerRegister />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
