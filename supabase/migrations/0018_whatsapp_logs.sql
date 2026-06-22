-- ───────────────────────────────────────────────────────────────────────────
-- 0018_whatsapp_logs
-- Tabla de auditoría de todos los mensajes WhatsApp salientes de ChatPay.
-- ───────────────────────────────────────────────────────────────────────────

create table if not exists public.whatsapp_logs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid references public.companies(id) on delete set null,
  verification_id  uuid references public.verifications(id) on delete set null,
  recipient        text not null,
  message_type     text not null, -- 'payment_notification' | 'admin_alert' | 'auth_rejected' | 'verification_response' | 'disambiguation' | 'greeting' | 'fallback_text' | 'other'
  message_text     text,
  status           text not null default 'sent' check (status in ('sent', 'failed')),
  meta_message_id  text,          -- ID devuelto por Meta cuando el envío es exitoso
  error_message    text,          -- Mensaje de error de Meta cuando falla
  sent_at          timestamptz not null default now()
);

-- Índices para el panel de monitor
create index if not exists idx_whatsapp_logs_sent_at    on public.whatsapp_logs(sent_at desc);
create index if not exists idx_whatsapp_logs_company_id on public.whatsapp_logs(company_id);
create index if not exists idx_whatsapp_logs_status     on public.whatsapp_logs(status);

-- RLS: solo service_role (backend) puede insertar; el frontend no accede directamente
alter table public.whatsapp_logs enable row level security;
-- No política de SELECT para usuarios normales → solo el super admin la consulta via service_role desde el backend
