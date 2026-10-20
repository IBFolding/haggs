"use client";

import { useState } from "react";

import { clearClaudeKey, clearComfyKey, clearKey, saveClaudeKey, saveComfyKey, saveKey } from "./actions";

/**
 * Both provider keys in one place. Comfy Router is the platform this app is
 * built on, so it comes first; fal stays as a second route for the models it
 * hosts directly.
 *
 * Keys are posted once and kept in an httpOnly cookie. They never reach client
 * JavaScript, and this component only ever learns whether one is held.
 */

type Row = {
  id: "comfy" | "fal" | "claude";
  name: string;
  blurb: string;
  href: string;
  place: string;
  held: boolean;
  save: (key: string) => Promise<void>;
  clear: () => Promise<void>;
};

export function KeySheet({
  held,
  onChange,
  onClose,
}: {
  held: { comfy: boolean; fal: boolean; claude: boolean };
  onChange: (next: { comfy: boolean; fal: boolean; claude: boolean }) => void;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState({ comfy: "", fal: "", claude: "" });
  const [busy, setBusy] = useState<string | null>(null);

  const rows: Row[] = [
    {
      id: "comfy",
      name: "Comfy",
      blurb: "Runs MiniMax H3, FLUX 3 and LTX through Comfy Router. Pay per use from your own workspace credits.",
      href: "https://platform.comfy.org",
      place: "comfyui-…",
      held: held.comfy,
      save: saveComfyKey,
      clear: clearComfyKey,
    },
    {
      id: "fal",
      name: "fal",
      blurb: "Runs Nano Banana, FLUX 2, Kling, Veo and Seedance directly on your fal account.",
      href: "https://fal.ai/dashboard/keys",
      place: "fal key",
      held: held.fal,
      save: saveKey,
      clear: clearKey,
    },
    {
      id: "claude",
      name: "Claude",
      blurb: "The writer: drafts scripts from your idea and fills the sheets, on your own Anthropic account.",
      href: "https://console.anthropic.com/settings/keys",
      place: "sk-ant-…",
      held: held.claude,
      save: saveClaudeKey,
      clear: clearClaudeKey,
    },
  ];

  return (
    <div className="veil" onClick={onClose}>
      <div className="sheet wide" onClick={(event) => event.stopPropagation()}>
        <h3>Connect your keys</h3>
        <p>
          You pay the provider directly, at their rate — there is no subscription here.
          A key is posted once and kept in an httpOnly cookie.
        </p>

        {rows.map((row) => (
          <section key={row.id} className="key-row">
            <header>
              <b>{row.name}</b>
              <span className={`lamp${row.held ? " live" : ""}`} />
              <span className="key-status">{row.held ? "connected" : "not connected"}</span>
            </header>
            <p className="key-blurb">
              {row.blurb}{" "}
              <a href={row.href} target="_blank" rel="noreferrer">
                Get a key
              </a>
            </p>

            <div className="sheet-row">
              <input
                type="password"
                value={drafts[row.id]}
                onChange={(event) => setDrafts((d) => ({ ...d, [row.id]: event.target.value }))}
                placeholder={row.held ? "Replace the key" : row.place}
                autoComplete="off"
              />
              <button
                className="fire"
                disabled={!drafts[row.id].trim() || busy === row.id}
                onClick={async () => {
                  setBusy(row.id);
                  await row.save(drafts[row.id]);
                  setDrafts((d) => ({ ...d, [row.id]: "" }));
                  onChange({ ...held, [row.id]: true });
                  setBusy(null);
                }}
              >
                Save
              </button>
              {row.held && (
                <button
                  className="plain"
                  onClick={async () => {
                    await row.clear();
                    onChange({ ...held, [row.id]: false });
                  }}
                >
                  Disconnect
                </button>
              )}
            </div>
          </section>
        ))}

        <div className="sheet-row">
          <button className="plain" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="sheet-note">
          Browsing works without a key. Fal models show their published rate up front;
          Comfy models are quoted by Router at run time.
        </div>
      </div>
    </div>
  );
}
