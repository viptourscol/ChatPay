-- Actualizar trigger para guardar el teléfono/celular al registrarse

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  company_name text;
  user_phone   text;
  alias_base   text;
  final_alias  text;
  counter      int := 0;
begin
  company_name := coalesce(
    new.raw_user_meta_data->>'company_name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  user_phone := new.raw_user_meta_data->>'phone';

  alias_base := lower(regexp_replace(company_name, '[^a-z0-9]', '', 'g'));
  if length(alias_base) < 3 then
    alias_base := split_part(new.email, '@', 1);
  end if;
  final_alias := alias_base;

  while exists (select 1 from public.companies where email_alias = final_alias) loop
    counter := counter + 1;
    final_alias := alias_base || counter::text;
  end loop;

  insert into public.companies (user_id, name, email_alias, plan, max_employees, is_active, phone)
  values (
    new.id,
    company_name,
    final_alias,
    'free',
    3,
    true,
    user_phone
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;
