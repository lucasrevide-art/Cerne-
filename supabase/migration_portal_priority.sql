-- Cerne: o portal passa a informar a prioridade de cada tarefa (aba Prioridades do cliente).
-- Rode DEPOIS de migration_content_review.sql. Seguro para rodar mais de uma vez.
begin;

create or replace function cerne_private.portal(area uuid, task uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare role text;
begin
  if auth.uid() is null then raise exception 'Entre para continuar.'; end if;
  if area is null then
    return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name) order by a.name, a.id)
      from public.areas a join cerne_private.access x on x.area_id = a.id and x.member_id = auth.uid()
      where a.archived_at is null and a.deleted_at is null), '[]'::jsonb);
  end if;
  role := cerne_private.area_permission(area);
  if role is null then raise exception 'Área indisponível.'; end if;
  return (select jsonb_build_object('id', a.id, 'name', a.name, 'description', a.description, 'permission', role,
    'projects', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.sort_order, p.id)
      from public.projects p where p.area_id = a.id and cerne_private.item_visible(p.user_id, a.id, p.id, p.shared)), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'title', t.title, 'notes', t.notes,
      'status', t.status, 'deadline', t.deadline, 'project_id', t.project_id, 'completed_at', t.completed_at,
      'content_version', t.content_version, 'stage', c.name, 'priority', t.priority,
      'latest_activity', (select jsonb_build_object('kind', e.kind, 'created_at', e.created_at)
        from cerne_private.activity e where e.task_id = t.id and not e.internal
        order by e.created_at desc, e.id desc limit 1),
      'review', (select jsonb_build_object('kind', e.kind, 'version', e.version)
        from cerne_private.activity e where e.task_id = t.id and e.kind <> 'comment'
        order by e.created_at desc, e.id desc limit 1)) order by t.deadline nulls last, t.sort_order, t.id)
      from public.tasks t left join public.board_columns c on c.id = t.column_id
      where t.area_id = a.id and (task is null or t.id = task) and t.status <> 'canceled'
        and cerne_private.item_visible(t.user_id, t.area_id, t.project_id, t.shared)), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'title', n.title, 'body', n.body, 'project_id', n.project_id)
      order by n.updated_at desc, n.id)
      from public.notes n where n.area_id = a.id and cerne_private.item_visible(n.user_id, n.area_id, n.project_id, n.shared)), '[]'::jsonb),
    'contents', coalesce((select jsonb_agg(jsonb_build_object('id', ci.id, 'title', ci.title, 'format', ci.format,
      'publish_date', ci.publish_date, 'objective', ci.objective, 'script', ci.script, 'caption', ci.caption,
      'project_id', ci.project_id, 'content_version', ci.content_version,
      'review', (select jsonb_build_object('kind', e.kind, 'version', e.version)
        from cerne_private.content_review e where e.content_id = ci.id and e.kind <> 'comment'
        order by e.created_at desc, e.id desc limit 1)) order by ci.publish_date, ci.created_at, ci.id)
      from public.content_items ci join public.projects cp on cp.id = ci.project_id
      where cp.area_id = a.id and cerne_private.item_visible(ci.user_id, a.id, ci.project_id, ci.shared)), '[]'::jsonb)
  ) from public.areas a where a.id = area);
end $$;

commit;
