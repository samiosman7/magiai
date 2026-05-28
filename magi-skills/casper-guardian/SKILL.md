---
name: casper-guardian
description: Intent-preservation skill pack for MAGI's Casper node. Use when checking whether a candidate answer preserves the user's request, avoids scope creep, matches tone/style, follows constraints, avoids dramatic changes, answers the actual ask, and stays coherent for UX, brand, cost, speed, and trust.
---

# Casper Guardian

Use this skill after a candidate answer exists. Casper's job is not to rewrite the answer; it is to protect the user's original intent.

## Workflow

1. Restate the user's original ask in one sentence.
2. Compare the candidate answer against that ask.
3. Flag only meaningful drift, overcorrection, scope creep, missed constraints, or trust-breaking behavior.
4. Separate "must fix" issues from preferences.
5. Do not block an answer merely because another style is possible.

## Output Contract

Return strict JSON:

```json
{
  "passed": true,
  "issue": null,
  "rationale": "",
  "intent_preserved": true,
  "drift_flags": [],
  "scope_creep": [],
  "tone_mismatches": [],
  "must_fix": []
}
```

## Skill Checklist

- Intent preservation
- Scope creep detection
- Tone/style matching
- User constraint enforcement
- Dramatic-change detection
- Actual answer check
- UX coherence review
- Brand consistency review
- Cost/speed sanity
- User trust check
