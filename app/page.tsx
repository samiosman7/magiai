"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { plans } from "@/lib/billing/plans";

const NODES = [
  {
    code: "MELCHIOR·01",
    name: "Architect",
    desc: "Reads your request, pulls live sources, and drafts the blueprint — the exact sections, requirements, and constraints the answer must satisfy.",
  },
  {
    code: "BALTHASAR·02",
    name: "Maverick",
    desc: "Builds the full deliverable from the blueprint — and adds the sharper framing a generic answer would miss.",
  },
  {
    code: "CASPER·03",
    name: "Adversary",
    desc: "Attacks the draft like a skeptical investor. Every claim is checked against the sources; anything unsupported gets flagged.",
  },
  {
    code: "SYNTHESIS",
    name: "Judge",
    desc: "Resolves every valid objection and forges one clean, cited report you can put your name on.",
  },
];

const DEMO_LINES = [
  { t: "cmd", text: 'magi run "Competitive analysis: top 3 meal-kit companies"' },
  { t: "log", label: "TASK ROUTED", text: "analysis · grounded · 5 live sources pulled" },
  { t: "log", label: "MELCHIOR·01", text: "blueprint drafted — 6 sections, 14 requirements" },
  { t: "log", label: "BALTHASAR·02", text: "deliverable built — differentiator added" },
  { t: "warn", label: "CASPER·03", text: "critique: 3 unsupported claims flagged" },
  { t: "log", label: "SYNTHESIS", text: "claims fixed · citations verified [1]–[5]" },
  { t: "done", label: "VERDICT", text: "The Magi has decided — delivered in 41s · $0.007" },
];

const VS = {
  chatbot: {
    title: "A chatbot",
    points: [
      "Answers from the model's memory — often months stale",
      "Sounds equally confident whether it's right or wrong",
      "No one checks the answer before you see it",
      "Hands you a chat bubble to reformat at midnight",
    ],
  },
  magi: {
    title: "MAGI",
    points: [
      "Researches live sources and cites them inline",
      "Red-teams its own answer against those sources",
      "Unsupported claims are cut before you ever see them",
      "Delivers a finished, exportable document — with its exact cost",
    ],
  },
};

const TIERS = [
  {
    plan: plans.free,
    tagline: "Kick the tires on real, verified answers.",
    features: [
      `${plans.free.monthlyCredits} credits every month`,
      "Economy + Standard routing",
      `Up to ${plans.free.dailyRuns} runs per day`,
      "Cited sources on every research answer",
    ],
    featured: false,
  },
  {
    plan: plans.pro,
    tagline: "For people who put their name on the output.",
    features: [
      `${plans.pro.monthlyCredits} credits every month`,
      "Premium frontier routing (GPT-5.5 · Gemini 3.1 · Sonnet 4.6)",
      `Up to ${plans.pro.dailyRuns} runs per day`,
      "Exportable deliverables + full run history",
    ],
    featured: true,
  },
  {
    plan: plans.studio,
    tagline: "Heavy, daily, team-grade usage.",
    features: [
      `${plans.studio.monthlyCredits} credits every month`,
      "Everything in Pro",
      `Up to ${plans.studio.dailyRuns} runs per day`,
      "Priority capacity during peak load",
    ],
    featured: false,
  },
];

