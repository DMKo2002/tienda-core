'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem('cookies_accepted')) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem('cookies_accepted', '1')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-charcoal)] text-white px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
      <p className="text-xs text-white/70 leading-relaxed max-w-2xl">
        Usamos cookies para mejorar tu experiencia de navegación.{' '}
        <Link href="/politica-cookies" className="underline hover:text-white transition-colors">
          Conocé nuestra política de cookies.
        </Link>
      </p>
      <button
        onClick={accept}
        className="flex-shrink-0 text-xs tracking-[0.15em] uppercase bg-white text-[var(--color-charcoal)] px-5 py-2 hover:bg-white/90 transition-colors font-medium"
      >
        Aceptar
      </button>
    </div>
  )
}
