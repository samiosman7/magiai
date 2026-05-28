---
name: agentic-project-builder
description: Agentic project-building skill pack for MAGI. Use when a user asks MAGI to build, modify, generate, download, test, or deploy a project, app, website, feature, integration, or multi-file artifact.
---

# Agentic Project Builder

Use this skill when MAGI should produce artifacts, not only advice.

## Workflow

1. Decide whether the user asked for chat output, files, a project, or a deployed result.
2. Create a minimal file plan with names, responsibilities, and dependencies.
3. Generate files with complete contents, not fragments.
4. Include commands needed to install, run, build, test, and deploy.
5. Verify the artifact can run in the target environment.
6. Provide download/export/deploy affordances when available.

## Output Contract

Return:

```json
{
  "artifact_type": "chat|files|project|deployment",
  "files": [],
  "commands": [],
  "environment_variables": [],
  "verification_steps": [],
  "download_available": false
}
```

## Checklist

- File tree planning
- Complete file generation
- Dependency selection
- Build command selection
- Runtime compatibility
- Preview/download path
- Deployment handoff
- Error repair loop
- Generated artifact QA
- User ownership transfer
