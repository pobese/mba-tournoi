// Les fonts (Bebas / DM Sans / Space Mono) sont chargées globalement dans le
// root layout (src/app/layout.tsx) → ce layout n'a plus qu'à transmettre.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
