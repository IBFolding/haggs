"use client";

import Link from "next/link";
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
      void sb.auth.getSession().then(({data,error})=>{
        if(error||!data.session)setProblem('No active sign-in was received. Start again from the sign-in page.');
        else router.replace(next);
      }).catch(()=>setProblem('Sign-in could not be checked. Try again.'));
      return;
    }
    void sb.auth.exchangeCodeForSession(code).then(({ error }) => (error ? setProblem(error.message) : router.replace(next))).catch(()=>setProblem("The sign-in service could not be reached. Try again."));
  }, [router]);
  return (
    <div className="app">
      <div className="canvas">
        <div className="au">
          <h1>{problem ? "That sign-in didn't work." : "Signing you in…"}</h1>
          {problem && <><p className="library-error">{problem}</p><Link href="/signin">Return to sign in</Link></>}
        </div>
      </div>
    </div>
  );
}
