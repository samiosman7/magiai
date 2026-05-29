import type { ModelCall, ModelResult } from "./types";
import { getProviderKeys } from "./provider-keys";

export async function generateText(call: ModelCall): Promise<ModelResult> {
  if (call.provider === "mock" || process.env.MAGI_MOCK_MODE === "true") {
    return mockGenerate(call);
  }

  if (call.provider === "openai") return openAiCompatible(call, process.env.OPENAI_API_KEY, "https://api.openai.com/v1/chat/completions");
  if (call.provider === "deepseek") return openAiCompatible(call, process.env.DEEPSEEK_API_KEY, "https://api.deepseek.com/chat/completions");
  if (call.provider === "qwen") return openAiCompatible(call, process.env.QWEN_API_KEY, "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions");
  if (call.provider === "anthropic") return anthropic(call);
  if (call.provider === "google") return google(call);

  return mockGenerate(call);
}

async function openAiCompatible(
  call: ModelCall,
  apiKey: string | undefined,
  url: string
): Promise<ModelResult> {
  if (!apiKey) return mockGenerate(call);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: call.model,
      messages: [
        { role: "system", content: call.system },
        { role: "user", content: call.prompt },
      ],
      max_tokens: call.maxTokens ?? 900,
      temperature: call.temperature ?? 0.25,
    }),
  });

  if (!response.ok) {
    throw new Error(`${call.provider} returned ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return {
    text: data.choices?.[0]?.message?.content?.trim() || "",
    provider: call.provider,
    model: call.model,
    isMock: false,
  };
}

async function anthropic(call: ModelCall): Promise<ModelResult> {
  if (!process.env.ANTHROPIC_API_KEY) return mockGenerate(call);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: call.model,
      system: call.system,
      max_tokens: call.maxTokens ?? 900,
      temperature: call.temperature ?? 0.25,
      messages: [{ role: "user", content: call.prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`anthropic returned ${response.status}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text = data.content?.find((item) => item.type === "text")?.text?.trim() || "";

  return { text, provider: call.provider, model: call.model, isMock: false };
}

async function google(call: ModelCall): Promise<ModelResult> {
  const keys = getProviderKeys("google");
  if (keys.length === 0) return mockGenerate(call);

  let lastError: Error | null = null;
  const models = googleModelFallbacks(call.model);

  for (const apiKey of keys) {
    for (const model of models) {
      try {
        return await googleWithKey({ ...call, model }, apiKey);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("google call failed");
      }
    }
  }

  return fallbackGenerate(call, lastError ?? new Error("google call failed for all configured keys"));
}

async function googleWithKey(call: ModelCall, apiKey: string): Promise<ModelResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${call.model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: call.system }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: call.prompt }],
          },
        ],
        generationConfig: {
          maxOutputTokens: call.maxTokens ?? 900,
          temperature: call.temperature ?? 0.25,
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`google returned ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    promptFeedback?: unknown;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  if (!text) {
    throw new Error(
      `google returned no text${data.candidates?.[0]?.finishReason ? ` (${data.candidates[0].finishReason})` : ""}`
    );
  }

  return { text, provider: call.provider, model: call.model, isMock: false };
}

function googleModelFallbacks(model: string) {
  const fallbacks = [
    model,
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ];

  return [...new Set(fallbacks)];
}

function mockGenerate(call: ModelCall): ModelResult {
  const label = `${call.provider}:${call.model}`;
  let text = "";

  if (call.system.includes("correction and gap-filling")) {
    text = `Mock ${label}: identified missing assumptions, added a complete response shape, and preserved the user's core request.`;
  } else if (call.system.includes("builder and hardener")) {
    text = `Mock ${label}: hardened the draft into a clear final answer with concrete next steps and reduced ambiguity.`;
  } else if (call.system.includes("intent-preservation")) {
    text = JSON.stringify({
      passed: true,
      issue: null,
      rationale: "The response stays aligned with the user's request and does not overcorrect.",
    });
  } else if (call.system.includes("fresh, independent correctness judge")) {
    text = JSON.stringify({
      passed: true,
      issue: null,
      rationale: "No blocking correctness problem was found in mock mode.",
    });
  } else {
    text =
      "This is a mock MAGI response. Add provider keys and set MAGI_MOCK_MODE=false to generate live model output.";
  }

  return {
    text,
    provider: "mock",
    model: "magi-mock",
    isMock: true,
  };
}

function fallbackGenerate(call: ModelCall, error: Error): ModelResult {
  const prompt = call.prompt.trim();
  let text =
    "MAGI could not reach the configured live provider, so this response is a local fallback. Check deployment environment variables and provider network access.";

  if (call.system.includes("MAGI direct route")) {
    text = [
      "I could not reach the live model provider, but here is a useful direct response path:",
      "",
      "- Restate the concrete objective in one sentence.",
      "- Break the work into the smallest launchable step.",
      "- Verify the result with a real user-facing test before adding more complexity.",
      "",
      `Original request: ${prompt}`,
    ].join("\n");
  }

  if (call.system.includes("correction and gap-filling")) {
    text = [
      "Fallback repaired draft:",
      "Clarify the user's desired outcome, identify missing setup or constraints, then produce a direct answer with concrete steps and a verification plan.",
      `Provider issue: ${error.message}`,
    ].join(" ");
  }

  if (call.system.includes("builder and hardener")) {
    text = [
      "Fallback final answer:",
      "1. Define the exact user-facing outcome.",
      "2. Implement the smallest backend path that produces that outcome.",
      "3. Test it with one realistic prompt and fix any missing provider/configuration issues.",
      "4. Only then add billing, storage, and analytics around the working path.",
      "",
      `Provider issue: ${error.message}`,
    ].join("\n");
  }

  if (call.system.includes("intent-preservation") || call.system.includes("fresh, independent correctness judge")) {
    text = JSON.stringify({
      passed: false,
      issue: "live provider unavailable",
      rationale: `The provider call failed before this node could independently verify the answer: ${error.message}`,
    });
  }

  return {
    text,
    provider: "mock",
    model: "provider-fallback",
    isMock: true,
  };
}
