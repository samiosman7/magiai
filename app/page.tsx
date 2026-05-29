"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type PipelineStep = "scan" | "melchior" | "balthasar" | "casper" | "judge" | "final";
type StepState = "" | "active" | "done";

type Message = {
  id: string;
  kind: "user" | "magi" | "status";
  text: string;
  downloadPrompt?: string;
};

type NodeOutput = {
  name: string;
  text: string;
};

type SkillOutput = {
  node: string;
  skills: string[];
  sourcePath?: string;
};

type McpServerStatus = {
  name: string;
  url: string;
  enabled: boolean;
  connected: boolean;
  tools: Array<{ name: string; description?: string }>;
  error?: string;
};

type McpCatalogEntry = {
  id: string;
  name: string;
  category: string;
  description: string;
  transport: string;
  productionReadyOnVercel: boolean;
  sourceUrl: string;
};

type MagiEvent =
  | { type: "status"; step: PipelineStep; message: string }
  | { type: "node"; name: string; text: string }
  | { type: "skills"; node: string; skills: string[]; sourcePath?: string }
  | { type: "step"; step: PipelineStep; state: StepState }
  | { type: "final"; answer: string }
  | { type: "error"; message: string };

const pipelineItems: Array<{ step: PipelineStep; label: string }> = [
  { step: "scan", label: "Difficulty scan" },
  { step: "melchior", label: "Melchior repairs gaps" },
  { step: "balthasar", label: "Balthasar hardens answer" },
  { step: "casper", label: "Casper checks intent" },
  { step: "judge", label: "Fact Judge verifies" },
  { step: "final", label: "Final ruling" },
];

const initialSteps = Object.fromEntries(
  pipelineItems.map(({ step }) => [step, ""])
) as Record<PipelineStep, StepState>;

