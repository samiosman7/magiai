import { mcpCatalog } from "@/lib/mcp/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ servers: mcpCatalog });
}
