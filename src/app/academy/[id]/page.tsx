import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LESSONS } from "../../../academy/lessons";
import { Nav } from "../../nav";
import { PrintButton } from "./print-button";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = (await params).id;
  const lesson = LESSONS.find((l) => l.id === id);
  return { title: lesson ? `${lesson.title}: lesson guide — haggs` : "Lesson guide — haggs" };
}

/** One lesson as a printable guide: save it as a PDF from the browser's print dialog. */
export default async function Guide({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const i = LESSONS.findIndex((l) => l.id === id);
  const lesson = LESSONS[i];
  if (!lesson) notFound();
  return (
    <div className="app">
      <Nav current="Academy" />
      <div className="canvas">
        <article className="academy guide">
          <p className="wf-small"><Link href="/academy">← All lessons</Link></p>
          <small>Lesson {i + 1} of {LESSONS.length} · {lesson.minutes} min</small>
          <h1>{lesson.title}</h1>
          <p className="guide-goal">{lesson.goal}</p>
          <h2>Do this</h2>
          <ol>{lesson.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          <h2>Tip</h2>
          <p>{lesson.tip}</p>
          <h2>Homework</h2>
          <p>{lesson.homework}</p>
          <p className="guide-check">☐ I made it</p>
          <div className="sheet-row guide-actions">
            <Link className="fire" href={lesson.doIt.href}>{lesson.doIt.label}</Link>
            <PrintButton />
          </div>
        </article>
      </div>
    </div>
  );
}