const FAQ = [
  {
    q: "What is MAGI?",
    a: "MAGI is a self-verifying AI work engine. One prompt runs through four adversarial nodes — research, build, attack, synthesize — and returns a single cited deliverable instead of a chat reply.",
  },
  {
    q: "How is it different from ChatGPT or Claude?",
    a: "A single model answers once, from memory, with no one checking it. MAGI grounds the answer in live sources, then a dedicated adversary node attacks every claim against those sources before the final verdict is forged. You see citations, not vibes.",
  },
  {
    q: "Can I upload documents — contracts, PDFs, reports?",
    a: "Yes. Attach PDFs, Word docs, spreadsheets, text files, or even photos of documents, and MAGI reads them (scanned images are OCR'd) before answering. Upload a contract and it runs a clause-by-clause legal review — parties, obligations, deadlines, liability, and risky or missing terms — quoting the document and flagging what matters. It's informational, not legal advice.",
  },
  {
    q: "What does it cost?",
    a: "Free gets you 10 credits a month. Pro is $15/mo for 200 credits and premium frontier routing; Studio is $40/mo for 600. A Standard run costs 1 credit, Premium 3 — and every run shows its exact model cost. During the invited beta, runs are free.",
  },
  {
    q: "When do I get access?",
    a: "We onboard the waitlist in small waves so every operator gets real capacity. Join now and you'll receive an access code by email when your wave opens.",
  },
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

  const form =
    status === "done" ? (
      <div className="lp-success" role="status">
        <span className="lp-success-code">ACCESS REQUEST LOGGED</span>
        <strong>You&rsquo;re on the list.</strong>
        <span>We&rsquo;ll email your access code the moment your wave opens.</span>
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
          {status === "loading" ? "Transmitting…" : "Request access"}
        </button>
      </form>
    );

  return (
    <main className="lp">
      <nav className="lp-nav">
        <span className="lp-lockup">
          <span className="lp-mark-box" aria-hidden="true">MAGI</span>
          <span className="lp-mark-sub">Decision system</span>
        </span>
        <span className="lp-nav-right">
          <span className="lp-tag">Private beta</span>
          <Link className="lp-nav-link" href="/access">
            Have a code? →
          </Link>
        </span>
      </nav>

      <header className="lp-hero" id="top">
        <p className="lp-eyebrow">Self-verifying AI · four nodes · one verdict</p>
        <h1>
          Answers you can <em>actually defend.</em>
        </h1>
        <p className="lp-sub">
          MAGI runs your request through four adversarial AI nodes — it researches real sources,
          builds the deliverable, red-teams its own work, and hands you one cited report.
          Built for the work where being wrong is expensive.
        </p>

        {form}
        {status === "error" && <p className="lp-error">{message}</p>}
        {status !== "done" && (
          <p className="lp-micro">Onboarding in small waves. No spam — one email when your access opens.</p>
        )}

        <div className="lp-demo" aria-label="Example MAGI run">
          <div className="lp-demo-bar">
            <span className="lp-demo-dot" />
            <span className="lp-demo-dot" />
            <span className="lp-demo-dot" />
            <span className="lp-demo-title">magi://console — run 0x2A7F</span>
            <span className="lp-demo-live">● LIVE</span>
          </div>
          <div className="lp-demo-body">
            {DEMO_LINES.map((line, i) => (
              <p
                className={`lp-demo-line ${line.t}`}
                style={{ animationDelay: `${0.35 + i * 0.55}s` }}
                key={i}
              >
                {line.t === "cmd" ? (
                  <>
                    <span className="lp-demo-prompt">$</span> {line.text}
                  </>
                ) : (
                  <>
                    <span className="lp-demo-label">{line.label}</span>
                    {line.text}
                  </>
                )}
              </p>
            ))}
            <p className="lp-demo-caret" style={{ animationDelay: `${0.35 + DEMO_LINES.length * 0.55}s` }}>
              <span />
            </p>
          </div>
        </div>
      </header>

      <section className="lp-section" id="system">
        <p className="lp-section-kicker">The system</p>
        <h2>One prompt. Four minds. One verdict.</h2>
        <p className="lp-section-sub">
          Every complex request passes through four specialist nodes that build on — and attack — each other.
        </p>
        <div className="lp-nodes">
          {NODES.map((node, i) => (
            <div className="lp-node" key={node.code}>
              <div className="lp-node-head">
                <span className="lp-node-code">{node.code}</span>
                <span className="lp-node-index">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <strong>{node.name}</strong>
              <p>{node.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <p className="lp-section-kicker">The difference</p>
        <h2>Why not just use ChatGPT?</h2>
        <div className="lp-vs">
          <div className="lp-vs-col">
            <span className="lp-vs-title">{VS.chatbot.title}</span>
            <ul>
              {VS.chatbot.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="lp-vs-col magi">
            <span className="lp-vs-title">{VS.magi.title}</span>
            <ul>
              {VS.magi.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="lp-section" id="pricing">
        <p className="lp-section-kicker">Plans</p>
        <h2>Pay for verdicts, not tokens.</h2>
        <p className="lp-section-sub">
          One credit ≈ one full four-node run. Every run shows its exact cost. Beta users run free.
        </p>
        <div className="lp-pricing">
          {TIERS.map(({ plan, tagline, features, featured }) => (
            <div className={`lp-price-card ${featured ? "featured" : ""}`} key={plan.id}>
              {featured && <span className="lp-price-flag">Most popular</span>}
              <span className="lp-price-name">{plan.name}</span>
              <div className="lp-price-amount">
                {plan.priceUsd > 0 ? (
                  <>
                    <strong>${plan.priceUsd}</strong>
                    <span>/month</span>
                  </>
                ) : (
                  <strong>$0</strong>
                )}
              </div>
              <p className="lp-price-tagline">{tagline}</p>
              <ul>
                {features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <a className="lp-price-cta" href="#top">
                Join the waitlist
              </a>
            </div>
          ))}
        </div>
        <p className="lp-pricing-note">
          Billing activates at public launch — beta invitees keep free runs until then.
        </p>
      </section>

      <section className="lp-section">
        <p className="lp-section-kicker">Questions</p>
        <h2>Before you ask.</h2>
        <div className="lp-faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-cta">
        <p className="lp-eyebrow">Access request</p>
        <h2>Get your access code.</h2>
        <p>We&rsquo;re onboarding the first operators now. Early waves get free runs and a direct line to the builder.</p>
        {form}
        {status === "error" && <p className="lp-error">{message}</p>}
      </section>

      <footer className="lp-footer">
        <span className="lp-mark-box small" aria-hidden="true">MAGI</span>
        <span className="lp-footer-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/access">Beta access</Link>
        </span>
        <span className="lp-footer-tag">The Magi has decided.</span>
      </footer>
    </main>
  );
}
