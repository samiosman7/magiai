import Stripe from "stripe";
import { applyPlanCycle, findUserByStripeCustomer } from "@/lib/billing/credits";
import { planFromStripePrice } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Subscription lifecycle → credit cycles:
// - checkout.session.completed  → plan starts, credits = allowance
// - invoice.paid (renewal)      → credits reset to allowance
// - customer.subscription.updated → plan switch (upgrade/downgrade), credits reset
// - customer.subscription.deleted → back to free, credits = free allowance
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
    const userId = session.metadata?.magiUserId || session.client_reference_id;
    const planId = session.metadata?.plan;

    if (userId && planId) {
      await applyPlanCycle({
        userId,
        planId,
        reason: "subscription_start",
        stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
        stripeSubscriptionId:
          typeof session.subscription === "string" ? session.subscription : null,
        metadata: { checkoutSessionId: session.id },
      });
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    // The first invoice is handled by checkout.session.completed; only renewals reset here.
    if (invoice.billing_reason === "subscription_cycle") {
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      const userId = customerId ? await findUserByStripeCustomer(customerId) : null;
      // The line-item price moved between Stripe API versions; accept either shape.
      const line = invoice.lines?.data?.[0] as
        | {
            price?: { id?: string | null } | null;
            pricing?: { price_details?: { price?: string | null } | null } | null;
          }
        | undefined;
      const priceId = line?.price?.id ?? line?.pricing?.price_details?.price ?? null;
      const planId = planFromStripePrice(priceId);

      if (userId && planId) {
        await applyPlanCycle({
          userId,
          planId,
          reason: "subscription_renewal",
          metadata: { invoiceId: invoice.id },
        });
      }
    }
  }

  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
    const planId = planFromStripePrice(priceId);
    const userId =
      subscription.metadata?.magiUserId ||
      (typeof subscription.customer === "string"
        ? await findUserByStripeCustomer(subscription.customer)
        : null);
    const previous = event.data.previous_attributes as Partial<Stripe.Subscription> | undefined;
    // Only react to actual plan switches — renewals and status flaps also fire this event.
    const planChanged = Boolean(previous?.items);

    if (userId && planId && planChanged && subscription.status === "active") {
      await applyPlanCycle({
        userId,
        planId,
        reason: "plan_change",
        stripeSubscriptionId: subscription.id,
        metadata: { subscriptionId: subscription.id },
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const userId =
      subscription.metadata?.magiUserId ||
      (typeof subscription.customer === "string"
        ? await findUserByStripeCustomer(subscription.customer)
        : null);

    if (userId) {
      await applyPlanCycle({
        userId,
        planId: "free",
        reason: "subscription_end",
        stripeSubscriptionId: null,
        metadata: { subscriptionId: subscription.id },
      });
    }
  }

  return Response.json({ received: true });
}
