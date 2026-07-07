import { getRequestUser } from "@/lib/auth/user";
import { getBillingSnapshot } from "@/lib/billing/credits";
import { getTodayUsage } from "@/lib/billing/spend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Who does the server think is calling, and where do they stand on plan,
// credits, and today's usage? Powers the console's account + billing panel.
export async function GET(request: Request) {
  const user = await getRequestUser(request);
  const [billing, usage] = await Promise.all([
    getBillingSnapshot(user.userId).catch(() => null),
    getTodayUsage(user.userId).catch(() => ({ runsToday: 0 })),
  ]);

  return Response.json({
    userId: user.userId,
    email: user.email,
    authenticated: user.authenticated,
    billingEnforced: process.env.MAGI_REQUIRE_BILLING === "true",
    billing: billing
      ? {
          ...billing,
          runsToday: usage.runsToday,
        }
      : null,
  });
}
