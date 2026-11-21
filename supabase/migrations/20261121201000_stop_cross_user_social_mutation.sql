-- Remove one broad FOR ALL account policy which OR-combines with narrower
-- owner-only policies and can let any active account edit/delete others'
-- posts, comments, follows, username and ranking rows.
-- These tables already have separate owner-scoped policies for every
-- legitimate CRUD operation; those are retained unchanged.
DROP POLICY IF EXISTS account_active_v21 ON public.profile_usernames;
DROP POLICY IF EXISTS account_active_v21 ON public.user_follows;
DROP POLICY IF EXISTS account_active_v21 ON public.insect_posts;
DROP POLICY IF EXISTS account_active_v21 ON public.post_comments;
DROP POLICY IF EXISTS account_active_v21 ON public.post_likes;
DROP POLICY IF EXISTS account_active_v21 ON public.gacha_collection_leaderboard;