function createId() {
  return crypto.randomUUID();
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"economy" | "standard" | "premium">("standard");
  const [geminiModel, setGeminiModel] = useState("gemini-2.5-flash");
  const [messages, setMessages] = useState<Message[]>([]);
  const [steps, setSteps] = useState<Record<PipelineStep, StepState>>(initialSteps);
  const [nodeOutputs, setNodeOutputs] = useState<NodeOutput[]>([]);
  const [skillOutputs, setSkillOutputs] = useState<SkillOutput[]>([]);
  const [mcpServers, setMcpServers] = useState<McpServerStatus[]>([]);
  const [mcpCatalog, setMcpCatalog] = useState<McpCatalogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const hasMessages = messages.length > 0;

  const modeLabel = useMemo(() => {
    if (mode === "economy") return "Economy MAGI";
    if (mode === "premium") return "Premium MAGI";
    return "Standard MAGI";
  }, [mode]);

  useEffect(() => {
    let mounted = true;

    fetch("/api/mcp/servers")
      .then((response) => (response.ok ? response.json() : { servers: [] }))
      .then((data: { servers?: McpServerStatus[] }) => {
        if (mounted) setMcpServers(data.servers ?? []);
      })
      .catch(() => {
        if (mounted) setMcpServers([]);
      });

    fetch("/api/mcp/catalog")
      .then((response) => (response.ok ? response.json() : { servers: [] }))
      .then((data: { servers?: McpCatalogEntry[] }) => {
        if (mounted) setMcpCatalog(data.servers ?? []);
      })
      .catch(() => {
        if (mounted) setMcpCatalog([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isRunning) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setPrompt("");
    setMessages((current) => [...current, { id: createId(), kind: "user", text: trimmed }]);
    setSteps(initialSteps);
    setNodeOutputs([]);
    setSkillOutputs([]);

    try {
      const response = await fetch("/api/magi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, mode, geminiModel }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("MAGI route failed to respond.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          handleMagiEvent(JSON.parse(line) as MagiEvent);
        }
      }

      if (buffer.trim()) {
        handleMagiEvent(JSON.parse(buffer) as MagiEvent);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessages((current) => [
          ...current,
          {
            id: createId(),
            kind: "status",
            text: "MAGI connection fault. Check server logs and provider keys.",
          },
        ]);
      }
    } finally {
      setIsRunning(false);
    }
  }

  function handleMagiEvent(event: MagiEvent) {
    if (event.type === "status") {
      setMessages((current) => [
        ...current,
        { id: createId(), kind: "status", text: event.message },
      ]);
      return;
    }

    if (event.type === "node") {
      setNodeOutputs((current) => [...current, { name: event.name, text: event.text }]);
      return;
    }

    if (event.type === "skills") {
      setSkillOutputs((current) => [
        ...current.filter((output) => output.node !== event.node),
        { node: event.node, skills: event.skills, sourcePath: event.sourcePath },
      ]);
      return;
    }

    if (event.type === "step") {
      setSteps((current) => ({ ...current, [event.step]: event.state }));
      return;
    }

    if (event.type === "final") {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          kind: "magi",
          text: event.answer,
          downloadPrompt: latestWebsitePrompt(current),
        },
      ]);
      return;
    }

    setMessages((current) => [
      ...current,
      { id: createId(), kind: "status", text: event.message },
    ]);
  }

  function resetRun() {
    abortRef.current?.abort();
    setMessages([]);
    setSteps(initialSteps);
    setNodeOutputs([]);
    setSkillOutputs([]);
    setIsRunning(false);
  }

  async function downloadProject(downloadPrompt: string) {
    setMessages((current) => [
      ...current,
      {
        id: createId(),
        kind: "status",
        text: "Agentic project builder is generating downloadable files...",
      },
    ]);

    const response = await fetch("/api/projects/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: downloadPrompt }),
    });

    if (!response.ok) {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          kind: "status",
          text: "Project download failed. Try again after the current run completes.",
        },
      ]);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "magi-site.zip";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <section className="workspace" aria-label="MAGI chat workspace">
        <header className="topbar">
          <div className="brand-lockup">
            <div className="nerv-mark" aria-hidden="true">
              NERV
            </div>
            <p className="kicker">Magi command authority</p>
            <h1>The Magi has decided.</h1>
          </div>
          <div className="signal" aria-label="System status">
            <span />
            Synced
          </div>
          <div className="auth-station" aria-label="Operator authentication">
            <div>
              <small>Operator</small>
              <strong>Test Session</strong>
            </div>
          </div>
        </header>

        <section className="console" aria-live="polite">
          <div className="warning-strip" aria-hidden="true">
            <span>Central Dogma</span>
            <span>{modeLabel}</span>
            <span>MAGI-OS</span>
          </div>

          {!hasMessages && (
            <div className="empty-state">
              <div className="mark" aria-hidden="true">
                M
              </div>
              <h2>Three AIs. One answer. No blind spots.</h2>
              <p>
                Choose a mode, enter a directive, and MAGI will route the request
                through correction, hardening, intent review, and final judgment.
              </p>
            </div>
          )}

          <div className="messages">
            {messages.map((message) => (
              <article className={`message ${message.kind}`} key={message.id}>
                {message.text}
                {message.downloadPrompt && (
                  <button
                    className="download-button"
                    type="button"
                    onClick={() => downloadProject(message.downloadPrompt!)}
                  >
                    Generate and download website files
                  </button>
                )}
              </article>
            ))}
          </div>
        </section>

        <form className="composer" onSubmit={submitPrompt}>
          <label className="sr-only" htmlFor="modeSelect">
            MAGI mode
          </label>
          <select
            id="modeSelect"
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as "economy" | "standard" | "premium")
            }
            disabled={isRunning}
          >
            <option value="economy">Economy</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
          <label className="sr-only" htmlFor="geminiModelSelect">
            Gemini model
          </label>
          <select
            id="geminiModelSelect"
            value={geminiModel}
            onChange={(event) => setGeminiModel(event.target.value)}
            disabled={isRunning}
          >
            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
          </select>
          <label className="sr-only" htmlFor="promptInput">
            Prompt
          </label>
          <textarea
            id="promptInput"
            rows={2}
            placeholder="Enter directive for MAGI review..."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            disabled={isRunning}
          />
          <button type="submit" disabled={isRunning}>
            {isRunning ? "Running" : "Decide"}
          </button>
        </form>
      </section>

      <aside className="dossier" aria-label="Decision dossier">
        <div className="panel-head">
          <div>
            <p className="kicker">NERV dossier</p>
            <h2>Run trace</h2>
          </div>
          <button className="ghost" type="button" onClick={resetRun}>
            Reset
          </button>
        </div>

        <ol className="pipeline">
          {pipelineItems.map((item) => (
            <li className={steps[item.step]} key={item.step}>
              <span />
              {item.label}
            </li>
          ))}
        </ol>

        <details className="node-card" open>
          <summary>Node outputs</summary>
          <div className="node-log">
            {nodeOutputs.length === 0 ? (
              <p>No run yet.</p>
            ) : (
              nodeOutputs.map((output, index) => (
                <div className="node-output" key={`${output.name}-${index}`}>
                  <strong>{output.name}</strong>
                  <span>{output.text}</span>
                </div>
              ))
            )}
          </div>
        </details>

        <details className="node-card">
          <summary>MCP catalog</summary>
          <div className="mcp-log">
            {mcpCatalog.length === 0 ? (
              <p>No MCP catalog entries loaded.</p>
            ) : (
              mcpCatalog.map((entry) => (
                <div className="mcp-output" key={entry.id}>
                  <strong>{entry.name}</strong>
                  <code>{entry.category} | {entry.transport}</code>
                  <p>{entry.description}</p>
                  <a href={entry.sourceUrl} rel="noreferrer" target="_blank">
                    Source
                  </a>
                  <span className={entry.productionReadyOnVercel ? "mcp-ok" : "mcp-fail"}>
                    {entry.productionReadyOnVercel ? "Vercel-ready" : "Local/hosted needed"}
                  </span>
                </div>
              ))
            )}
          </div>
        </details>

        <details className="node-card">
          <summary>Active skills</summary>
          <div className="skill-log">
            {skillOutputs.length === 0 ? (
              <p>No skills activated yet.</p>
            ) : (
              skillOutputs.map((output) => (
                <div className="skill-output" key={output.node}>
                  <strong>{output.node}</strong>
                  {output.sourcePath && <code>{output.sourcePath}</code>}
                  <ul>
                    {output.skills.map((skill) => (
                      <li key={skill}>{skill}</li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </details>

        <details className="node-card">
          <summary>MCP servers</summary>
          <div className="mcp-log">
            {mcpServers.length === 0 ? (
              <p>No MCP servers configured.</p>
            ) : (
              mcpServers.map((server) => (
                <div className="mcp-output" key={server.name}>
                  <strong>{server.name}</strong>
                  <code>{server.url}</code>
                  <span className={server.connected ? "mcp-ok" : "mcp-fail"}>
                    {server.connected ? "Connected" : server.enabled ? "Unavailable" : "Disabled"}
                  </span>
                  {server.error && <p>{server.error}</p>}
                  {server.tools.length > 0 && (
                    <ul>
                      {server.tools.map((tool) => (
                        <li key={tool.name}>{tool.name}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
          </div>
        </details>

        <details className="node-card">
          <summary>Decision rules</summary>
          <p>
            MAGI only reprompts automatically when Casper and the Fact Judge
            converge on the same issue. Disagreement is recorded, but it does not
            slow down every answer.
          </p>
        </details>
      </aside>
    </main>
  );
}

function latestWebsitePrompt(messages: Message[]) {
  const userPrompt = [...messages].reverse().find((message) => message.kind === "user")?.text;
  if (!userPrompt) return undefined;
  return isWebsiteBuildPrompt(userPrompt) ? userPrompt : undefined;
}

function isWebsiteBuildPrompt(prompt: string) {
  const lower = prompt.toLowerCase();
  return (
    /\b(build|create|make|generate|design)\b/.test(lower) &&
    /\b(website|site|landing page|web page|homepage|portfolio)\b/.test(lower)
  );
}
