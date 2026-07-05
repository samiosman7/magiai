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
    <main className="lp gate-page">
      <nav className="lp-nav">
        <Link href="/" className="lp-lockup">
          <span className="lp-mark-box" aria-hidden="true">MAGI</span>
          <span className="lp-mark-sub">Decision system</span>
        </Link>
        <span className="lp-tag">Private beta</span>
      </nav>

      <div className="gate-wrap">
        <div className="gate">
          <p className="gate-kicker">Security gate · clearance required</p>
          <h1>Enter your access code.</h1>
          <p className="gate-sub">
            MAGI is in private beta. Enter the code from your invite to open the console.
          </p>
          <form className="gate-form" onSubmit={submit}>
            <input
              type="text"
              required
              placeholder="ACCESS CODE"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Access code"
              autoComplete="off"
              spellCheck={false}
              disabled={status === "loading"}
            />
            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Verifying…" : "Authenticate"}
            </button>
          </form>
          {status === "error" && (
            <p className="gate-error">Code rejected. Check your invite or join the waitlist.</p>
          )}
          <p className="gate-micro">
            No code yet? <Link href="/">Join the waitlist</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
