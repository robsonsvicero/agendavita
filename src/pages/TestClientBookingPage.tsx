import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { buildClientSiteTemplate } from '../lib/clientSiteTemplate'
import { fetchPublicBookingInfo } from '../lib/publicBooking'
import { PublicBookingExperience } from './PublicBookingPage'

export function TestClientBookingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSlug = searchParams.get('slug') ?? ''
  const [slugInput, setSlugInput] = useState(activeSlug)
  const info = useQuery({
    queryKey: ['test-client-page-info', activeSlug],
    enabled: Boolean(activeSlug),
    queryFn: () => fetchPublicBookingInfo(activeSlug),
  })

  useEffect(() => {
    setSlugInput(activeSlug)
  }, [activeSlug])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextSlug = slugInput.trim()
    setSearchParams(nextSlug ? { slug: nextSlug } : {})
  }

  const template = useMemo(() => buildClientSiteTemplate(activeSlug, info.data?.clinic), [activeSlug, info.data?.clinic])
  const pageStyle = {
    backgroundColor: template.surfaceColor,
    color: '#0f172a',
  } as CSSProperties
  const accentStyle = { color: template.accentColor }
  const panelStyle = { borderColor: template.borderColor, backgroundColor: template.panelColor }
  const subtlePanelStyle = { borderColor: template.borderColor, backgroundColor: '#ffffff' }
  const headerStyle = { borderColor: template.borderColor, backgroundColor: '#ffffffcc' }
  const heroStyle = { borderColor: template.borderColor, background: `linear-gradient(135deg, ${template.surfaceColor} 0%, ${template.panelColor} 100%)` }
  const ctaStyle = { backgroundColor: template.accentSoftColor }

  const directUrl = activeSlug ? `${window.location.origin}/#/agendar/${activeSlug}` : 'Defina um slug para gerar a URL.'

  return <div className="min-h-screen" style={pageStyle}>
    <header className="border-b backdrop-blur-sm" style={headerStyle}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em]" style={accentStyle}>{template.badge}</p>
          <h1 className="font-serif text-2xl font-semibold">{template.siteName}</h1>
        </div>
        <nav className="flex items-center gap-6 text-sm text-slate-600">
          {template.nav.map(item => <a key={item.id} href={`#${item.id}`}>{item.label}</a>)}
        </nav>
      </div>
    </header>

    <section className="border-b" style={heroStyle}>
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em]" style={accentStyle}>{template.sectionEyebrow}</p>
          <h2 className="mt-4 max-w-xl text-4xl font-semibold leading-tight">{template.heroTitle}</h2>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">{template.heroDescription}</p>
        </div>
        <div className="rounded-3xl border p-6 shadow-sm" style={subtlePanelStyle}>
          <h3 className="text-lg font-semibold">Configurar demonstração</h3>
          <p className="mt-2 text-sm text-slate-600">Exemplo de uso: clinica-centro</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Slug da organização
              <input value={slugInput} onChange={event => setSlugInput(event.target.value)} placeholder="clinica-centro" className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-vita-600" />
            </label>
            <button className="w-full rounded-xl px-4 py-3 font-semibold text-white" style={ctaStyle}>Abrir prévia</button>
          </form>
          <div className="mt-5 rounded-2xl p-4 text-sm text-slate-600" style={panelStyle}>
            <p>URL pública direta:</p>
            <p className="mt-1 break-all font-medium text-slate-900">{directUrl}</p>
          </div>
          <div className="mt-4 rounded-2xl p-4 text-sm text-slate-600" style={panelStyle}>
            <p className="font-medium text-slate-900">Template aplicado</p>
            <p className="mt-1">Header, hero, cores e rodapé são resolvidos automaticamente pelo slug e podem receber overrides centralizados.</p>
          </div>
        </div>
      </div>
    </section>

    <section id="servicos" className="mx-auto max-w-6xl px-6 pt-14">
      <div className="grid gap-6 md:grid-cols-3">
        {[ 'Jornada alinhada ao branding', 'Agendamento sem iframe', 'Template replicável por slug' ].map(item => <article key={item} className="rounded-3xl border p-6 shadow-sm" style={subtlePanelStyle}>
          <p className="text-sm font-medium" style={accentStyle}>Template base</p>
          <h3 className="mt-3 text-xl font-semibold">{item}</h3>
          <p className="mt-3 text-sm text-slate-600">Estrutura pronta para usar o mesmo shell visual em qualquer cliente, alterando apenas configuração e conteúdo.</p>
        </article>)}
      </div>
    </section>

    <section id="agendamento" className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.25em]" style={accentStyle}>Prévia real</p>
          <h2 className="mt-3 text-3xl font-semibold">{template.bookingTitle}</h2>
          <p className="mt-3 max-w-2xl text-slate-600">{template.bookingDescription}</p>
        </div>
        <Link to="/entrar" className="text-sm font-medium text-slate-600 hover:text-slate-900">Voltar ao painel</Link>
      </div>

      {activeSlug ? <div className="rounded-[2rem] border bg-white p-4 shadow-sm sm:p-8" style={subtlePanelStyle}>
        <PublicBookingExperience slug={activeSlug} backHref="/teste-agendamento" backLabel="Voltar ao topo da página" />
      </div> : <div className="rounded-[2rem] border border-dashed p-10 text-center text-slate-600" style={panelStyle}>
        Informe um slug acima para carregar a prévia de agendamento.
      </div>}

      {activeSlug && info.error ? <p className="mt-4 text-sm text-red-700">Não foi possível carregar os dados da organização para montar o template.</p> : null}
    </section>

    <footer id="equipe" className="border-t" style={headerStyle}>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-10 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>{template.footerPrimary}</p>
        <p>{template.footerSecondary}</p>
      </div>
    </footer>
  </div>
}
