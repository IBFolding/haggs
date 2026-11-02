#!/usr/bin/env bash
set -euo pipefail
# Entirely disposable local cluster. Never uses a Supabase URL, service, password or existing database.
unset PGHOST PGPORT PGUSER PGPASSWORD PGSERVICE PGSERVICEFILE PGDATABASE DATABASE_URL
fixture_root=$(mktemp -d /tmp/haggs-hosted-sql.XXXXXX)
fixture_owner=$(id -un)
fixture_port=54491
fixture_pid=''
fixture_cleanup_pid=''
cleanup(){ if [[ -n "$fixture_cleanup_pid" ]]; then wait "$fixture_cleanup_pid" 2>/dev/null || true; fi; if [[ -n "$fixture_pid" ]]; then wait "$fixture_pid" 2>/dev/null || true; fi; pg_ctl -D "$fixture_root/db" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$fixture_root"; }
trap cleanup EXIT
chmod 700 "$fixture_root"
mkdir "$fixture_root/socket"
initdb -D "$fixture_root/db" -A trust --no-locale --encoding=UTF8 >"$fixture_root/init.log"
pg_ctl -D "$fixture_root/db" -l "$fixture_root/server.log" -o "-h '' -k $fixture_root/socket -p $fixture_port" -w start >/dev/null
sql(){ psql -X -h "$fixture_root/socket" -p "$fixture_port" -U "$fixture_owner" -d postgres -v ON_ERROR_STOP=1 "$@"; }
sql -q <<'SQL'
create role anon; create role authenticated;
create schema auth;create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
create table public.app_secrets(key text primary key,value text not null);
insert into app_secrets values('webhook','local-fixture-only');
insert into auth.users values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
SQL
sql -q -f supabase/migrations/20261027000000_storage_reservations.sql
sql -q -f docs/hosted-output-recovery-migration.sql
sql -q <<'SQL'
select storage_reserve('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',100,1000,'[]','local-fixture-only');
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select hosted_output_act('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','begin',jsonb_build_object('scope','platform','credential_hash',repeat('a',64),'output_node','20'),'local-fixture-only');
select hosted_output_act('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accepted','{"job":"job-fixture"}','local-fixture-only');
select hosted_output_act('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','ready','{"filename":"fixture.mp4","subfolder":"haggs","extension":"mp4"}','local-fixture-only');
do $$ begin
 begin perform hosted_output_act('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','probe','{}','wrong');raise exception 'wrong secret accepted';exception when raise_exception then if sqlerrm<>'not allowed' then raise;end if;end;
 begin update hosted_output_recovery set provider_job='forged';raise exception 'client metadata mutation accepted';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
do $$ begin
 if exists(select 1 from hosted_output_recovery) then raise exception 'cross-owner read';end if;
 begin perform hosted_output_act('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','accepted','{"job":"foreign"}','local-fixture-only');raise exception 'cross-owner write';exception when raise_exception then if sqlerrm<>'not found' then raise;end if;end;
end $$;
SQL
# Independent sessions contend for the same owner/record claim.
sql -q >"$fixture_root/claim.log" 2>&1 <<'SQL' &
begin;set local role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
select hosted_output_act('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','claim',jsonb_build_object('bytes',9,'digest',repeat('a',64),'reservation','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'local-fixture-only');
\echo CLAIM_HELD
select pg_sleep(1.5);commit;
SQL
fixture_pid=$!
for _ in {1..100}; do if rg -q CLAIM_HELD "$fixture_root/claim.log"; then break;fi;sleep .1;done
rg -q CLAIM_HELD "$fixture_root/claim.log"
sql -q -c "select storage_finish('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null,'local-fixture-only')" >"$fixture_root/concurrent-cleanup.log" 2>&1 &
fixture_cleanup_pid=$!
sql -q <<'SQL' 
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
do $$ declare got jsonb; begin
 got:=hosted_output_act('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','claim',jsonb_build_object('bytes',9,'digest',repeat('a',64),'reservation','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'local-fixture-only');
 if got<>'false'::jsonb then raise exception 'duplicate claim accepted';end if;
end $$;
reset role;
select storage_finish('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',null,'local-fixture-only');
do $$ begin if (select state from storage_reservations where id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>'pending' then raise exception 'cleanup released uncertain hold';end if;end $$;
select storage_finish('11111111-1111-4111-8111-111111111111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','/api/media/haggs/u-11111111-1111-4111-8111-111111111111/recovered/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.mp4','local-fixture-only',9);
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select hosted_output_act('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','saved','{}','local-fixture-only');
select hosted_output_act('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','saved','{}','local-fixture-only');
reset role;
do $$ begin if (select used_bytes from storage_accounts where user_id='11111111-1111-4111-8111-111111111111')<>9 then raise exception 'duplicate quota charge';end if;end $$;
set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select hosted_output_act('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cancel','{}','local-fixture-only');reset role;
select storage_removed('11111111-1111-4111-8111-111111111111','/api/media/haggs/u-11111111-1111-4111-8111-111111111111/recovered/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.mp4','local-fixture-only');
select storage_removed('11111111-1111-4111-8111-111111111111','/api/media/haggs/u-11111111-1111-4111-8111-111111111111/recovered/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.mp4','local-fixture-only');
do $$ begin if (select used_bytes from storage_accounts where user_id='11111111-1111-4111-8111-111111111111')<>0 then raise exception 'deletion quota not settled';end if;end $$;
SQL
wait "$fixture_pid";fixture_pid=''
wait "$fixture_cleanup_pid";fixture_cleanup_pid=''
if sql -q -f docs/hosted-output-recovery-migration.sql >"$fixture_root/reapply.log" 2>&1; then printf 'Unsafe migration reapplication succeeded.\n' >&2;exit 1;fi
rg -q 'storage_finish differs from the reviewed baseline' "$fixture_root/reapply.log"
printf 'Disposable PostgreSQL: owner isolation, forbidden client writes, secret checks, concurrent claim, protected hold, idempotent save and deletion accounting passed.\n'
