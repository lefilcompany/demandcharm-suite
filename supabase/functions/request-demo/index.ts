import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2.110.7'
import { z } from 'npm:zod@3.23.8'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const RESEND_GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend/emails'
const DEFAULT_FROM = Deno.env.get('DEMO_REQUEST_EMAIL_FROM') ?? 'SoMA+ <soma@lefil.com.br>'

const RECIPIENTS = [
  'socorro@lefil.com.br',
  'lefil@lefil.com.br',
  'samuel.muniz@lefil.com.br',
  'emanuel.rodrigues@lefil.com.br',
  'vinicius.souza.ext@lefil.com.br',
]

const BodySchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(120, 'Nome muito longo'),
  email: z.string().trim().email('Informe um e-mail válido').max(255, 'E-mail muito longo'),
  company: z.string().trim().min(2, 'Informe a empresa').max(160, 'Empresa muito longa'),
  phone: z.string().trim().max(40, 'Telefone muito longo').optional().nullable(),
  role: z.string().trim().max(120, 'Cargo muito longo').optional().nullable(),
  teamSize: z.string().trim().max(80, 'Tamanho do time muito longo').optional().nullable(),
  message: z.string().trim().max(1200, 'Mensagem muito longa').optional().nullable(),
  sourcePath: z.string().trim().max(240, 'Origem muito longa').optional().nullable(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido' }, 405)
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Configuração do banco ausente' }, 500)
    }

    const payload = await req.json().catch(() => null)
    const parsed = BodySchema.safeParse(payload)
    if (!parsed.success) {
      return json({ error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors }, 400)
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body = parsed.data

    const insertPayload = {
      name: body.name,
      email: body.email.toLowerCase(),
      company: body.company,
      phone: normalizeOptional(body.phone),
      role: normalizeOptional(body.role),
      team_size: normalizeOptional(body.teamSize),
      message: normalizeOptional(body.message),
      source_path: normalizeOptional(body.sourcePath),
      user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
      email_status: 'pending',
    }

    const { data: requestRow, error: insertError } = await admin
      .from('demo_requests')
      .insert(insertPayload)
      .select('id, created_at')
      .single()

    if (insertError || !requestRow) {
      console.error('demo request insert failed:', insertError)
      return json({ error: 'Não foi possível registrar a solicitação' }, 500)
    }

    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      await markEmail(admin, requestRow.id, 'failed', 'Configuração de e-mail ausente', null)
      return json({ success: true, requestId: requestRow.id, emailStatus: 'failed' }, 200)
    }

    const emailResult = await sendEmail({ ...body, id: requestRow.id, createdAt: requestRow.created_at })
    await markEmail(
      admin,
      requestRow.id,
      emailResult.ok ? 'sent' : 'failed',
      emailResult.ok ? null : emailResult.error,
      emailResult.messageId,
    )

    return json({ success: true, requestId: requestRow.id, emailStatus: emailResult.ok ? 'sent' : 'failed' }, 200)
  } catch (err) {
    console.error('request-demo error:', err)
    return json({ error: 'Não foi possível enviar a solicitação' }, 500)
  }
})

function normalizeOptional(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

async function sendEmail(body: z.infer<typeof BodySchema> & { id: string; createdAt: string }) {
  const subject = `Nova solicitação de demonstração — ${body.company}`
  const safe = {
    name: escapeHtml(body.name),
    email: escapeHtml(body.email),
    company: escapeHtml(body.company),
    phone: escapeHtml(normalizeOptional(body.phone) ?? 'Não informado'),
    role: escapeHtml(normalizeOptional(body.role) ?? 'Não informado'),
    teamSize: escapeHtml(normalizeOptional(body.teamSize) ?? 'Não informado'),
    message: escapeHtml(normalizeOptional(body.message) ?? 'Sem mensagem adicional'),
    createdAt: escapeHtml(new Date(body.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Recife' })),
  }

  const html = `
    <div style="font-family: Arial, sans-serif; color: #1d1d1d; line-height: 1.5; background: #ffffff; padding: 24px;">
      <div style="max-width: 640px; margin: 0 auto; border: 1px solid #eeeeee; border-radius: 12px; overflow: hidden;">
        <div style="background: #1d1d1d; color: #ffffff; padding: 24px;">
          <p style="margin: 0 0 8px; color: #f28705; font-weight: 700; letter-spacing: .02em;">SoMA+</p>
          <h1 style="margin: 0; font-size: 24px;">Nova solicitação de demonstração</h1>
        </div>
        <div style="padding: 24px;">
          <p><strong>Nome:</strong> ${safe.name}</p>
          <p><strong>E-mail:</strong> ${safe.email}</p>
          <p><strong>Telefone:</strong> ${safe.phone}</p>
          <p><strong>Empresa:</strong> ${safe.company}</p>
          <p><strong>Cargo:</strong> ${safe.role}</p>
          <p><strong>Tamanho do time:</strong> ${safe.teamSize}</p>
          <p><strong>Recebido em:</strong> ${safe.createdAt}</p>
          <div style="margin-top: 20px; padding: 16px; background: #fafafa; border-left: 4px solid #f28705;">
            <strong>Mensagem</strong>
            <p style="margin-bottom: 0; white-space: pre-wrap;">${safe.message}</p>
          </div>
        </div>
      </div>
    </div>
  `

  const response = await fetch(RESEND_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': RESEND_API_KEY,
    },
    body: JSON.stringify({
      from: DEFAULT_FROM,
      to: RECIPIENTS,
      subject,
      html,
    }),
  })

  const rawText = await response.text()
  let raw: Record<string, unknown> = {}
  try {
    raw = rawText ? JSON.parse(rawText) : {}
  } catch {
    raw = { message: rawText }
  }

  if (!response.ok) {
    const error = normalizeProviderError(raw, response.status)
    console.error(`Resend request failed [${response.status}]: ${rawText}`)
    return { ok: false, error, messageId: null }
  }

  return { ok: true, error: null, messageId: typeof raw.id === 'string' ? raw.id : null }
}

async function markEmail(
  admin: ReturnType<typeof createClient>,
  requestId: string,
  status: 'sent' | 'failed',
  error: string | null,
  providerMessageId: string | null,
) {
  const { error: updateError } = await admin
    .from('demo_requests')
    .update({ email_status: status, email_error: error, provider_message_id: providerMessageId })
    .eq('id', requestId)

  if (updateError) console.error('demo request email status update failed:', updateError)
}

function normalizeProviderError(raw: Record<string, unknown>, status: number) {
  const message = raw.message ?? raw.error ?? `HTTP ${status}`
  return typeof message === 'string' ? message : JSON.stringify(message)
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
