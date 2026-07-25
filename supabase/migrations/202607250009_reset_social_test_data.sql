-- One-time clean slate before external testing.
-- Preserves auth users, profiles, roles, and the complete cheese catalog.
begin;

delete from public.notifications;
delete from public.reports;
delete from public.blocks;
delete from public.comments;
delete from public.likes;
delete from public.follows;
delete from public.tasting_photos;
delete from public.tastings;
delete from storage.objects where bucket_id = 'tasting-photos';

commit;
