import { useState, type FormEvent } from 'react'
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

export function ChangePasswordCard() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setIsSuccess(false)

    if (!supabase) {
      setMessage('Erro: Conexão com o Supabase não configurada.')
      return
    }

    if (password.length < 8) {
      setMessage('Erro: A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setMessage('Erro: As senhas digitadas não coincidem.')
      return
    }

    setBusy(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setMessage(`Erro: ${error.message}`)
        return
      }

      setIsSuccess(true)
      setMessage('Sua senha foi alterada com sucesso.')
      setPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      setShowConfirmPassword(false)
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Falha ao atualizar a senha.'
      setMessage(`Erro: ${errorMsg}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-vita-50 text-vita-700">
          <KeyRound size={20} />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">Segurança da conta</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            Altere sua senha de acesso à plataforma.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Nova senha
          </label>
          <div className="relative mt-1.5">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mínimo de 8 caracteres"
              required
              minLength={8}
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-vita-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
              aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
              title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Confirmar nova senha
          </label>
          <div className="relative mt-1.5">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Digite a nova senha novamente"
              required
              minLength={8}
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm outline-none transition-colors focus:border-vita-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirmPassword(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
              aria-label={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
              title={showConfirmPassword ? 'Ocultar senha' : 'Exibir senha'}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={busy || !password}
            className="rounded-lg bg-vita-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-vita-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? 'Salvando...' : 'Alterar senha'}
          </button>
        </div>
      </form>

      {message && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-lg p-3 text-sm ${
            isSuccess ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {isSuccess && <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />}
          <span>{message}</span>
        </div>
      )}
    </section>
  )
}

