import Stripe from "stripe";
import { accountRequired, getRequestUser } from "@/lib/auth/user";
import { getBillingProfile } from "@/lib/billing/credits";
import { plans, type PlanId } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Starts a monthly subscription checkout for Pro or Studio.
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { plan?: unknown } | null;
  const planId = body?.plan as PlanId;
  const plan = planId === "pro" || planId === "studio" ? plans[planId] : null;

  if (!plan || !plan.priceEnv) {
    return Response.json({ error: "Pick a paid plan: pro or studio." }, { status: 400 });
  }

  const price = process.env[plan.priceEnv];
  if (!price) {
    return Response.json({ error: `${plan.priceEnv} is not configured.` }, { status: 503 });
  }

  const user = await getRequestUser(request);
  // Subscriptions must attach to a real account — an operator id can't renew or cancel.
  if (!user.authenticated || accountRequired(user)) {
    return Response.json({ error: "Sign in to subscribe.", signInRequired: true }, { status: 401 });
  }

  const origin =
    request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  // Reuse the Stripe customer across plan changes so history stays in one place.
  const profile = await getBillingProfile(user.userId);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${origin}/console?checkout=success`,
    cancel_url: `${origin}/console?checkout=cancelled`,
    client_reference_id: user.userId,
    ...(profile?.stripeCustomerId
      ? { customer: profile.stripeCustomerId }
      : { customer_email: user.email ?? undefined }),
    metadata: {
      magiUserId: user.userId,
      plan: plan.id,
    },
    subscription_data: {
      metadata: {
        magiUserId: user.userId,
        plan: plan.id,
      },
    },
  });

  return Response.json({ url: session.url });
}
