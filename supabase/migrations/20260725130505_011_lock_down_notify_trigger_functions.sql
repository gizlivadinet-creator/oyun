/*
# Lock down notification trigger functions

The 010 migration's `REVOKE EXECUTE ... FROM PUBLIC` doesn't fully lock
these down on Supabase: new functions in the public schema get EXECUTE
granted explicitly to anon/authenticated/service_role via default
privileges, not just via the implicit PUBLIC grant — so revoking from
PUBLIC alone leaves them callable by anon/authenticated through
/rest/v1/rpc/<function_name>.

These 8 functions only ever run as trigger bodies (fired internally on
INSERT/DELETE against likes/comments/follows/reposts/posts) and are never
meant to be called directly by a client, so anon/authenticated EXECUTE is
revoked here — matching the project's existing pattern for
sync_post_like_count, bump_xp, award_post_xp, etc. This has no effect on
the triggers themselves: trigger firing does not require the DML-issuing
role to hold EXECUTE on the trigger function.
*/

REVOKE EXECUTE ON FUNCTION notify_on_like() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION unnotify_on_unlike() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_comment() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_follow() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION unnotify_on_unfollow() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_repost() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION unnotify_on_unrepost() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_new_post() FROM anon, authenticated;
