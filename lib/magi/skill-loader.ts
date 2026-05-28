import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const skillRoot = process.cwd();

export async function loadSkillPack(relativePath: string) {
  const safePath = relativePath.replaceAll("\\", "/");
  if (safePath.includes("..")) {
    throw new Error(`Unsafe skill path: ${relativePath}`);
  }

  return readFile(path.join(skillRoot, safePath), "utf8");
}

export async function loadSkillPacks(relativePaths: string[]) {
  const results = await Promise.all(
    relativePaths.map(async (relativePath) => ({
      path: relativePath,
      content: await loadSkillPack(relativePath),
    }))
  );

  return results
    .map((skill) => `# Skill source: ${skill.path}\n\n${skill.content}`)
    .join("\n\n---\n\n");
}
