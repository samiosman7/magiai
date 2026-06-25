"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function Access() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    const res = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      window.location.href = "/console";
    } else {
      setStatus("error");
    }
  }

  return (
    <main className="lp">
      <nav className="lp-nav">
        <Link href="/" className="lp-mark">MAGI</Link>
        <span className="lp-tag">Private beta</span>
      </nav>
      <header className="lp-hero">
        <p className="lp-eyebrow">Beta access</p>
        <h1>Enter your access code.</h1>
        <p className="lp-sub">
          MAGI is in private beta. Enter the code from your invite to continue.
        </p>
        <form className="lp-form" onSubmit={submit}>
          <input
            type="text"
            required
            placeholder="Access code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-label="Access code"
            disabled={status === "loading"}
          />
          <button type="submit" disabled={status === "loading"}>
            {status === "loading" ? "Checking…" : "Enter"}
          </button>
        </form>
        {status === "error" && <p className="lp-error">Invalid code. Check your invite or join the waitlist.</p>}
        <p className="lp-micro">
          No code yet? <Link href="/" style={{ color: "var(--blue)" }}>Join the waitlist</Link>.
        </p>
      </header>
    </main>
  );
}
