import { MODELS } from "../catalog/models";

/** The models haggs runs, scrolling under the hero. The open-weights ones are the models behind the apps that run without any partner model. */
const OPEN = ["Wan 2.2", "Qwen Image Edit", "Z-Image Turbo", "LivePortrait"];

export function ModelTicker() {
  const names = [...new Set(MODELS.map((m) => m.name))];
  const row = [...names.map((n) => ({ n, open: false })), ...OPEN.map((n) => ({ n, open: true }))];
  return (
    <div className="lp-ticker" aria-label={`Models: ${row.map((r) => r.n).join(", ")}`}>
      <div className="lp-ticker-row" aria-hidden>
        {[...row, ...row].map((r, i) => (
          <span key={i}>{r.n}{r.open && <i>Open</i>}</span>
        ))}
      </div>
    </div>
  );
}
