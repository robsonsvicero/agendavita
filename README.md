# Agenda Vita

Aplicação React, TypeScript e Tailwind CSS para agendamento de clínicas e profissionais.

## Desenvolvimento

1. Copie `.env.example` para `.env` e preencha a URL e a chave `anon/publishable` do Supabase.
2. Execute `npm install`.
3. Execute `npm run dev`.

Nunca use uma chave `service_role` em variáveis `VITE_*` ou no navegador.

## Rotas

- `/#/`: apresentação e futuro agendamento público.
- `/#/entrar`: acesso de usuários convidados.
- `/#/admin-geral`: painel exclusivo de `robsonsvicero@outlook.com`.
- `/#/painel`: painel de clínicas e profissionais.

O `HashRouter` evita erros 404 ao recarregar páginas em hospedagem estática, como Hostinger.

## Produção

Execute `npm run build` e envie apenas o conteúdo de `dist/` para a hospedagem estática.

## Painel administrativo geral

O painel usa a Edge Function [admin-organizations](supabase/functions/admin-organizations/index.ts). Depois de aplicar o schema, publique a função com a Supabase CLI:

```bash
supabase functions deploy admin-organizations
```

A função usa `SUPABASE_SERVICE_ROLE_KEY` somente no ambiente seguro do Supabase para criar usuários. Não defina essa chave no `.env` do Vite.
