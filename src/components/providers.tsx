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
            background: '#1a1d2e',
            border: '1px solid #2e3150',
            color: '#f1f5f9',
          },
        }}
      />
    </>
  )
}
