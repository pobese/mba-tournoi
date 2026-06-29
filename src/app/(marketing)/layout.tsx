import { Bebas_Neue, DM_Sans } from 'next/font/google'

// Fonts de la landing (inspirées du design de référence) — scopées au route
// group (marketing) pour ne pas alourdir le reste de l'app, qui garde Inter/Barlow.
const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-dmsans',
  display: 'swap',
})

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${bebas.variable} ${dmSans.variable}`}>{children}</div>
}
