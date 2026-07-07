import { getRequestUser } from "@/lib/auth/user";
import { hasSupabaseConfig, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { userId } = await getRequestUser(request);

  if (!hasSupabaseConfig()) {
    return Response.json({ artifacts: [], storage: "local-only" });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("magi_artifacts")
    .select("id, artifact_type, title, status, summary, files, metadata, created_at")
    .eq("clerk_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ artifacts: data ?? [], storage: "supabase" });
}
