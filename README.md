# Agenda Vita — versão Supabase

Este diretório contém uma versão estática do projeto, compatível com hospedagem simples em Hostinger e com banco de dados no Supabase.

## Passos

1. Crie um projeto no Supabase.
2. Abra o SQL Editor e execute o conteúdo de [supabase/schema.sql](supabase/schema.sql).
3. Copie [supabase-config.js](supabase-config.js) e preencha com a URL e a chave anônima do seu projeto.
4. Suba a pasta para a hospedagem estática.

## Arquivos principais

- [index.html](index.html): página pública para buscar horários e criar agendamentos.
- [admin.html](admin.html): painel administrativo simples com login via Supabase Auth.
- [app.js](app.js): lógica de integração com o Supabase.
