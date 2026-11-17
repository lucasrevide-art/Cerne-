-- Cerne: convite só pelo e-mail. Quem entra no Cerne com um e-mail convidado recebe o acesso
-- automaticamente, sem precisar abrir o link do convite. O link continua funcionando.
-- Rode DEPOIS de migration_client_portal.sql. Seguro para rodar mais de uma vez.
begin;

create or replace function cerne_private.access_action(area uuid, action text, value text, level text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare entry cerne_private.access%rowtype;
begin
  if auth.uid() is null then raise exception 'Entre para continuar.'; end if;
  if action = 'accept' then
    select x.* into entry from cerne_private.access x join public.areas a on a.id = x.area_id
    join auth.users u on u.id = auth.uid()
    where x.token::text = value and lower(u.email) = x.email and u.email_confirmed_at is not null
      and a.deleted_at is null and a.archived_at is null and a.user_id <> u.id for update of x;
    if not found or (entry.member_id is not null and entry.member_id <> auth.uid()) then
      raise exception 'Convite indisponível para esta conta. Confirme o e-mail usado no convite.';
    end if;
    update cerne_private.access set member_id = auth.uid() where id = entry.id;
    return to_jsonb(entry.area_id);
  end if;
  if action = 'claim' then
    -- Convite por e-mail: quem entra com um e-mail convidado recebe o acesso, sem precisar do link.
    update cerne_private.access x set member_id = auth.uid()
    from auth.users u
    where u.id = auth.uid() and lower(u.email) = x.email and u.email_confirmed_at is not null
      and x.member_id is null
      and exists (select 1 from public.areas a where a.id = x.area_id and a.user_id <> u.id
        and a.deleted_at is null and a.archived_at is null);
    return '[]'::jsonb;
  end if;
  if cerne_private.area_permission(area) is distinct from 'owner' then raise exception 'Área indisponível.'; end if;
  if action = 'invite' then
    if value is null or length(value) > 254 or value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      or level is null or level not in ('view','review','edit') then raise exception 'Informe um e-mail e uma permissão válidos.'; end if;
    insert into cerne_private.access(area_id, email, permission) values (area, lower(value), level)
      on conflict (area_id, email) do update set permission = excluded.permission returning * into entry;
    return to_jsonb(entry);
  elsif action = 'revoke' then
    delete from cerne_private.access where area_id = area and id::text = value;
  elsif action <> 'list' then raise exception 'Ação inválida.';
  end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.email) from cerne_private.access x where x.area_id = area), '[]'::jsonb);
end $$;

commit;
