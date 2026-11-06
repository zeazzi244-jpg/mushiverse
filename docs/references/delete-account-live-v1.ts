// Read-only snapshot retrieved 2026-11-06 for review/rollback; not an approved deployment.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ deleted:false, error:"method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ deleted:false, error:"unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller = createClient(url, anon, { global:{ headers:{ Authorization:auth } } });
  const admin = createClient(url, service, { auth:{ autoRefreshToken:false, persistSession:false } });

  const token = auth.slice(7);
  const { data: userData, error: userErr } = await caller.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return json({ deleted:false, error:"unauthorized" }, 401);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const confirmation = String(body?.confirmation || "");
  if (!["DELETE", "DELETE_MY_ACCOUNT"].includes(confirmation)) {
    return json({ deleted:false, error:"confirmation_required" }, 400);
  }

  let deletedPhotos = 0;
  const { data: photoList, error: listErr } = await admin.storage.from("insect-photos").list(user.id, { limit:1000 });
  if (!listErr && photoList?.length) {
    const paths = photoList.filter(x => x.name).map(x => `${user.id}/${x.name}`);
    if (paths.length) {
      const { error } = await admin.storage.from("insect-photos").remove(paths);
      if (!error) deletedPhotos = paths.length;
    }
  }

  const { data: ownPosts, error: ownPostsErr } = await admin
    .from("insect_posts")
    .select("id")
    .eq("user_id", user.id);
  if (ownPostsErr) return json({ deleted:false, error:"post_lookup_failed" }, 500);

  const postIds = (ownPosts || []).map((x:any)=>x.id);

  let deletedLikes = 0;
  if (postIds.length) {
    const { data: onPosts } = await admin.from("post_likes").delete().in("post_id", postIds).select("id");
    deletedLikes += onPosts?.length || 0;
    await admin.from("community_reports").update({ post_id: null }).in("post_id", postIds);
  }

  const { data: ownLikes } = await admin.from("post_likes").delete().eq("user_id", user.id).select("id");
  deletedLikes += ownLikes?.length || 0;

  await admin.from("community_reports").delete().eq("reporter_id", user.id);

  const { data: postsDeleted, error: postErr } = await admin
    .from("insect_posts")
    .delete()
    .eq("user_id", user.id)
    .select("id");
  if (postErr) return json({ deleted:false, error:"post_delete_failed" }, 500);

  const authDelete = await admin.auth.admin.deleteUser(user.id);
  if (authDelete.error) {
    console.error("auth delete failed", authDelete.error.message);
    return json({ deleted:false, error:"auth_delete_failed" }, 500);
  }

  await admin.from("account_deletion_audit").insert({
    deleted_posts: postsDeleted?.length || 0,
    deleted_likes: deletedLikes,
    deleted_photos: deletedPhotos,
    function_version: "v41"
  });

  return json({
    deleted:true,
    deleted_posts:postsDeleted?.length||0,
    deleted_likes:deletedLikes,
    deleted_photos:deletedPhotos
  }, 200);
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers:{ ...cors, "Content-Type":"application/json", "Cache-Control":"no-store" }
  });
}
