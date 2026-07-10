"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaces in the browser console; server errors are logged server-side.
    console.error("MAGI UI error:", error);
  }, [error]);

  return (
    <main className="lp gate-page">
      <nav className="lp-nav">
        <Link href="/" className="lp-lockup">
          <span className="lp-mark-box" aria-hidden="true">MAGI</span>
          <span className="lp-mark-sub">Decision system</span>
        </Link>
        <span className="lp-tag">Fault</span>
      </nav>
      <div className="gate-wrap">
        <div className="gate">
          <p className="gate-kicker">System fault</p>
          <h1>Something broke on our end.</h1>
          <p className="gate-sub">
            The console hit an unexpected error. You haven&rsquo;t been charged for anything in progress.
          </p>
          <div className="gate-form">
            <button type="button" onClick={reset}>
              Try again
            </button>
          </div>
          <p className="gate-micro">
            Still stuck? <Link href="/">Reload MAGI</Link>.
            {error.digest ? <span> · ref {error.digest}</span> : null}
          </p>
        </div>
      </div>
    </main>
  );
}
