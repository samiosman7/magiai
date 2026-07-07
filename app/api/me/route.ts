import { getRequestUser } from "@/lib/auth/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Who does the server think is calling? The console uses this to show account
// state; it is also the canonical check that cookie sessions resolve server-side.
export async function GET(request: Request) {
  const user = await getRequestUser(request);
  return Response.json({
    userId: user.userId,
    email: user.email,
    authenticated: user.authenticated,
  });
}
