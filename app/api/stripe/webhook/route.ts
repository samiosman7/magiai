import Stripe from "stripe";
import { hasSupabaseConfig, getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!signature) {
    return Response.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid Stripe signature.";
    return Response.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.magiUserId;
    const credits = Number(session.metadata?.credits || 0);

    if (userId && credits > 0 && hasSupabaseConfig()) {
      const supabase = getSupabaseAdmin();
      const { data: profile } = await supabase
        .from("magi_profiles")
        .select("credits")
        .eq("clerk_user_id", userId)
        .maybeSingle();

      if (profile) {
        await supabase
          .from("magi_profiles")
          .update({ credits: Number(profile.credits) + credits, updated_at: new Date().toISOString() })
          .eq("clerk_user_id", userId);
      } else {
        await supabase.from("magi_profiles").insert({
          clerk_user_id: userId,
          plan: "paid",
          credits,
        });
      }

      await supabase.from("magi_credit_events").insert({
        clerk_user_id: userId,
        delta: credits,
        reason: "stripe_checkout",
        metadata: {
          checkoutSessionId: session.id,
          pack: session.metadata?.pack,
        },
      });
    }
  }

  return Response.json({ received: true });
}
