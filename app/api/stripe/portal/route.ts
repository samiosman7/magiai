import Stripe from "stripe";
import { getRequestUser } from "@/lib/auth/user";
import { getBillingProfile } from "@/lib/billing/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Stripe customer portal: cancel, switch plan, update card, see invoices.
export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const user = await getRequestUser(request);
  if (!user.authenticated) {
    return Response.json({ error: "Sign in to manage billing.", signInRequired: true }, { status: 401 });
  }

  const profile = await getBillingProfile(user.userId);
  if (!profile?.stripeCustomerId) {
    return Response.json({ error: "No subscription found for this account." }, { status: 404 });
  }

  const origin =
    request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripeCustomerId,
    return_url: `${origin}/console`,
  });

  return Response.json({ url: session.url });
}
