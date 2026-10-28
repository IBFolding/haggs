import type { Metadata } from "next";
import Link from "next/link";

import { MODELS, type ModelCard } from "../../catalog/models";
import { LearnShell } from "../learn-shell";

export const metadata: Metadata = { title: "Models — haggs", description: "The models haggs runs, and what each one is for." };

const ROOMS: { capability: ModelCard["capability"]; title: string; says: string; href: string }[] = [
  { capability: "text-to-image", title: "Pictures", says: "Stills, character sheets, key art and the first frame of every shot.", href: "/photos" },
  { capability: "image-edit", title: "Fixing a picture", says: "Change one thing and keep the rest.", href: "/edit" },
  { capability: "text-to-video", title: "Clips from words", says: "A shot from a description.", href: "/video" },
  { capability: "image-to-video", title: "Clips from a picture", says: "Animate a still you already like.", href: "/video" },
];

const BADGE: Record<NonNullable<ModelCard["badge"]>, string> = { new: "New", premium: "Best", fast: "Fast" };

/** Every model the composer offers, from the catalogue itself, grouped by the job it does. */
export default function Models() {
  return (
    <LearnShell current="/models">
      <div className="models-page">
        <span className="eyebrow">The models</span>
        <h1>The models, and what each one is for.</h1>
        <p>Everything runs on Comfy. Pick the model for the job; the price is on the Generate button before you press it. For runs that never touch a partner model, use an open-weights app in <Link href="/workflows">Workflows</Link>.</p>
        {ROOMS.map((room) => {
          const cards = MODELS.filter((m) => m.capability === room.capability);
          if (!cards.length) return null;
          return (
            <section key={room.capability} className="models-room">
              <header>
                <h2>{room.title}</h2>
                <span>{room.says}</span>
                <Link href={room.href}>Open →</Link>
              </header>
              <ul>
                {cards.map((m) => (
                  <li key={m.id}>
                    <b>{m.name}{m.badge && <i>{BADGE[m.badge]}</i>}</b>
                    <span>{m.blurb}</span>
                    <small>{m.inputImages > 0 ? `Takes up to ${m.inputImages} picture${m.inputImages === 1 ? "" : "s"}` : "From words"} · {m.provider === "fal" ? "fal" : "Comfy"}</small>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </LearnShell>
  );
}
