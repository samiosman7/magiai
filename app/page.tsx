"use client";

import { FormEvent, useMemo, useRef, useState } from "react";

type PipelineStep = "scan" | "melchior" | "balthasar" | "casper" | "judge" | "final";
type StepState = "" | "active" | "done";

type Message = {
  id: string;
  kind: "user" | "magi" | "status";
  text: string;
};

type NodeOutput = {
  name: string;
  text: string;
};

type MagiEvent =
  | { type: "status"; step: PipelineStep; message: string }
  | { type: "node"; name: string; text: string }
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [steps, setSteps] = useState<Record<PipelineStep, StepState>>(initialSteps);
  const [nodeOutputs, setNodeOutputs] = useState<NodeOutput[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const hasMessages = messages.length > 0;

  const modeLabel = useMemo(() => {
    if (mode === "economy") return "Economy MAGI";
    if (mode === "premium") return "Premium MAGI";
    return "Standard MAGI";
  }, [mode]);

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

    try {
      const response = await fetch("/api/magi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, mode }),
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

    if (event.type === "step") {
      setSteps((current) => ({ ...current, [event.step]: event.state }));
      return;
    }

    if (event.type === "final") {
      setMessages((current) => [
        ...current,
        { id: createId(), kind: "magi", text: event.answer },
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
    setIsRunning(false);
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
                Choose a MAGI mode, enter a directive, and the server will route the
                request through the orchestration pipeline. Local demos run in mock
                mode until provider keys are added.
              </p>
            </div>
          )}

          <div className="messages">
            {messages.map((message) => (
              <article className={`message ${message.kind}`} key={message.id}>
                {message.text}
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
