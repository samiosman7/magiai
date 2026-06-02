# MAGI Model Routing Notes

Last checked: 2026-06-01

## Latest Useful Model Families

| Provider | Models to consider |
| --- | --- |
| OpenAI | `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.5-pro` |
| Anthropic | `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5` |
| Google Gemini | `gemini-3.1-pro-preview`, `gemini-3.5-flash`, `gemini-3-flash-preview`, `gemini-3.1-flash-lite` |

## Recommended MAGI Routing

```ts
economy: {
  direct: "gemini-3.1-flash-lite",
  melchior: "gemini-3.5-flash",
  balthasar: "gemini-3.5-flash",
  casper: "gemini-3.1-flash-lite",
  judge: "gemini-3.5-flash"
}

standard: {
  direct: "gemini-3.5-flash",
  melchior: "claude-sonnet-4-6",
  balthasar: "gpt-5.4-mini",
  casper: "claude-sonnet-4-6",
  judge: "gpt-5.4-mini"
}

premium: {
  direct: "gpt-5.4-mini",
  melchior: "claude-opus-4-8",
  balthasar: "gpt-5.5",
  casper: "claude-sonnet-4-6",
  judge: "gpt-5.5"
}
```

## Special Routes

```ts
coding: "gpt-5.5" or "claude-opus-4-8"
cheapCoding: "gpt-5.4-mini" or "gemini-3.5-flash"
research: "gpt-5.5" with search / grounding
cheapResearch: "gemini-3.5-flash"
fastScan: "gpt-5.4-nano" or "gemini-3.1-flash-lite"
```

## Product Recommendation

Make Standard the default paid route:

- Melchior: `claude-sonnet-4-6`
- Balthasar: `gpt-5.4-mini`
- Casper: `claude-sonnet-4-6`
- Fact Judge: `gpt-5.4-mini`
- Fallback: `gemini-3.5-flash`

Reserve `gpt-5.5` and `claude-opus-4-8` for premium users, hard prompts, or failed judge checks.

## Sources

- OpenAI models: https://developers.openai.com/api/docs/models
- OpenAI pricing: https://developers.openai.com/api/docs/pricing
- Gemini models: https://ai.google.dev/gemini-api/docs/models
- Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
- Claude models: https://platform.claude.com/docs/en/about-claude/models/overview
