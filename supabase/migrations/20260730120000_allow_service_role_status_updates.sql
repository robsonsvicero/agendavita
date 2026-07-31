create or replace function public.prevent_non_admin_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status
     and not public.is_platform_admin()
     and session_user <> 'service_role' then
    raise exception 'only_platform_admin_can_change_organization_status';
  end if;
  return new;
end;
$$;
