-- Trigger: al confirmar email en Supabase Auth, crear automáticamente la empresa
-- Esto se ejecuta server-side y evita race conditions

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  company_name text;
  alias_base   text;
  final_alias  text;
  counter      int := 0;
begin
  -- Leer nombre de empresa desde metadata (si se pasó en signUp options.data)
  company_name := coalesce(
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  -- Generar alias único: slug del nombre en minúsculas sin caracteres especiales
  alias_base := lower(regexp_replace(company_name, '[^a-z0-9]', '', 'g'));
  if length(alias_base) < 3 then
    alias_base := split_part(new.email, '@', 1);
  end if;
  final_alias := alias_base;

  -- Si el alias ya existe, agregar sufijo numérico
  while exists (select 1 from public.companies where email_alias = final_alias) loop
    counter := counter + 1;
    final_alias := alias_base || counter::text;
  end loop;

  insert into public.companies (user_id, name, email_alias, plan, max_employees, is_active)
  values (
    new.id,
    company_name,
    final_alias,
    'free',
    3,
    true
  )
  on conflict (user_id) do nothing;  -- no duplicar si ya existe

  return new;
end;
$$;

-- Ejecutar el trigger en cada nuevo usuario confirmado
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
