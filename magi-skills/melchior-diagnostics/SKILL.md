---
name: melchior-diagnostics
description: Diagnostic skill pack for MAGI's Melchior node. Use when a prompt needs requirements extraction, gap detection, assumption tracking, edge-case discovery, ambiguity resolution, constraint mapping, risk identification, architecture critique, root-cause analysis, or failure analysis before drafting an answer.
---

# Melchior Diagnostics

Use this skill before construction or finalization. Melchior's job is to make the task harder to misunderstand.

## Workflow

1. Extract explicit requirements from the user prompt.
2. Infer likely implied requirements, but mark them as assumptions.
3. Identify missing context, skipped setup, hidden dependencies, and edge cases.
4. Map constraints: technical, product, cost, speed, safety, legal, style, and user-stated limits.
5. Identify the most likely failure modes.
6. Repair the draft by filling missing steps without changing the user's goal.

## Output Contract

Return concise structured prose or JSON containing:

```json
{
  "requirements": [],
  "missing_context": [],
  "assumptions": [],
  "constraints": [],
  "risks": [],
  "failure_modes": [],
  "repair_plan": "",
  "draft": ""
}
```

## Skill Checklist

- Requirements extraction
- Missing-step detection
- Assumption tracking
- Edge-case discovery
- Ambiguity resolution
- Constraint mapping
- Risk identification
- Architecture critique
- Root-cause analysis
- Failure analysis
