"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const ANGLES = [
  { n: "01", name: "Architect", desc: "Builds the rigorous draft from real, current sources — not the model's memory." },
  { n: "02", name: "Maverick", desc: "Finds the angle and the insight a generic answer would miss." },
  { n: "03", name: "Adversary", desc: "Attacks every claim against the sources and cuts anything that doesn't hold up." },
  { n: "04", name: "Synthesis", desc: "Forges one clean, cited report you can put your name on." },
];

const PROOF = [
  { h: "Grounded, not guessed", p: "MAGI researches live sources and your own documents, then answers from them — so it's current and specific to you." },
  { h: "Verified against the truth", p: "Every claim is checked against the sources it found, not the model's memory. Unsupported claims get cut before you ever see them." },
  { h: "A finished deliverable", p: "You get a cited, defensible report — not a chat bubble to copy-paste and reformat at midnight." },
];

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading" || status === "done") return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "landing" }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (res.ok && data?.ok) {
        setStatus("done");
      } else {
        setStatus("error");
        setMessage(data?.error || "Something went wrong. Try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
  }

  return (
    <main className="lp">
      <nav className="lp-nav">
        <span className="lp-mark">MAGI</span>
        <span className="lp-tag">Private beta</span>
      </nav>

      <header className="lp-hero">
        <p className="lp-eyebrow">The AI that fact-checks itself</p>
        <h1>Answers you can actually defend.</h1>
        <p className="lp-sub">
          MAGI researches real sources, red-teams its own answer against them, and hands you a
          cited report — built for the work where being wrong is expensive.
        </p>

        {status === "done" ? (
          <div className="lp-success" role="status">
            <strong>You&rsquo;re on the list.</strong>
            <span>We&rsquo;ll email you the moment your access opens.</span>
          </div>
        ) : (
          <form className="lp-form" onSubmit={submit}>
            <input
              type="email"
              required
              placeholder="you@work.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
              disabled={status === "loading"}
            />
            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Joining…" : "Request access"}
            </button>
          </form>
        )}
        {status === "error" && <p className="lp-error">{message}</p>}
        {status !== "done" && <p className="lp-micro">Join the waitlist. No spam, no noise.</p>}
      </header>

      <section className="lp-section">
        <h2>One prompt. Four minds. One report you can trust.</h2>
        <div className="lp-angles">
          {ANGLES.map((a) => (
            <div className="lp-angle" key={a.name}>
              <span className="lp-angle-n">{a.n}</span>
              <strong>{a.name}</strong>
              <p>{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2>Why not just use ChatGPT?</h2>
        <div className="lp-proof">
          {PROOF.map((p) => (
            <div className="lp-proof-card" key={p.h}>
              <strong>{p.h}</strong>
              <p>{p.p}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-cta">
        <h2>Get early access.</h2>
        <p>We&rsquo;re onboarding the first users now.</p>
        {status === "done" ? (
          <div className="lp-success" role="status">
            <strong>You&rsquo;re on the list.</strong>
            <span>Check your inbox soon.</span>
          </div>
        ) : (
          <form className="lp-form" onSubmit={submit}>
            <input
              type="email"
              required
              placeholder="you@work.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email address"
              disabled={status === "loading"}
            />
            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Joining…" : "Request access"}
            </button>
          </form>
        )}
      </section>

      <footer className="lp-footer">
        <span className="lp-mark">MAGI</span>
        <span className="lp-footer-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </span>
        <span>The Magi has decided.</span>
      </footer>
    </main>
  );
}
