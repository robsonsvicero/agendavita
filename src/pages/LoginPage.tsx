import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useAuth } from '../providers/AuthProvider'

const platformAdminEmail = 'robsonsvicero@outlook.com'

export function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [successNotice, setSuccessNotice] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={user.email?.toLowerCase() === platformAdminEmail ? '/admin-geral' : '/painel'} replace />

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return setMessage('Configure o Supabase antes de entrar.')
    setBusy(true)
    setMessage('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        return setMessage('E-mail ou senha incorretos.')
      }
      return setMessage(error.message)
    }
    navigate(data.user.email?.toLowerCase() === platformAdminEmail ? '/admin-geral' : '/painel')
  }

  const submitForgot = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return setMessage('Configure o Supabase.')
    setBusy(true)
    setMessage('')
    setSuccessNotice('')

    const redirectTo = `${window.location.origin}/redefinir-senha`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo,
    })
    setBusy(false)

    if (error) {
      return setMessage(`Erro: ${error.message}`)
    }

    setSuccessNotice('Enviamos um link de recuperação para o seu e-mail. Verifique sua caixa de entrada e spam.')
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-5">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold">
          {mode === 'login' ? 'Acessar Agenda Vita' : 'Recuperar senha'}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {mode === 'login'
            ? 'Use as credenciais fornecidas pelo administrador.'
            : 'Informe seu e-mail para receber as instruções de recuperação.'}
        </p>

        {!isSupabaseConfigured && (
          <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Configure o arquivo <code>.env</code> a partir de <code>.env.example</code>.
          </p>
        )}

        {mode === 'login' ? (
          <form onSubmit={submitLogin} className="mt-6">
            <label className="block text-sm font-medium">
              E-mail
              <input
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
                required
                placeholder="seu@email.com"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition-colors focus:border-vita-600"
              />
            </label>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Senha</label>
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    setMessage('')
                    setSuccessNotice('')
                  }}
                  className="text-xs font-semibold text-vita-700 hover:text-vita-800 hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative mt-1.5">
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Sua senha"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 outline-none transition-colors focus:border-vita-600"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {message && <p className="mt-4 text-sm text-red-700">{message}</p>}

            <button
              disabled={busy}
              className="mt-6 w-full rounded-lg bg-vita-600 py-3 font-semibold text-white transition-opacity hover:bg-vita-700 disabled:opacity-60"
            >
              {busy ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        ) : (
          <form onSubmit={submitForgot} className="mt-6">
            {successNotice ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="mt-0.5 text-emerald-600 shrink-0" />
                  <p className="text-xs leading-relaxed">{successNotice}</p>
                </div>
              </div>
            ) : (
              <label className="block text-sm font-medium">
                E-mail cadastrado
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  required
                  placeholder="seu@email.com"
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none transition-colors focus:border-vita-600"
                />
              </label>
            )}

            {message && <p className="mt-4 text-sm text-red-700">{message}</p>}

            {!successNotice && (
              <button
                disabled={busy}
                className="mt-6 w-full rounded-lg bg-vita-600 py-3 font-semibold text-white transition-opacity hover:bg-vita-700 disabled:opacity-60"
              >
                {busy ? 'Enviando link…' : 'Enviar link para redefinir senha'}
              </button>
            )}

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setMessage('')
                  setSuccessNotice('')
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft size={14} /> Voltar para o login
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
