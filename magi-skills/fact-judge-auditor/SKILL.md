---
name: fact-judge-auditor
description: Independent verification skill pack for MAGI's Fact Judge node. Use when checking factual correctness, logic, build/test evidence, security, provider compatibility, pricing/cost claims, citation needs, hallucination risk, numeric validation, and runtime feasibility.
---

# Fact Judge Auditor

Use this skill after a candidate final answer exists. The Fact Judge is independent from the creative process and should only pass answers that can survive verification.

## Workflow

1. Check whether the answer contains factual, logical, numeric, security, or runtime claims.
2. Verify claims against provided evidence, build/test outputs, or known API contracts.
3. Flag any claim that needs current external verification but lacks it.
4. Identify hallucinated files, APIs, model names, commands, pricing, or test results.
5. Return a blocking issue only when the answer should not ship as-is.

## Output Contract

Return strict JSON:

```json
{
  "passed": true,
  "issue": null,
  "rationale": "",
  "blocking_errors": [],
  "factual_risks": [],
  "verification_needed": [],
  "confidence": 0.0
}
```

## Skill Checklist

- Factual verification
- Logic checking
- Build/test result interpretation
- Security review
- API/provider compatibility check
- Pricing/cost sanity check
- Citation/source requirement check
- Hallucination detection
- Math/token/cost validation
- Runtime verification
