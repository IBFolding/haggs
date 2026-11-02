-- REVIEW / TEST ONLY. Do not apply to production before the coordinated release.
-- Existing public links stay valid. Private media becomes public only through an owner's post.
begin;
alter table public.posts drop constraint if exists posts_url_check;
alter table public.posts add constraint posts_url_check check (
  url ~ '^https://[a-z0-9-]+\.public\.blob\.vercel-storage\.com/'
  or (url ~ '^/api/media/haggs/u-[0-9a-f-]{36}/[a-zA-Z0-9_./-]+$'
      and split_part(url,'/',5) = 'u-' || user_id::text)
);
alter table public.profiles drop constraint if exists profiles_picture_check;
alter table public.profiles add constraint profiles_picture_check check (
 picture is null or picture ~ '^https://[a-z0-9-]+\.public\.blob\.vercel-storage\.com/'
 or (picture ~ '^/api/media/haggs/u-[0-9a-f-]{36}/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$'
 and split_part(picture,'/',5) = 'u-' || user_id::text)
);
commit;
