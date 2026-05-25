import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("magi_profiles").select("clerk_user_id").limit(1);

    if (error) {
      return Response.json(
        {
          ok: false,
          message: error.message,
          hint: "Run supabase/schema.sql in the Supabase SQL editor if the table is missing.",
        },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Supabase health check failed.",
      },
      { status: 500 }
    );
  }
}
