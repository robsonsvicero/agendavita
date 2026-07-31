import type { PublicClinic } from './publicBooking'

export type ClientSiteSection = {
  id: string
  label: string
}

export type ClientSiteTemplateConfig = {
  badge: string
  siteName: string
  heroTitle: string
  heroDescription: string
  sectionEyebrow: string
  bookingTitle: string
  bookingDescription: string
  footerPrimary: string
  footerSecondary: string
  nav: ClientSiteSection[]
  accentColor: string
  accentSoftColor: string
  surfaceColor: string
  borderColor: string
  panelColor: string
}

const defaultNav: ClientSiteSection[] = [
  { id: 'servicos', label: 'Serviços' },
  { id: 'equipe', label: 'Equipe' },
  { id: 'agendamento', label: 'Agendamento' },
]

const organizationTemplateOverrides: Record<string, Partial<ClientSiteTemplateConfig>> = {
  'clinica-centro': {
    badge: 'Odontologia integrada',
    heroTitle: 'Cuidado contínuo com uma jornada de agendamento simples e alinhada ao site da clínica.',
    heroDescription: 'Este template já entra com identidade visual, navegação e conteúdo prontos para encaixar o agendamento sem depender de iframe.',
    footerSecondary: 'Template base Agenda Vita parametrizado para a Clínica Centro.',
  },
}

function rgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3 ? normalized.split('').map(char => char + char).join('') : normalized
  const [r, g, b] = [full.slice(0, 2), full.slice(2, 4), full.slice(4, 6)].map(value => Number.parseInt(value, 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function buildClientSiteTemplate(slug: string, clinic?: PublicClinic): ClientSiteTemplateConfig {
  const siteName = clinic?.name || 'Clínica Exemplo Integrada'
  const specialty = clinic?.specialty?.trim()
  const accentColor = clinic?.primary_color || '#8b6f47'
  const accentSoftColor = clinic?.secondary_color || '#6f5b3e'
  const surfaceColor = clinic?.background_color || '#f5efe6'
  const borderColor = rgba(accentColor, 0.22)
  const panelColor = rgba(accentColor, 0.06)

  const base: ClientSiteTemplateConfig = {
    badge: specialty ? `${specialty} digital` : 'Site integrado',
    siteName,
    heroTitle: specialty ? `${specialty} com agendamento digital dentro da experiência do seu site.` : 'Uma página de agendamento integrada ao site do cliente.',
    heroDescription: specialty ? `Use este template para apresentar ${siteName} com header, footer, conteúdo institucional e o formulário público do Agenda Vita no mesmo fluxo.` : 'Use este template para manter navegação, branding e conteúdo institucional enquanto o Agenda Vita cuida do agendamento.',
    sectionEyebrow: 'Demonstração reutilizável',
    bookingTitle: `Agende com ${siteName}`,
    bookingDescription: specialty ? `Fluxo público configurado para ${specialty.toLowerCase()}, pronto para encaixar em qualquer site React.` : 'Fluxo público pronto para encaixar em qualquer site React.',
    footerPrimary: `${siteName}. Este rodapé continua sendo parte do site do cliente.`,
    footerSecondary: 'Agenda Vita operando como motor de agendamento.',
    nav: defaultNav,
    accentColor,
    accentSoftColor,
    surfaceColor,
    borderColor,
    panelColor,
  }

  return { ...base, ...organizationTemplateOverrides[slug] }
}
