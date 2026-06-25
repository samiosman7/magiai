"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type PipelineStep = "scan" | "route" | "melchior" | "balthasar" | "casper" | "judge" | "final";
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

type TaskProfile = {
  kind: string;
  label: string;
  artifactType: string;
  skillPacks: string[];
  judgeRubric: string;
  toolHints: string[];
  secondaryKinds: string[];
};

type MagiArtifact = {
  id: string;
  type: string;
  title: string;
  status: string;
  summary: string;
  actions: Array<{ label: string; action: "download_website" | "save_planned" }>;
};

type WorkspaceRun = {
  id: string;
  prompt: string;
  taskLabel: string;
  artifactType: string;
  finalAnswer: string;
  createdAt: string;
};

type SavedArtifact = {
  id: string;
  artifact_type: string;
  title: string;
  status: string;
  summary?: string;
  created_at: string;
};

type ProviderStatus = {
  provider: string;
  configured: boolean;
  keyCount: number;
};

type MagiEvent =
  | { type: "status"; step: PipelineStep; message: string }
  | { type: "node"; name: string; text: string }
  | { type: "skills"; node: string; skills: string[]; sourcePath?: string }
  | { type: "task"; profile: TaskProfile }
  | { type: "artifact"; artifact: MagiArtifact }
  | { type: "step"; step: PipelineStep; state: StepState }
  | { type: "cost"; total: number; mode: string; breakdown: Array<{ node: string; cost: number }> }
  | { type: "final"; answer: string }
  | { type: "error"; message: string };

type RunCost = { total: number; mode: string; breakdown: Array<{ node: string; cost: number }> };

const pipelineItems: Array<{ step: PipelineStep; label: string }> = [
  { step: "scan", label: "Difficulty scan" },
  { step: "route", label: "Task router" },
  { step: "melchior", label: "Architect — by the book" },
  { step: "balthasar", label: "Maverick — outside the box" },
  { step: "casper", label: "Adversary — red-team" },
  { step: "judge", label: "Synthesis — final forge" },
  { step: "final", label: "Decision released" },
];

const initialSteps = Object.fromEntries(
  pipelineItems.map(({ step }) => [step, ""])
) as Record<PipelineStep, StepState>;

type ModeKey = "economy" | "standard" | "premium";

const modeInfo: Record<ModeKey, { label: string; models: string; cost: string; blurb: string }> = {
  economy: { label: "Economy", models: "DeepSeek V3", cost: "~$0.004", blurb: "One fast model" },
  standard: { label: "Standard", models: "DeepSeek · Qwen3 · Llama 3.3", cost: "~$0.007", blurb: "Three cheap minds" },
  premium: { label: "Premium", models: "Gemini 3.1 Pro · GPT-5.5 · Sonnet 4.6", cost: "~$0.05", blurb: "Frontier models" },
};

const heroRoles: Array<{ name: string; desc: string }> = [
  { name: "Architect", desc: "drafts it by the book" },
  { name: "Maverick", desc: "adds the bold angle" },
  { name: "Adversary", desc: "attacks & hardens it" },
  { name: "Synthesis", desc: "forges the final answer" },
];

