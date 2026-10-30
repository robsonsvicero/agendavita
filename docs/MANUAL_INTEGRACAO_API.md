# Manual de Integração — API Pública de Agendamentos (Agenda Vita)

Este guia contém o passo a passo completo para integrar o fluxo de agendamento online da Agenda Vita em qualquer novo site (Vercel, Netlify, WordPress, HTML puro, Next.js, React, etc.).

---

## Sumário
1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Passo 1: Pré-requisitos no Painel da Agenda Vita](#passo-1-pré-requisitos-no-painel-da-agenda-vita)
3. [Passo 2: Liberar o Domínio no Backend (CORS)](#passo-2-liberar-o-domínio-no-backend-cors)
4. [Passo 3: Configurar Variáveis de Ambiente no Novo Site](#passo-3-configurar-variáveis-de-ambiente-no-novo-site)
5. [Passo 4: Especificação dos Endpoints (Payloads e Respostas)](#passo-4-especificação-dos-endpoints)
6. [Passo 5: Exemplos Práticos de Código Frontend](#passo-5-exemplos-práticos-de-código-frontend)
7. [Checklist Rápido e Resolução de Problemas](#checklist-rápido-e-resolução-de-problemas)

---

## 1. Visão Geral da Arquitetura

- **Endpoint único da API**:  
  `POST https://dhfqgwoliffegiemhjdl.supabase.co/functions/v1/public-booking`
- **Autenticação**: Não requer login do paciente, apenas o envio da chave pública anônima (`apikey` ou `anon_key` do Supabase).
- **Rate Limit**: 10 requisições por minuto por IP para evitar spam e sobrecarga.
- **Identificação da Organização**: Cada clínica ou profissional possui um `slug` único registrado no banco (ex: `mariana-costa`, `clinica-sorriso`).

---

## Passo 1: Pré-requisitos no Painel da Agenda Vita

Antes de conectar o novo site, garanta que a organização está configurada no banco de dados / painel da Agenda Vita:

1. **Clínica / Organização**:
   - Ter um `slug` único (letras minúsculas e hífens, ex: `dra-mariana`).
   - Estar com `status = 'active'`.
2. **Profissional**:
   - Pelo menos um profissional cadastrado e ativo (`active = true`).
3. **Regras de Atendimento**:
   - **Horários de trabalho** (`working_hours`): Dias da semana (0 = Domingo a 6 = Sábado) e faixas de horário (ex: 08:00 às 18:00).
   - **Configuração de agenda** (`appointment_types`): Duração da consulta em minutos (ex: `30` ou `60`) e tempo de intervalo entre consultas (ex: `0` ou `15`).

---

## Passo 2: Liberar o Domínio no Backend (CORS)

Por segurança contra abusos, a Edge Function valida a origem das requisições via cabeçalho CORS.

1. No repositório `agendavita`, abra o arquivo:
   `supabase/functions/public-booking/index.ts`
2. No início do arquivo, verifique o array `allowedOrigins`:
   ```typescript
   const allowedOrigins = [
     'https://agendavita.com.br',
     'https://www.agendavita.com.br',
     'https://mariana-dentista.vercel.app',
     'https://novo-dominio-do-cliente.com.br', // <-- Adicione seu domínio de produção aqui
     'http://localhost:5173',
   ]
   ```
   > **Nota sobre Vercel:** O código já possui a regra `clean.endsWith('.vercel.app')`, o que significa que **qualquer subdomínio da Vercel** (incluindo links de preview e branch deploys) é aceito automaticamente. Para domínios próprios (`.com.br`, `.com`, etc.), é obrigatório adicionar no array.

3. **Publicar a alteração no Supabase**:
   Abra o terminal no projeto `agendavita` e execute:
   ```bash
   npx supabase functions deploy public-booking --project-ref dhfqgwoliffegiemhjdl
   ```

---

## Passo 3: Configurar Variáveis de Ambiente no Novo Site

No painel de hospedagem do novo site (Vercel, Netlify, Cloudflare Pages, etc.):

1. Acesse **Project Settings** > **Environment Variables**.
2. Adicione as chaves:

| Variável (Vite / CRA) | Variável (Next.js) | Valor |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `NEXT_PUBLIC_SUPABASE_URL` | `https://dhfqgwoliffegiemhjdl.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(Sua chave anon pública do Supabase)* |

3. Se o site estiver na Vercel e você acabou de salvar as variáveis, vá na aba **Deployments** e faça um **Redeploy** para aplicar.

---

## Passo 4: Especificação dos Endpoints

Todas as chamadas são feitas via `POST` com cabeçalho `Content-Type: application/json` e `apikey: <SUA_CHAVE_ANON>`.

### Ação 1: Obter dados da clínica, profissionais e recursos
Usado para carregar o nome da clínica, logo, cores personalizadas e a lista de profissionais disponíveis no seletor.

- **Payload enviado:**
  ```json
  {
    "slug": "dra-mariana",
    "action": "info"
  }
  ```

- **Resposta de sucesso (200 OK):**
  ```json
  {
    "clinic": {
      "id": 1,
      "name": "Dra. Mariana Costa",
      "address": "Av. Paulista, 1000 - Sala 42",
      "specialty": "Odontologia",
      "logo_url": "https://...",
      "primary_color": "#0f766e",
      "secondary_color": "#14b8a6",
      "background_color": "#f8fafc",
      "font_family": "Inter",
      "google_font_family": "Inter:wght@400;600;700"
    },
    "professionals": [
      {
        "id": 10,
        "name": "Dra. Mariana Costa",
        "specialty": "Ortodontia"
      }
    ],
    "resources": [
      {
        "id": 2,
        "name": "Consultório 1",
        "resource_type": "room"
      }
    ]
  }
  ```

---

### Ação 2: Consultar horários livres de uma data
Quando o paciente seleciona uma data no calendário, consulte os horários disponíveis para aquele profissional.

- **Payload enviado:**
  ```json
  {
    "slug": "dra-mariana",
    "action": "slots",
    "professionalId": 10,
    "resourceId": null,
    "date": "2026-11-10"
  }
  ```
  *(O formato da data deve ser rigorosamente `YYYY-MM-DD`).*

- **Regras aplicadas automaticamente pela API:**
  - Datas no passado não são permitidas.
  - Horários com menos de 2 horas de antecedência em relação ao horário atual são ocultados.
  - Ignora horários bloqueados na agenda (`schedule_blocks`).
  - Ignora horários já agendados (`appointments`).
  - Respeita os horários de início/fim configurados para o dia da semana (`working_hours`).

- **Resposta de sucesso (200 OK):**
  ```json
  {
    "slots": [
      "08:00",
      "08:45",
      "09:30",
      "10:15",
      "14:00",
      "14:45",
      "15:30"
    ]
  }
  ```

---

### Ação 3: Confirmar o agendamento
Envia os dados do agendamento e do paciente.

- **Payload enviado:**
  ```json
  {
    "slug": "dra-mariana",
    "action": "book",
    "professionalId": 10,
    "resourceId": null,
    "date": "2026-11-10",
    "time": "09:30",
    "specialty": "Avaliação Geral",
    "notes": "Primeira consulta, tem preferência por atendimento rápido",
    "patient": {
      "name": "Carlos Silva",
      "phone": "(11) 98765-4321",
      "email": "carlos.silva@exemplo.com",
      "birthDate": "1988-06-25",
      "address": "Rua das Palmeiras, 150"
    }
  }
  ```

  - **Campos obrigatórios:** `slug`, `action`, `professionalId`, `date`, `time`, `patient.name`, `patient.phone`.
  - **Campos opcionais:** `resourceId`, `specialty`, `notes`, `patient.email`, `patient.birthDate`, `patient.address`.
  - **E-mail de confirmação:** Se `patient.email` for fornecido e o `RESEND_API_KEY` estiver configurado no Supabase, a API enviará automaticamente um e-mail com layout formatado contendo os detalhes da consulta e endereço.

- **Resposta de sucesso (200 OK):**
  ```json
  {
    "success": true,
    "clinicName": "Dra. Mariana Costa"
  }
  ```

- **Possíveis erros retornados:**
  - `409 time_unavailable`: O horário acabou de ser reservado por outra pessoa ou ficou indisponível.
  - `400 invalid_booking_data`: Faltou algum campo obrigatório ou o formato da data é inválido.
  - `400 past_date_not_allowed`: Tentativa de agendar em data passada.
  - `429 rate_limited`: Muitas tentativas no mesmo minuto.
  - `404 clinic_not_found`: O `slug` informado não existe ou está inativo.

---

## Passo 5: Exemplos Práticos de Código Frontend

Você pode integrar usando **Fetch nativo** (funciona em qualquer lugar sem instalar pacotes) ou com a biblioteca oficial `@supabase/supabase-js`.

### Opção A: Usando Fetch Nativo (JavaScript / TypeScript)

Crie um arquivo `api.js` (ou `api.ts`) no novo projeto:

```javascript
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const API_URL = `${SUPABASE_URL}/functions/v1/public-booking`;

async function callPublicBooking(body) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Erro na requisição');
  }
  return data;
}

// 1. Carregar dados da clínica e profissionais
export async function getClinicInfo(slug) {
  return callPublicBooking({ slug, action: 'info' });
}

// 2. Carregar horários disponíveis
export async function getAvailableSlots(slug, professionalId, date, resourceId = null) {
  const res = await callPublicBooking({
    slug,
    action: 'slots',
    professionalId,
    resourceId,
    date,
  });
  return res.slots;
}

// 3. Confirmar agendamento
export async function createBooking({ slug, professionalId, date, time, patient, specialty, notes, resourceId = null }) {
  return callPublicBooking({
    slug,
    action: 'book',
    professionalId,
    resourceId,
    date,
    time,
    specialty,
    notes,
    patient,
  });
}
```

---

### Opção B: Usando o SDK Oficial do Supabase

Se o projeto já tiver o `@supabase/supabase-js`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function fetchBookingInfo(slug: string) {
  const { data, error } = await supabase.functions.invoke('public-booking', {
    body: { slug, action: 'info' }
  });
  if (error) throw error;
  return data;
}
```

---

## Checklist Rápido e Resolução de Problemas

Se algo não funcionar, siga este roteiro de verificação:

- [ ] **Erro de CORS no console (`Cross-Origin Request Blocked`):**
  - O domínio do site está na lista `allowedOrigins` em `supabase/functions/public-booking/index.ts`?
  - Foi executado o `npx supabase functions deploy public-booking` depois da alteração?
- [ ] **Erro `clinic_not_found` (404):**
  - O `slug` passado no payload é idêntico ao cadastrado na tabela `clinics`?
  - O campo `status` da clínica está marcado como `'active'`?
- [ ] **Erro `professional_has_no_schedule_configuration` (400):**
  - O profissional selecionado possui um registro correspondente na tabela `appointment_types` (definindo duração e intervalo da consulta)?
- [ ] **Lista de horários vazia (`slots: []`):**
  - A data selecionada é hoje ou no futuro?
  - Há horários cadastrados em `working_hours` para o dia da semana correspondente? (Ex: Domingo = 0, Segunda = 1, etc.).
  - Os horários de hoje já passaram ou estão a menos de 2 horas do horário atual?
- [ ] **Erro de variáveis `undefined` no deploy:**
  - Cadastrou `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` na Vercel?
  - Fez o **Redeploy** na Vercel após adicionar as variáveis de ambiente?

