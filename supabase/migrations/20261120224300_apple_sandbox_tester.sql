create function public.is_apple_sandbox_tester(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null and count(*) = 1
    and max(decrypted_secret) = p_user_id::text
  from vault.decrypted_secrets
  where name = 'mushiverse_apple_sandbox_tester';
$$;
revoke all on function public.is_apple_sandbox_tester(uuid) from public, anon, authenticated;
grant execute on function public.is_apple_sandbox_tester(uuid) to service_role;
