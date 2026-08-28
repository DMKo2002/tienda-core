'use client'

import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/tienda')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-1.5 text-xs text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors uppercase tracking-[0.1em]"
    >
      <LogOut size={13} />
      Cerrar sesión
    </button>
  )
}
