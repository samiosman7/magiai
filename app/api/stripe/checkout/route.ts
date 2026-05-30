import Stripe from "stripe";
import { getRequestUserId } from "@/lib/auth/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const creditPacks = {
  starter: {
    credits: 25,
    env: "STRIPE_PRICE_STARTER",
  },
  pro: {
    credits: 120,
    env: "STRIPE_PRICE_PRO",
  },
  studio: {
    credits: 400,
    env: "STRIPE_PRICE_STUDIO",
  },
} as const;

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "Stripe is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as { pack?: unknown } | null;
  const packKey = String(body?.pack || "starter") as keyof typeof creditPacks;
  const pack = creditPacks[packKey] ?? creditPacks.starter;
  const price = process.env[pack.env];

  if (!price) {
    return Response.json({ error: `${pack.env} is not configured.` }, { status: 503 });
  }

  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const userId = getRequestUserId(request);
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price, quantity: 1 }],
    success_url: `${origin}?checkout=success`,
    cancel_url: `${origin}?checkout=cancelled`,
    metadata: {
      magiUserId: userId,
      credits: String(pack.credits),
      pack: packKey,
    },
  });

  return Response.json({ url: session.url });
}
