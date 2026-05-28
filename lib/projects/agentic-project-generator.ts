import { getModelPlan } from "@/lib/magi/model-plan";
import { generateText } from "@/lib/magi/providers";
import { skillPackPaths } from "@/lib/magi/skills";
import { loadSkillPacks } from "@/lib/magi/skill-loader";
import { getMcpServerStatuses } from "@/lib/mcp/client";
import { mcpCatalog } from "@/lib/mcp/catalog";
import { generateWebsiteProject, type GeneratedFile, type GeneratedProject } from "./website-generator";

type ProjectManifest = {
  title?: string;
  slug?: string;
  files?: GeneratedFile[];
};

const projectSkillPaths = [
  skillPackPaths.melchior,
  skillPackPaths.balthasar,
  skillPackPaths.casper,
  skillPackPaths.judge,
  "magi-skills/ui-ux-product-design/SKILL.md",
  "magi-skills/agentic-project-builder/SKILL.md",
  "magi-skills/mcp-tool-orchestration/SKILL.md",
  "magi-skills/product-strategy-growth/SKILL.md",
];

export async function generateAgenticWebsiteProject(prompt: string): Promise<GeneratedProject> {
  try {
    const [skillContext, mcpContext] = await Promise.all([
      loadSkillPacks(projectSkillPaths),
      buildMcpContext(),
    ]);
    const plan = getModelPlan("standard", "balthasar");
    const response = await generateText({
      ...plan,
      system: [
        "You are MAGI's agentic project builder.",
        "Generate a complete, downloadable static website project from the user's request.",
        "Use the loaded MAGI skill packs as operating instructions.",
        "Use MCP context to understand available external tools, but do not claim you used a tool unless it is listed as connected.",
        "Return only valid JSON. No markdown fences.",
        "The JSON must match: {\"title\":\"string\",\"slug\":\"kebab-case\",\"files\":[{\"path\":\"index.html\",\"content\":\"...\"},{\"path\":\"styles.css\",\"content\":\"...\"},{\"path\":\"script.js\",\"content\":\"...\"},{\"path\":\"README.md\",\"content\":\"...\"}]}",
        "All files must be complete. The site must work by opening index.html directly in a browser.",
        "Do not include remote build steps, package managers, or framework-only files in this first downloadable version.",
        "Avoid placeholder copy like lorem ipsum. Make the result specific to the prompt.",
        "",
        skillContext,
        "",
        mcpContext,
      ].join("\n"),
      prompt: `Build a downloadable website project for this request:\n${prompt}`,
      maxTokens: 5000,
      temperature: 0.45,
    });

    const parsed = parseProjectManifest(response.text);
    return sanitizeProject(parsed, prompt);
  } catch {
    return generateWebsiteProject(prompt);
  }
}

async function buildMcpContext() {
  const statuses = await getMcpServerStatuses().catch(() => []);
  const configured = statuses
    .map((server) => ({
      name: server.name,
      connected: server.connected,
      tools: server.tools.map((tool) => tool.name),
    }))
    .slice(0, 12);

  return JSON.stringify(
    {
      configuredMcpServers: configured,
      recommendedMcpCatalog: mcpCatalog.map((entry) => ({
        id: entry.id,
        name: entry.name,
        category: entry.category,
        transport: entry.transport,
        productionReadyOnVercel: entry.productionReadyOnVercel,
      })),
    },
    null,
    2
  );
}

function parseProjectManifest(text: string): ProjectManifest {
  const trimmed = text.trim();
  const direct = tryParseJson(trimmed);
  if (direct) return direct;

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    const extracted = tryParseJson(match[0]);
    if (extracted) return extracted;
  }

  throw new Error("Model did not return a project manifest.");
}

function tryParseJson(value: string): ProjectManifest | null {
  try {
    return JSON.parse(value) as ProjectManifest;
  } catch {
    return null;
  }
}

function sanitizeProject(project: ProjectManifest, prompt: string): GeneratedProject {
  const fallback = generateWebsiteProject(prompt);
  const title = cleanTitle(project.title) || fallback.title;
  const slug = cleanSlug(project.slug || title) || fallback.slug;
  const files = sanitizeFiles(project.files);

  if (!files.some((file) => file.path === "index.html")) files.push(fallback.files[0]);
  if (!files.some((file) => file.path === "styles.css")) files.push(fallback.files[1]);
  if (!files.some((file) => file.path === "README.md")) files.push(fallback.files[3]);

  return { title, slug, files };
}

function sanitizeFiles(files: ProjectManifest["files"]) {
  if (!Array.isArray(files)) return [];

  return files
    .map((file) => ({
      path: sanitizeFilePath(file.path),
      content: typeof file.content === "string" ? file.content : "",
    }))
    .filter((file) => file.path && file.content)
    .slice(0, 20);
}

function sanitizeFilePath(filePath: string) {
  if (typeof filePath !== "string") return "";
  const cleaned = filePath.replaceAll("\\", "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.includes("..")) return "";
  if (cleaned.length > 120) return "";
  return cleaned;
}

function cleanTitle(value?: string) {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function cleanSlug(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "magi-site"
  );
}
