"use client";

import { useEffect, useState } from "react";

import { megabytes, totalBytes, type Item } from "../server/library";
import { deleteFiles, myFiles } from "./files-actions";

/** What a signed-in person has in the file store, with a way to free space. Files are removed after 60 days. */
export function FilesPanel() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const load = () => void myFiles().then((r) => (r.ok ? (setItems(r.hosted ? r.items : null), setProblem(null)) : setProblem(r.reason)));
  useEffect(load, []);
  if (items === null && !problem) return null;
  const kind = (p: string) => (/\.(mp4|webm|mov)$/i.test(p) ? "Video" : /\.(mp3|wav|m4a|aac|flac)$/i.test(p) ? "Sound" : "Picture");
  return (
    <section className="fp">
      <h2>Your files</h2>
      {problem && <p className="library-error" role="alert">{problem}</p>}
      {items && (
        <>
          <p className="wf-small">{items.length} file{items.length === 1 ? "" : "s"}, {megabytes(totalBytes(items))} MB. Files are removed 60 days after they are made. Download what you want to keep.</p>
          {items.length > 0 && (
            <ul className="fp-list">
              {items.slice(0, 60).map((i) => (
                <li key={i.url}>
                  <label><input type="checkbox" checked={picked.includes(i.url)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, i.url] : p.filter((x) => x !== i.url)))} />
                    <a href={i.url} target="_blank" rel="noreferrer">{kind(i.pathname)} · {new Date(i.uploadedAt).toLocaleDateString()}</a>
                    <small>{megabytes(i.size)} MB</small>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <button className="plain danger" disabled={!picked.length || busy} onClick={() => { setBusy(true); void deleteFiles(picked).then((r) => { setBusy(false); setPicked([]); if (!r.ok) setProblem(r.reason); load(); }); }}>Delete {picked.length || ""} selected</button>
        </>
      )}
    </section>
  );
}
