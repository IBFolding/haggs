"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { createAppStore, type SavedApp } from "../../../story/apps";
import { defaultKv } from "../../../story/kv";
import { Nav } from "../../nav";
import { BuildWorkflow } from "../build";
import { WorkflowApp } from "./workflow-app";

/** One of your saved apps; one built from steps can go back to its steps. */
export function MyApp() {
  const id = useSearchParams().get("id") ?? "";
  const apps = useMemo(() => createAppStore(defaultKv()), []);
  const [app, setApp] = useState<SavedApp | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    void apps.load(id).then((a) => setApp(a ?? null));
  }, [apps, id]);
  if (app === undefined) return <div className="app"><Nav current="Workflows" /></div>;
  if (!app) return <div className="app"><Nav current="Workflows" /><div className="canvas"><div className="wf"><p className="wf-note">That app isn&rsquo;t in this browser. Apps are kept where they were saved; open its app file to add it here.</p></div></div></div>;
  if (editing && app.recipe) return <BuildWorkflow start={app.recipe} />;
  return <WorkflowApp name={app.name} file={app.workflow} saved={app} {...(app.recipe ? { recipe: app.recipe, onBack: () => setEditing(true) } : {})} />;
}
