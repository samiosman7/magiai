import { getRequestUser } from "@/lib/auth/user";
import { clearMemory, getMemory, saveMemory } from "@/lib/magi/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// What MAGI remembers about the caller — readable and fully editable.
// Memory you can't see or correct is creepy; this is the trust surface.
export async function GET(request: Request) {
  const { userId } = await getRequestUser(request);
  const memory = await getMemory(userId);
  return Response.json(memory);
}

export async function PUT(request: Request) {
  const { userId } = await getRequestUser(request);
  const body = (await request.json().catch(() => null)) as {
    facts?: unknown;
    standingInstructions?: unknown;
  } | null;

  if (!body) return Response.json({ error: "Invalid body." }, { status: 400 });

  const current = await getMemory(userId);
  const facts = Array.isArray(body.facts)
    ? body.facts.filter((f): f is string => typeof f === "string").slice(0, 40)
    : current.facts;
  const standingInstructions =
    typeof body.standingInstructions === "string" ? body.standingInstructions : current.standingInstructions;

  const ok = await saveMemory(userId, { facts, standingInstructions });
  if (!ok) return Response.json({ error: "Memory storage is not available yet." }, { status: 503 });
  return Response.json(await getMemory(userId));
}

export async function DELETE(request: Request) {
  const { userId } = await getRequestUser(request);
  const ok = await clearMemory(userId);
  return Response.json({ ok });
}
