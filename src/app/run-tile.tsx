"use client";

import { useState } from "react";

import type { Run } from "../story/runs";
import { creditsText } from "../story/price-text";

/**
 * One finished run.
 *
 * The cost sits on the face of every tile rather than behind a hover, because
 * what a picture cost is the one fact this studio has that the hosted ones
 * withhold. Hiding it to keep the grid tidy would be giving that away for
 * neatness.
 */
export function RunTile({
  run,
  onFavorite,
  onReuse,
  onDelete,
  onSave,
  onStart,
  onAnimate,
  onEdit,
}: {
  run: Run;
  onSave?: () => void;
  onStart?: () => void;
  onAnimate?: () => void;
  onEdit?: () => void;
  onFavorite?: () => void;
  onReuse?: () => void;
  onDelete?: () => void;
}) {
  /* A link that has expired shows as a labelled gap, not an empty tile. */
  const [lost, setLost] = useState(false);
  const gone = () => setLost(true);
  return (
    <figure className="cell run-tile">
      {/* A run made on another computer whose file hasn't reached your account yet has nothing to play here. */}
      {run.kind === "audio" ? (
        <div className="cell-sound">
          <span className="cell-wave" aria-hidden="true">♪</span>
          <audio src={run.url} onError={gone} controls preload="none" />
        </div>
      ) : run.kind === "video" ? (
        <video src={run.url} onError={gone} loop playsInline controls preload="metadata" />
      ) : (
        <img src={run.url} alt={run.prompt} loading="lazy" onError={gone} />
      )}

      {lost && <span className="cell-lost">This {run.kind === "video" ? "clip" : run.kind === "audio" ? "sound" : "picture"} has expired. The prompt is kept.</span>}

      <figcaption className="cell-face">
        <div className="run-tile-meta">
      <span className="cell-cost">{run.usd === null ? "—" : `${creditsText(run.usd)}`}</span>

      {onFavorite && (
        <button
          className={`cell-keep${run.favorite ? " on" : ""}`}
          onClick={onFavorite}
          aria-pressed={run.favorite === true}
          title={run.favorite ? "Stop keeping this" : "Keep this"}
        >
          {run.favorite ? "★" : "☆"}
        </button>
      )}

        </div>
        <span className="cell-prompt">{run.prompt}</span>
        <span className="cell-foot">
          <span className="cell-model">{run.modelName}</span>
          {onAnimate && run.kind === "image" && (
            <button className="plain" onClick={onAnimate} title="Open Video with this as the first frame">
              Animate
            </button>
          )}
          {onEdit && run.kind === "image" && (
            <button className="plain" onClick={onEdit} title="Open Edit a photo with this picture">
              Edit
            </button>
          )}
          {onStart && (
            <button className="plain" onClick={onStart} title="Start a new project with this as its first shot">
              Start a project
            </button>
          )}
          {onSave && (
            <button className="plain cell-save" onClick={onSave}>
              Save to project
            </button>
          )}
          {onReuse && (
            <button className="plain" onClick={onReuse}>
              Reuse
            </button>
          )}
          {onDelete && (
            <button className="plain danger" onClick={onDelete}>
              Delete
            </button>
          )}
        </span>
      </figcaption>
    </figure>
  );
}
