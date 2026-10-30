import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { useAuth } from '../providers/AuthProvider'

export function ResetPasswordPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  // Verifica se há sessão ativa (gerada após o clique no link de recuperação de e-mail do Supabase)
  const [isRecoverySession, setIsRecoverySession] = useState<boolean | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      // Se há um usuário na sessão (o link de reset do Supabase loga temporariamente para troca de senha)
      setIsRecoverySession(Boolean(data.session?.user))
    })
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return setMessage('Configure o Supabase.')
    if (password.length < 8) {
      return setMessage('A nova senha deve ter no mínimo 8 caracteres.')
    }
    if (password !== confirmPassword) {
      return setMessage('As senhas digitadas não coincidem.')
    }

    setBusy(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)

    if (error) {
      return setMessage(`Erro: ${error.message}`)
    }

    setSuccess(true)
    window.setTimeout(() => {
      navigate('/entrar')
    }, 2500)
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-5">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-vita-50 text-vita-700">
            <KeyRound size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Cadastrar nova senha</h1>
            <p className="text-xs text-slate-500">Defina sua nova credencial de acesso.</p>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Configure o arquivo <code>.env</code> com o Supabase.
          </p>
        )}

        {success ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
            <h2 className="mt-2 text-base font-semibold text-emerald-950">Senha atualizada com sucesso!</h2>
            <p className="mt-1 text-xs text-emerald-800">Redirecionando para a tela de login...</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {isRecoverySession === false && (
              <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Atenção: Para redefinir a senha, utilize o link seguro enviado para o seu e-mail. Se já clicou nele, certifique-se de que a sessão não expirou.
              </p>
            )}

            <div>
              <label className="block text-sm font-medium">Nova senha</label>
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 outline-none transition-colors focus:border-vita-600"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Confirme a nova senha</label>
              <div className="relative mt-1.5">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-10 outline-none transition-colors focus:border-vita-600"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Exibir confirmação de senha'}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {message && <p className="text-xs text-red-700">{message}</p>}

            <button
              disabled={busy}
              className="w-full rounded-lg bg-vita-600 py-3 font-semibold text-white transition-opacity hover:bg-vita-700 disabled:opacity-60"
            >
              {busy ? 'Salvando...' : 'Salvar nova senha'}
            </button>

            <div className="text-center pt-2">
              <Link to="/entrar" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-vita-700">
                <ArrowLeft size={14} /> Voltar para o login
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
