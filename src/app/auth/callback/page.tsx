"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { safeReturn } from "../../../story/handoff";
import { supabase } from "../../session";

/** Where Google and email links come back to. The sign-in code is exchanged here, then you carry on. */
export default function Callback() {
  const router = useRouter();
  const [problem, setProblem] = useState<string | null>(null);
  // A sign-in code works once; the effect must not run it twice.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const next = safeReturn(params.get("next")) ?? "/library";
    const code = params.get("code");
    const sb = supabase();
    if (!sb) return setProblem("Accounts aren't set up on this copy of haggs.");
    if (params.get("error_description")) return setProblem(params.get("error_description"));
    if (!code) {
      router.replace(next);
      return;
    }
    void sb.auth.exchangeCodeForSession(code).then(({ error }) => (error ? setProblem(error.message) : router.replace(next)));
  }, [router]);
  return (
    <div className="app">
      <div className="canvas">
        <div className="au">
          <h1>{problem ? "That sign-in didn't work." : "Signing you in…"}</h1>
          {problem && <p className="library-error">{problem} Try again from the sign-in page.</p>}
        </div>
      </div>
    </div>
  );
}
