#!/bin/sh
set -eu
# Creates and removes only its own disposable local database.
db="haggs_vfx_test_$$"
createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT
psql -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create table app_secrets(key text,value text);
insert into app_secrets values('webhook','test-secret');
create table managed_job_journal(submission_id uuid primary key,user_id uuid,state text);
create table managed_output_journal(reservation_id uuid);
create table storage_reservations(id uuid,user_id uuid,state text,bytes bigint,url text);
create table storage_accounts(user_id uuid,used_bytes bigint);
create function storage_reserve(uuid,uuid,bigint,bigint,jsonb,text) returns boolean language sql as $$ select true $$;
SQL
psql -v ON_ERROR_STOP=1 -d "$db" -f supabase/migrations/20261030000004_managed_artifacts.sql >/dev/null
psql -v ON_ERROR_STOP=1 -d "$db" <<'SQL'
insert into auth.users values('11111111-1111-4111-8111-111111111111');
insert into managed_job_journal values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','accepted');
do $$ declare result text; begin
 result:=managed_artifact_claim('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vfx-mask','22222222-2222-4222-8222-222222222222','mp4',100,repeat('a',64),1000,'[]','test-secret');if result<>'created' then raise exception 'mask failed';end if;
 result:=managed_artifact_claim('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vfx-source','33333333-3333-4333-8333-333333333333','mp4',100,repeat('b',64),1000,'[]','test-secret');if result<>'created' then raise exception 'source failed';end if;
 begin perform managed_artifact_claim('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vfx-mask','44444444-4444-4444-8444-444444444444','png',100,repeat('a',64),1000,'[]','test-secret');raise exception 'invalid extension accepted';exception when raise_exception then if sqlerrm='invalid extension accepted' then raise;end if;end;
 begin perform managed_artifact_claim('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vfx-other','44444444-4444-4444-8444-444444444444','mp4',100,repeat('a',64),1000,'[]','test-secret');raise exception 'invalid role accepted';exception when raise_exception then if sqlerrm='invalid role accepted' then raise;end if;end;
end $$;
SQL
