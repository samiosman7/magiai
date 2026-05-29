import { getModelPlan } from "@/lib/magi/model-plan";
import { generateText } from "@/lib/magi/providers";
import type { GeminiModel } from "@/lib/magi/types";
import { buildMcpContext, projectSkillPaths } from "@/lib/magi/runtime-context";
import { loadSkillPacks } from "@/lib/magi/skill-loader";
import { queryMagicUiInspiration } from "@/lib/mcp/client";
import { generateWebsiteProject, type GeneratedFile, type GeneratedProject } from "./website-generator";

type ProjectManifest = {
  title?: string;
  slug?: string;
  files?: GeneratedFile[];
};

export async function generateAgenticWebsiteProject(
  prompt: string,
  geminiModel?: GeminiModel
): Promise<GeneratedProject> {
  try {
    const [skillContext, mcp, magicUiContext] = await Promise.all([
      loadSkillPacks(projectSkillPaths),
      buildMcpContext(),
      queryMagicUiInspiration(prompt).catch(() => null),
    ]);
    const plan = getModelPlan("standard", "balthasar", geminiModel);
    const system = [
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
      "Absolutely do not use this generic headline: 'Make the first impression feel already decided.'",
      "Absolutely do not use generic labels like 'high-conversion service' unless the user specifically asks for a conversion agency.",
      "Design the site for the actual business category. A bakery should feel bakery-specific: menu/products, preorder/catering, pickup hours, photography-ready product blocks, warm food palette, seasonal goods, and local trust.",
      "Design requirements: strong first viewport, clear navigation, real offer sections, proof/testimonial section, pricing/menu or packages when relevant, FAQ, contact/CTA, responsive mobile layout, polished spacing, and deliberate typography.",
      "Do not use generic copy such as 'turns attention into action', 'ready for real content', or 'replace this copy'.",
      "Do not use single-color bland palettes. Use a coherent palette with background, surface, text, accent, and muted colors.",
      "Use CSS variables, responsive grids, hover states, and professional button/card treatments.",
      "If 21st.dev Magic context is available, adapt it as design inspiration instead of copying unrelated component imports that will not run in a static HTML site.",
      "If the prompt asks for a service business, include service packages, trust proof, process, and booking CTA.",
      "If the prompt asks for SaaS/software, include product workflow, feature comparison, metrics, and demo CTA.",
      "",
      skillContext,
      "",
      mcp.context,
      "",
      "Website/UI MCP tool execution context:",
      magicUiContext || "No 21st.dev Magic bridge tool output was available for this generation.",
    ].join("\n");

    const response = await generateText({
      ...plan,
      system,
      prompt: `Build a downloadable website project for this request:\n${prompt}`,
      maxTokens: 5000,
      temperature: 0.45,
    });

    const parsed = await parseOrRepairProjectManifest(response.text, prompt, system, plan);
    const project = sanitizeProject(parsed, prompt);
    assertNotGenericTemplate(project);
    assertMatchesPrompt(project, prompt);
    return project;
  } catch {
    return generateWebsiteProject(prompt);
  }
}

async function parseOrRepairProjectManifest(
  text: string,
  prompt: string,
  system: string,
  plan: ReturnType<typeof getModelPlan>
) {
  try {
    return parseProjectManifest(text);
  } catch {
    const repair = await generateText({
      ...plan,
      system: [
        system,
        "",
        "Your previous response was not valid project JSON. Repair it now.",
        "Return only valid JSON matching the required manifest shape. No commentary.",
      ].join("\n"),
      prompt: `Original website request:\n${prompt}\n\nInvalid response to repair:\n${text.slice(0, 12000)}`,
      maxTokens: 5000,
      temperature: 0.15,
    });

    return parseProjectManifest(repair.text);
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

function assertNotGenericTemplate(project: GeneratedProject) {
  const combined = project.files.map((file) => file.content).join("\n").toLowerCase();
  const blocked = [
    "make the first impression feel already decided",
    "high-conversion service",
    "3x faster path to launch",
    "a polished service offer with proof, packages",
  ];

  if (blocked.some((phrase) => combined.includes(phrase))) {
    throw new Error("Generic website template leaked into generated output.");
  }
}

function assertMatchesPrompt(project: GeneratedProject, prompt: string) {
  const lowerPrompt = prompt.toLowerCase();
  const combined = project.files.map((file) => file.content).join("\n").toLowerCase();

  const rules = [
    {
      promptPattern: /\b(bakery|baker|pastry|pastries|cake|cakes|bread|sourdough)\b/,
      label: "bakery",
      terms: ["bakery", "bread", "sourdough", "pastry", "pastries", "croissant", "cake", "menu", "pickup", "catering", "oven"],
      minimum: 5,
    },
    {
      promptPattern: /\b(detailing|detailer|car wash|auto detail|vehicle|ceramic|paint correction)\b/,
      label: "detailing",
      terms: ["detailing", "vehicle", "wash", "interior", "exterior", "paint", "ceramic", "wheels", "appointment", "mobile"],
      minimum: 5,
    },
    {
      promptPattern: /\b(restaurant|dining|bistro|cafe|bar|reservation|menu|chef)\b/,
      label: "restaurant",
      terms: ["restaurant", "menu", "dining", "reservation", "chef", "table", "dish", "bar", "hours", "private"],
      minimum: 5,
    },
    {
      promptPattern: /\b(portfolio|designer|photographer|artist|copywriter|creative|case study|case studies)\b/,
      label: "portfolio",
      terms: ["portfolio", "work", "project", "case", "client", "services", "creative", "brief", "selected", "contact"],
      minimum: 5,
    },
    {
      promptPattern: /\b(saas|software|startup|app|platform|dashboard|api|demo|workflow)\b/,
      label: "software product",
      terms: ["product", "software", "workflow", "demo", "dashboard", "integration", "team", "feature", "metric", "security"],
      minimum: 5,
    },
  ];

  for (const rule of rules) {
    if (!rule.promptPattern.test(lowerPrompt)) continue;
    const hits = rule.terms.filter((term) => combined.includes(term)).length;

    if (hits < rule.minimum) {
      throw new Error(`Generated ${rule.label} site was not specific enough to the prompt.`);
    }
  }
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
