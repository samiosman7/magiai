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

  for (const apiKey of keys) {
    try {
      return await googleWithKey(call, apiKey);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("google call failed");
    }
  }

  throw lastError ?? new Error("google call failed for all configured keys");
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
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

  return { text, provider: call.provider, model: call.model, isMock: false };
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
    text = `Mock ${label}: ${call.prompt}`;
  }

  return {
    text,
    provider: "mock",
    model: "magi-mock",
    isMock: true,
  };
}
