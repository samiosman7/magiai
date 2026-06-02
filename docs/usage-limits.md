# MAGI Usage Limit Model

Last updated: 2026-06-01

MAGI should feel like Claude-style capacity management, not a visible credit arcade.

## Product UX

Users should normally see:

```text
Capacity: Nominal
```

When they approach limits:

```text
Capacity: Low
MAGI may switch to efficient routing soon.
```

When premium capacity is exhausted:

```text
Premium routing is unavailable until reset.
Standard routing remains available.
```

When the full account limit is exhausted:

```text
Usage limit reached for this cycle.
```

## Internal Metering

Do not expose credits directly. Track hidden internal usage units and estimated provider cost.

Suggested formula:

```ts
internalUsage =
  estimatedInputTokens
  + estimatedOutputTokens * 3
  + attachmentTokens
  + conversationContextTokens
  + artifactMultiplier
  + modelTierMultiplier
  + toolCallMultiplier
  + ensembleMultiplier
```

Also track estimated USD cost:

```ts
estimatedCostUsd =
  providerInputCost
  + providerOutputCost
  + retryCost
  + toolCost
```

## Routing States

```ts
if (usage < 70%) {
  state = "nominal";
  route = "cheap ensemble + flagship arbiter";
}

if (usage >= 70% && usage < 90%) {
  state = "efficient";
  route = "cheap ensemble + mid-tier arbiter";
}

if (usage >= 90% && usage < 100%) {
  state = "conserve";
  route = "single cheap model or cheap ensemble only";
}

if (usage >= 100%) {
  state = "blocked";
  route = "block premium/deep/artifact tasks";
}
```

## Hard Safety Caps

MAGI still needs strict backend protection:

- per-user five-hour capacity
- per-user daily capacity
- per-user monthly capacity
- global daily model spend cap
- global monthly model spend cap
- max prompt length
- max output tokens
- max retries
- emergency kill switch

## Claude-Like Principle

Users do not manage credits. The system manages capacity.

Internally, MAGI tracks exact cost and usage. Externally, users see only plan capacity states and clear blocks near limits.
