import { getModelPlan } from "@/lib/magi/model-plan";
import { generateText } from "@/lib/magi/providers";
import { buildMcpContext, projectSkillPaths } from "@/lib/magi/runtime-context";
import { loadSkillPacks } from "@/lib/magi/skill-loader";
import { queryMagicUiInspiration } from "@/lib/mcp/client";
import { generateWebsiteProject, type GeneratedFile, type GeneratedProject } from "./website-generator";

type ProjectManifest = {
  title?: string;
  slug?: string;
  files?: GeneratedFile[];
};

export async function generateAgenticWebsiteProject(prompt: string): Promise<GeneratedProject> {
  try {
    const [skillContext, mcp, magicUiContext] = await Promise.all([
      loadSkillPacks(projectSkillPaths),
      buildMcpContext(),
      queryMagicUiInspiration(prompt).catch(() => null),
    ]);
    const plan = getModelPlan("standard", "balthasar");
    const response = await generateText({
      ...plan,
      system: [
        "You are MAGI's agentic project builder.",
        "Generate a polished, premium, downloadable static website project from the user's request.",
        "Use the loaded MAGI skill packs as operating instructions.",
        "Use MCP context to understand available external tools, but do not claim you used a tool unless it is listed as connected.",
        "Return only valid JSON. No markdown fences.",
        "The JSON must match: {\"title\":\"string\",\"slug\":\"kebab-case\",\"files\":[{\"path\":\"index.html\",\"content\":\"...\"},{\"path\":\"styles.css\",\"content\":\"...\"},{\"path\":\"script.js\",\"content\":\"...\"},{\"path\":\"README.md\",\"content\":\"...\"}]}",
        "All files must be complete. The site must work by opening index.html directly in a browser.",
        "Do not include remote build steps, package managers, or framework-only files in this first downloadable version.",
        "Avoid placeholder copy like lorem ipsum. Make the result specific to the prompt.",
        "Quality bar: the site must feel like a real agency-grade first draft, not a boilerplate starter.",
        "Design requirements: strong first viewport, clear navigation, real offer sections, proof/testimonial section, pricing or packages when relevant, FAQ, contact/CTA, responsive mobile layout, polished spacing, and deliberate typography.",
        "Do not use generic copy such as 'turns attention into action', 'ready for real content', or 'replace this copy'.",
        "Do not use single-color bland palettes. Use a coherent palette with background, surface, text, accent, and muted colors.",
        "Use CSS variables, responsive grids, hover states, and professional button/card treatments.",
        "If the prompt asks for a service business, include service packages, trust proof, process, and booking CTA.",
        "If the prompt asks for SaaS/software, include product workflow, feature comparison, metrics, and demo CTA.",
        "",
        skillContext,
        "",
        mcp.context,
        "",
        "Website/UI MCP tool execution context:",
        magicUiContext || "No 21st.dev Magic bridge tool output was available for this generation.",
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
