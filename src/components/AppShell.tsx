import { CalendarDays, LogOut, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../providers/AuthProvider'

export function AppShell({ title, children }: { title: string, children: React.ReactNode }) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const leave = async () => { await signOut(); navigate('/entrar') }
  return <div className="min-h-screen">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link to="/" className="flex items-center gap-2 font-bold text-vita-700"><CalendarDays size={22} /> Agenda Vita</Link>
        <div className="flex items-center gap-4 text-sm text-slate-600">
          <span className="hidden sm:inline">{user?.email}</span>
          <button onClick={leave} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100"><LogOut size={16} /> Sair</button>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-8 flex items-center gap-3"><div className="rounded-xl bg-vita-50 p-3 text-vita-700"><ShieldCheck size={22} /></div><h1 className="text-2xl font-bold">{title}</h1></div>
      {children}
    </main>
  </div>
}
