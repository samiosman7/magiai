import { getRequestUser } from "@/lib/auth/user";
import { getBillingSnapshot } from "@/lib/billing/credits";
import { getTodayUsage } from "@/lib/billing/spend";
import { FREE_TRIAL_RUNS, getAnonymousTrialUsed, getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Who does the server think is calling, and where do they stand on plan,
// credits, usage, and (for anonymous public visitors) the free-trial counter?
// Powers the console's account/billing panel and the "N free runs left" nudge.
export async function GET(request: Request) {
  const user = await getRequestUser(request);
  const publicMode = !process.env.MAGI_BETA_CODE;
  const isAnonymous = !user.authenticated;

  const [billing, usage, trialUsed] = await Promise.all([
    getBillingSnapshot(user.userId).catch(() => null),
    getTodayUsage(user.userId).catch(() => ({ runsToday: 0 })),
    publicMode && isAnonymous ? getAnonymousTrialUsed(getClientIp(request)).catch(() => 0) : Promise.resolve(null),
  ]);

  return Response.json({
    userId: user.userId,
    email: user.email,
    authenticated: user.authenticated,
    billingEnforced: process.env.MAGI_REQUIRE_BILLING === "true",
    billing: billing ? { ...billing, runsToday: usage.runsToday } : null,
    trial:
      trialUsed === null
        ? null
        : { limit: FREE_TRIAL_RUNS, used: trialUsed, remaining: Math.max(0, FREE_TRIAL_RUNS - trialUsed) },
  });
}
