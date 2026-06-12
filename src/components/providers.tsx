'use client'

import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgb(var(--bg-surface))',
            border: '1px solid rgb(var(--border-subtle))',
            color: 'rgb(var(--color-text))',
          },
        }}
      />
    </>
  )
}
