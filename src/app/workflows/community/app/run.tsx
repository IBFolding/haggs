"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { asSavedApp, getApp } from "../../../../community/community";
import { dbOf } from "../../../../community/supabase-db";
import { Nav } from "../../../nav";
import { supabase, useSession } from "../../../session";
import { WorkflowApp } from "../../[name]/workflow-app";

/** A published Community app opened as the same simple app as every other workflow, run through the same runner. */
export function CommunityRun() {
  const id = useSearchParams().get("id") ?? "";
  const { session, ready } = useSession();
  const sb = supabase();
  const [state, setState] = useState<"loading" | "missing" | "error" | ReturnType<typeof asSavedApp>>("loading");
  useEffect(() => {
    if (!sb) return setState("missing");
    void getApp(dbOf(sb), id).then((a) => setState(a ? asSavedApp(a) : "missing")).catch(() => setState("error"));
  }, [sb, id]);
  const saved = useMemo(() => (typeof state === "object" ? state : null), [state]);
  if (saved) return <WorkflowApp name={saved.name} file={saved.workflow} saved={saved} />;
  return (
    <div className="app"><Nav current="Workflows" /><div className="canvas"><div className="wf">
      <p><Link className="plain" href="/workflows/community">← Community</Link></p>
      {state === "loading" ? <p className="wf-note" role="status">Opening the app…</p>
        : state === "error" ? <p className="library-error" role="alert">The community shelf couldn&rsquo;t be loaded. Try again in a moment.</p>
        : <p className="wf-note">{!sb ? "Community apps need an account, and this copy of haggs isn’t connected to one." : ready && !session ? <><Link href="/signin">Sign in</Link> to open community apps.</> : "That app isn’t on the shelf."}</p>}
    </div></div></div>
  );
}
