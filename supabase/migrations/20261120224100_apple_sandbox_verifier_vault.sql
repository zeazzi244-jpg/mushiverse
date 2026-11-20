create function public.get_apple_sandbox_verifier_secret()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when count(*) = 1 then max(decrypted_secret) end
  from vault.decrypted_secrets
  where name = 'mushiverse_apple_sandbox_verifier';
$$;

revoke all on function public.get_apple_sandbox_verifier_secret() from public, anon, authenticated;
grant execute on function public.get_apple_sandbox_verifier_secret() to service_role;
