import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LESSONS } from "../../../../academy/lessons";
import { LessonPlayer } from "../../lesson-player";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ id: l.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = (await params).id;
  const lesson = LESSONS.find((l) => l.id === id);
  return { title: lesson ? `${lesson.title} — haggs Academy` : "Lesson — haggs Academy" };
}

export default async function Learn({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const i = LESSONS.findIndex((l) => l.id === id);
  if (i < 0) notFound();
  return <LessonPlayer index={i} />;
}
