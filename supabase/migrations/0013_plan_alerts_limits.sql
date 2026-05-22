-- Nuevas columnas para límites de alertas y planes actualizados
alter table public.companies
  add column if not exists alerts_sent_month   integer not null default 0,
  add column if not exists alerts_reset_at     timestamptz,
  add column if not exists max_admin_alerts    integer not null default 0,
  add column if not exists max_admin_numbers   integer not null default 0;

-- Actualizar límites según el plan actual de cada empresa
update public.companies set
  max_admin_alerts  = case plan
    when 'free'        then 10
    when 'basico'      then 0
    when 'starter'     then 0
    when 'estandar'    then 20
    when 'business'    then 20
    when 'pro'         then 50
    when 'empresarial' then 999999
    when 'enterprise'  then 999999
    else 0
  end,
  max_admin_numbers = case plan
    when 'free'        then 1
    when 'basico'      then 0
    when 'starter'     then 0
    when 'estandar'    then 1
    when 'business'    then 1
    when 'pro'         then 2
    when 'empresarial' then 2
    when 'enterprise'  then 2
    else 0
  end;