function createId() {
  return crypto.randomUUID();
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"economy" | "standard" | "premium">("standard");
  // Pipeline routing is set by mode (cheap ensemble vs Sonnet), not a user-picked model.
  // Kept only as a default for the separate website/artifact download generators.
  const [geminiModel] = useState("gemini-2.5-flash");
  const [messages, setMessages] = useState<Message[]>([]);
  const [steps, setSteps] = useState<Record<PipelineStep, StepState>>(initialSteps);
  const [nodeOutputs, setNodeOutputs] = useState<NodeOutput[]>([]);
  const [skillOutputs, setSkillOutputs] = useState<SkillOutput[]>([]);
  const [taskProfile, setTaskProfile] = useState<TaskProfile | null>(null);
  const [artifacts, setArtifacts] = useState<MagiArtifact[]>([]);
  const [workspaceRuns, setWorkspaceRuns] = useState<WorkspaceRun[]>([]);
  const [savedArtifacts, setSavedArtifacts] = useState<SavedArtifact[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [mockMode, setMockMode] = useState(false);
  const [operatorId, setOperatorId] = useState("");
  const [mcpServers, setMcpServers] = useState<McpServerStatus[]>([]);
  const [mcpCatalog, setMcpCatalog] = useState<McpCatalogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runCost, setRunCost] = useState<RunCost | null>(null);
  const [costByMode, setCostByMode] = useState<Record<string, number>>({});
  const abortRef = useRef<AbortController | null>(null);
  const currentPromptRef = useRef("");

  const hasMessages = messages.length > 0;

  const modeLabel = useMemo(() => {
    if (mode === "economy") return "Economy MAGI";
    if (mode === "premium") return "Premium MAGI";
    return "Standard MAGI";
  }, [mode]);

  useEffect(() => {
    const storedOperator = window.localStorage.getItem("magi.operatorId");
    const nextOperator = storedOperator || `operator-${crypto.randomUUID()}`;
    window.localStorage.setItem("magi.operatorId", nextOperator);
    setOperatorId(nextOperator);

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

    fetch("/api/providers")
      .then((response) => (response.ok ? response.json() : { providers: [] }))
      .then((data: { providers?: ProviderStatus[]; mockMode?: boolean }) => {
        if (mounted) {
          setProviders(data.providers ?? []);
          setMockMode(Boolean(data.mockMode));
        }
      })
      .catch(() => {
        if (mounted) setProviders([]);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("magi.workspaceRuns");
    if (stored) {
      try {
        setWorkspaceRuns(JSON.parse(stored) as WorkspaceRun[]);
      } catch {
        setWorkspaceRuns([]);
      }
    }

    const storedCost = window.localStorage.getItem("magi.costByMode");
    if (storedCost) {
      try {
        setCostByMode(JSON.parse(storedCost) as Record<string, number>);
      } catch {
        setCostByMode({});
      }
    }
  }, []);

  useEffect(() => {
    if (!operatorId) return;

    fetch("/api/runs", {
      headers: { "x-magi-user-id": operatorId },
    })
      .then((response) => (response.ok ? response.json() : { runs: [] }))
      .then((data: { runs?: Array<{ id: string; prompt: string; final_answer?: string; created_at: string }> }) => {
        if (!data.runs?.length) return;
        setWorkspaceRuns((current) => {
          const remoteRuns = data.runs!.map((run) => ({
            id: run.id,
            prompt: run.prompt,
            taskLabel: "Saved MAGI run",
            artifactType: "answer",
            finalAnswer: run.final_answer || "No final answer was stored for this run.",
            createdAt: run.created_at,
          }));
          const merged = [...remoteRuns, ...current];
          const seen = new Set<string>();
          return merged.filter((run) => {
            if (seen.has(run.id)) return false;
            seen.add(run.id);
            return true;
          }).slice(0, 20);
        });
      })
      .catch(() => null);

    fetch("/api/artifacts", {
      headers: { "x-magi-user-id": operatorId },
    })
      .then((response) => (response.ok ? response.json() : { artifacts: [] }))
      .then((data: { artifacts?: SavedArtifact[] }) => {
        setSavedArtifacts(data.artifacts ?? []);
      })
      .catch(() => null);
  }, [operatorId]);

  useEffect(() => {
    window.localStorage.setItem("magi.workspaceRuns", JSON.stringify(workspaceRuns.slice(0, 20)));
  }, [workspaceRuns]);

  async function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed || isRunning) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsRunning(true);
    setPrompt("");
    currentPromptRef.current = trimmed;
    setMessages((current) => [...current, { id: createId(), kind: "user", text: trimmed }]);
    setSteps(initialSteps);
    setNodeOutputs([]);
    setSkillOutputs([]);
    setTaskProfile(null);
    setArtifacts([]);
    setRunCost(null);

    try {
      const response = await fetch("/api/magi", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-magi-user-id": operatorId },
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

    if (event.type === "task") {
      setTaskProfile(event.profile);
      return;
    }

    if (event.type === "artifact") {
      setArtifacts((current) => [
        ...current.filter((artifact) => artifact.id !== event.artifact.id),
        event.artifact,
      ]);
      return;
    }

    if (event.type === "step") {
      setSteps((current) => ({ ...current, [event.step]: event.state }));
      return;
    }

    if (event.type === "cost") {
      setRunCost({ total: event.total, mode: event.mode, breakdown: event.breakdown });
      setCostByMode((current) => {
        const next = { ...current, [event.mode]: event.total };
        window.localStorage.setItem("magi.costByMode", JSON.stringify(next));
        return next;
      });
      return;
    }

    if (event.type === "final") {
      const sourcePrompt = currentPromptRef.current;
      const currentArtifact = artifacts[artifacts.length - 1];
      if (sourcePrompt) {
        setWorkspaceRuns((current) => [
          {
            id: createId(),
            prompt: sourcePrompt,
            taskLabel: taskProfile?.label ?? "MAGI task",
            artifactType: currentArtifact?.type ?? taskProfile?.artifactType ?? "answer",
            finalAnswer: event.answer,
            createdAt: new Date().toISOString(),
          },
          ...current,
        ].slice(0, 20));
      }
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
    setTaskProfile(null);
    setArtifacts([]);
    setRunCost(null);
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
      headers: { "Content-Type": "application/json", "x-magi-user-id": operatorId },
      body: JSON.stringify({ prompt: downloadPrompt, geminiModel }),
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

  async function downloadArtifact(artifact: MagiArtifact) {
    const sourcePrompt =
      currentPromptRef.current || [...messages].reverse().find((message) => message.kind === "user")?.text;
    if (!sourcePrompt) return;

    if (artifact.actions.some((action) => action.action === "download_website")) {
      await downloadProject(sourcePrompt);
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: createId(),
        kind: "status",
        text: `Universal artifact builder is generating ${artifact.type} files...`,
      },
    ]);

    const response = await fetch("/api/artifacts/download", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-magi-user-id": operatorId },
      body: JSON.stringify({
        prompt: sourcePrompt,
        mode,
        geminiModel,
        artifactType: artifact.type,
      }),
    });

    if (!response.ok) {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          kind: "status",
          text: "Artifact download failed. Check provider configuration and try again.",
        },
      ]);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${artifact.type}-artifact.zip`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function startCheckout(pack: "starter" | "pro" | "studio") {
    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-magi-user-id": operatorId },
      body: JSON.stringify({ pack }),
    });
    const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;

    if (response.ok && data?.url) {
      window.location.href = data.url;
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: createId(),
        kind: "status",
        text: data?.error || "Checkout is not configured yet.",
      },
    ]);
  }

  return (
    <main className="shell">
      <section className="workspace" aria-label="MAGI chat workspace">
        <header className="topbar">
          <div className="brand-lockup">
            <span className="nerv-mark" aria-hidden="true">MAGI</span>
            <div>
              <p className="kicker">{modeLabel}</p>
              <h1>The Magi has decided.</h1>
            </div>
          </div>
          <div className="signal" aria-label="System status">
            <span />
            {isRunning ? "Deliberating" : "Ready"}
          </div>
          <div className="auth-station" aria-label="Operator">
            <small>Operator</small>
            <strong>{operatorId ? operatorId.replace("operator-", "OP-").slice(0, 18) : "Linking"}</strong>
          </div>
        </header>

        <section className="console" aria-live="polite">
          {!hasMessages && (
            <div className="empty-state">
              <p className="hero-kicker">Multi-model work engine</p>
              <h2>One prompt. Four expert minds. One answer.</h2>
              <p className="hero-sub">
                MAGI routes your request through four specialists — each building on the last —
                then hands back a single, polished result. No model-picking, no prompt-wrangling.
              </p>
              <ol className="hero-flow" aria-label="How MAGI works">
                {heroRoles.map((role, index) => (
                  <li key={role.name}>
                    <span className="hero-step-num">{index + 1}</span>
                    <strong>{role.name}</strong>
                    <span>{role.desc}</span>
                  </li>
                ))}
              </ol>
              <p className="hero-hint">
                Running on <strong>{modeInfo[mode].label}</strong> · {modeInfo[mode].models}
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
          <div className="mode-cards" role="radiogroup" aria-label="MAGI tier">
            {(Object.keys(modeInfo) as ModeKey[]).map((key) => (
              <button
                type="button"
                key={key}
                role="radio"
                aria-checked={mode === key}
                className={`mode-card ${mode === key ? "active" : ""}`}
                onClick={() => setMode(key)}
                disabled={isRunning}
              >
                <span className="mode-card-top">
                  <strong>{modeInfo[key].label}</strong>
                  <span className="mode-card-cost">{modeInfo[key].cost}</span>
                </span>
                <span className="mode-card-models">{modeInfo[key].models}</span>
              </button>
            ))}
          </div>
          <div className="composer-input">
            <label className="sr-only" htmlFor="promptInput">
              Prompt
            </label>
            <textarea
              id="promptInput"
              rows={2}
              placeholder="Ask MAGI anything — a plan, a memo, an analysis, code…"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={isRunning}
            />
            <button type="submit" disabled={isRunning}>
              {isRunning ? "Running" : "Decide"}
            </button>
          </div>
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
          <summary>Run cost</summary>
          <div className="cost-box">
            {runCost ? (
              <>
                <div className="cost-total">
                  <strong>${runCost.total.toFixed(4)}</strong>
                  <code>{runCost.mode}</code>
                </div>
                <ul className="cost-breakdown">
                  {runCost.breakdown.map((b) => (
                    <li key={b.node}>
                      <span>{b.node}</span>
                      <span>${b.cost.toFixed(4)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>No run yet.</p>
            )}
            {Object.keys(costByMode).length > 0 && (
              <div className="cost-compare">
                <p>Cost per run by mode (last seen)</p>
                {(["economy", "standard", "premium"] as const)
                  .filter((m) => costByMode[m] != null)
                  .map((m) => (
                    <div className="cost-compare-row" key={m}>
                      <span>{m}</span>
                      <span>${costByMode[m].toFixed(4)}</span>
                    </div>
                  ))}
                {costByMode.standard != null && costByMode.premium != null && costByMode.standard > 0 && (
                  <small>
                    Premium costs {Math.round(costByMode.premium / costByMode.standard)}× more than Standard.
                  </small>
                )}
              </div>
            )}
          </div>
        </details>

        <details className="node-card" open>
          <summary>Task route</summary>
          {taskProfile ? (
            <div className="task-route">
              <strong>{taskProfile.label}</strong>
              <code>{taskProfile.kind} | artifact: {taskProfile.artifactType}</code>
              <p>{taskProfile.judgeRubric}</p>
              <ul>
                {taskProfile.toolHints.map((hint) => (
                  <li key={hint}>{hint}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p>No task route selected yet.</p>
          )}
        </details>

        <details className="node-card" open>
          <summary>Artifacts</summary>
          <div className="artifact-log">
            {artifacts.length === 0 ? (
              <p>No artifacts planned yet.</p>
            ) : (
              artifacts.map((artifact) => (
                <div className="artifact-output" key={artifact.id}>
                  <strong>{artifact.title}</strong>
                  <code>{artifact.type} | {artifact.status}</code>
                  <p>{artifact.summary}</p>
                  {artifact.actions.map((action) =>
                    action.action === "download_website" || action.action === "save_planned" ? (
                      <button
                        className="artifact-action"
                        key={action.label}
                        type="button"
                        onClick={() => downloadArtifact(artifact)}
                      >
                        {action.action === "save_planned" ? "Download ZIP" : action.label}
                      </button>
                    ) : (
                      <span className="artifact-pill" key={action.label}>
                        {action.label}
                      </span>
                    )
                  )}
                </div>
              ))
            )}
          </div>
        </details>

        <details className="node-card">
          <summary>Credits</summary>
          <div className="billing-box">
            <p>Operator id</p>
            <code>{operatorId || "initializing"}</code>
            <div className="billing-actions">
              <button type="button" onClick={() => startCheckout("starter")}>
                25 credits
              </button>
              <button type="button" onClick={() => startCheckout("pro")}>
                120 credits
              </button>
              <button type="button" onClick={() => startCheckout("studio")}>
                400 credits
              </button>
            </div>
          </div>
        </details>

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
          <summary>Saved artifacts</summary>
          <div className="saved-artifact-log">
            {savedArtifacts.length === 0 ? (
              <p>No Supabase artifacts saved yet.</p>
            ) : (
              savedArtifacts.map((artifact) => (
                <div className="saved-artifact-output" key={artifact.id}>
                  <strong>{artifact.title}</strong>
                  <code>{artifact.artifact_type} | {artifact.status}</code>
                  {artifact.summary && <p>{artifact.summary}</p>}
                  <small>{new Date(artifact.created_at).toLocaleString()}</small>
                </div>
              ))
            )}
          </div>
        </details>

        <details className="node-card">
          <summary>Workspace history</summary>
          <div className="history-log">
            {workspaceRuns.length === 0 ? (
              <p>No saved local runs yet.</p>
            ) : (
              workspaceRuns.map((run) => (
                <button
                  className="history-output"
                  key={run.id}
                  type="button"
                  onClick={() => {
                    setMessages([
                      { id: createId(), kind: "user", text: run.prompt },
                      { id: createId(), kind: "magi", text: run.finalAnswer },
                    ]);
                  }}
                >
                  <strong>{run.taskLabel}</strong>
                  <span>{run.artifactType}</span>
                  <small>{new Date(run.createdAt).toLocaleString()}</small>
                </button>
              ))
            )}
          </div>
        </details>

        <details className="node-card">
          <summary>Providers</summary>
          <div className="provider-log">
            <p>{mockMode ? "Mock mode is on. Live providers will not be used." : "Live provider routing is enabled."}</p>
            {providers.map((provider) => (
              <div className="provider-output" key={provider.provider}>
                <strong>{provider.provider}</strong>
                <span className={provider.configured ? "mcp-ok" : "mcp-fail"}>
                  {provider.configured ? `${provider.keyCount} key(s)` : "Not configured"}
                </span>
              </div>
            ))}
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
          <summary>How MAGI decides</summary>
          <p>
            Complex requests pass through four perspectives that build on each other:
            the Architect drafts it by the book, the Maverick adds the non-obvious angle,
            the Adversary attacks and hardens it, and the Synthesis forges one final
            deliverable. Simple requests answer directly.
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
