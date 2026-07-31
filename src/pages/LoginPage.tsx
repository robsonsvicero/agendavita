import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useAuth } from '../providers/AuthProvider'

const platformAdminEmail = 'robsonsvicero@outlook.com'

export function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to={user.email?.toLowerCase() === platformAdminEmail ? '/admin-geral' : '/painel'} replace />
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return setMessage('Configure o Supabase antes de entrar.')
    setBusy(true); setMessage('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) return setMessage(error.message)
    navigate(data.user.email?.toLowerCase() === platformAdminEmail ? '/admin-geral' : '/painel')
  }
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-5"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
    <h1 className="text-2xl font-bold">Acessar Agenda Vita</h1><p className="mt-2 text-sm text-slate-600">Use as credenciais fornecidas pelo administrador.</p>
    {!isSupabaseConfigured && <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Configure o arquivo <code>.env</code> a partir de <code>.env.example</code>.</p>}
    <label className="mt-6 block text-sm font-medium">E-mail<input value={email} onChange={e => setEmail(e.target.value)} type="email" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-vita-600" /></label>
    <label className="mt-4 block text-sm font-medium">Senha<input value={password} onChange={e => setPassword(e.target.value)} type="password" required className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-vita-600" /></label>
    {message && <p className="mt-4 text-sm text-red-700">{message}</p>}
    <button disabled={busy} className="mt-6 w-full rounded-lg bg-vita-600 py-3 font-semibold text-white disabled:opacity-60">{busy ? 'Entrando…' : 'Entrar'}</button>
  </form></main>
}
