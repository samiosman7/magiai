import "server-only";

import { getBillingProfile } from "@/lib/billing/credits";
import { hasSupabaseConfig, getSupabaseAdmin } from "@/lib/supabase/server";
import type { MagiArtifact } from "@/lib/magi/types";
import type { GeneratedProject } from "@/lib/projects/website-generator";

export async function saveArtifactPackage({
  userId,
  artifactType,
  project,
  metadata,
}: {
  userId: string;
  artifactType: MagiArtifact["type"];
  project: GeneratedProject;
  metadata?: Record<string, unknown>;
}) {
  if (!hasSupabaseConfig()) return { saved: false };

  // Ensures the profile row exists (magi_artifacts references it).
  await getBillingProfile(userId);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("magi_artifacts").insert({
    clerk_user_id: userId,
    artifact_type: artifactType,
    title: project.title,
    status: "ready_for_export",
    summary: `${project.files.length} generated file(s).`,
    files: project.files.map((file) => ({
      path: file.path,
      bytes: new TextEncoder().encode(file.content).length,
    })),
    metadata: metadata ?? {},
  });

  if (error) return { saved: false, error: error.message };
  return { saved: true };
}
