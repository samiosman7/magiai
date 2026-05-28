import { getMcpServerStatuses } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const servers = await getMcpServerStatuses();
    return Response.json({ servers });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "MCP server discovery failed.",
      },
      { status: 500 }
    );
  }
}
