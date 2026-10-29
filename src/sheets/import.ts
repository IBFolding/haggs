/**
 * Turns the script files writers actually have into the plain text the screenplay parser reads. Final Draft (.fdx) is
 * XML with one paragraph per block; a PDF is laid-out text, so its lines, indents and blank lines are rebuilt from
 * where each run of text sits on the page. Either way the result goes through `parseScreenplay`, like a typed script.
 */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? whole),
  );

const pad = (n: number) => " ".repeat(n);

/** A Final Draft script as screenplay text. The title page is skipped; dual dialogue is read one speaker after the other. */
export function fdxToText(xml: string): string {
  if (!/<FinalDraft\b/i.test(xml)) throw new Error("That .fdx file isn't a Final Draft script.");
  const body = (/<Content\b[^>]*>([\s\S]*?)<\/Content>/i.exec(xml)?.[1] ?? "")
    .replace(/<Paragraph\b[^>]*>\s*<DualDialogue\b[^>]*>/gi, "")
    .replace(/<\/DualDialogue>\s*<\/Paragraph>/gi, "");
  const out: string[] = [];
  for (const [, attrs, inner] of body.matchAll(/<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/gi)) {
    const type = /\bType="([^"]*)"/i.exec(attrs!)?.[1] ?? "Action";
    const text = decode([...inner!.matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/gi)].map((t) => t[1]).join(""))
      .replace(/[ \t]+\n/g, "\n")
      .trim();
    if (!text) continue;
    if (type === "Scene Heading" || type === "Transition" || type === "Shot") out.push("", text.toUpperCase());
    else if (type === "Character") out.push("", pad(20) + text.toUpperCase());
    else if (type === "Parenthetical") out.push(pad(15) + text);
    else if (type === "Dialogue") out.push(...text.split("\n").map((line) => pad(10) + line));
    else out.push("", text);
  }
  if (!out.length) throw new Error("That Final Draft file has no script in it.");
  return `${out.join("\n").trim()}\n`;
}

/** One run of text on a PDF page, as pdf.js reports it: x and y from the bottom left, in points. */
export type PdfRun = { str: string; x: number; y: number; width: number; page: number };

/** A Courier 12 screenplay: 7.2pt a character, 12pt a line. */
const CHAR = 7.2;
const PAGE_NUMBER = /^\d{1,3}\.?$/;
const NOISE = /^\(?(MORE|CONTINUED)\)?:?$|^CONTINUED:?\s*\(\d+\)$/;

/**
 * PDF text back into screenplay lines. Runs on the same baseline join into a line; a line's indent comes from how far
 * right of the page's left margin it starts; a gap of more than one and a half lines becomes a blank line. Page numbers,
 * (MORE) and CONTINUED are dropped, and scene numbers either side of a heading are taken off.
 */
export function pdfRunsToText(runs: PdfRun[]): string {
  const pages = new Map<number, PdfRun[]>();
  for (const run of runs) if (run.str.trim()) pages.set(run.page, [...(pages.get(run.page) ?? []), run]);
  const left = Math.min(...runs.filter((r) => r.str.trim()).map((r) => r.x));
  const out: string[] = [];
  for (const page of [...pages.keys()].sort((a, b) => a - b)) {
    const lines: { y: number; runs: PdfRun[] }[] = [];
    for (const run of pages.get(page)!) {
      const line = lines.find((l) => Math.abs(l.y - run.y) < 2.5);
      if (line) line.runs.push(run);
      else lines.push({ y: run.y, runs: [run] });
    }
    lines.sort((a, b) => b.y - a.y);
    const gaps = lines.slice(1).map((l, i) => lines[i]!.y - l.y).sort((a, b) => a - b);
    const step = Math.max(8, Math.min(gaps[0] ?? 12, 14));
    let last: number | null = null;
    lines.forEach((line, i) => {
      const parts = line.runs.sort((a, b) => a.x - b.x);
      let text = "";
      let end = parts[0]!.x;
      for (const run of parts) {
        if (text && run.x - end > 1.5 && !text.endsWith(" ") && !run.str.startsWith(" ")) text += run.x - end > CHAR * 3 ? "   " : " ";
        text += run.str;
        end = run.x + run.width;
      }
      text = text.replace(/\s+$/, "");
      const bare = text.trim();
      // Page furniture: a number at the very top or bottom of a page, (MORE), CONTINUED.
      if ((PAGE_NUMBER.test(bare) && (i === 0 || i === lines.length - 1)) || NOISE.test(bare)) return;
      const unnumbered = bare.replace(/^\d+[A-Z]?\.?\s{2,}(?=(INT|EXT|I\/E)\b)/, "").replace(/(?<=\S)\s{2,}\d+[A-Z]?\.?$/, "");
      if (last !== null && last - line.y > step * 1.6) out.push("");
      out.push(pad(Math.max(0, Math.round((parts[0]!.x - left) / CHAR))) + unnumbered);
      last = line.y;
    });
    out.push("");
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

const PDF_VERSION = "6.4.299";
/** Served from /public so pdf.js can read big scripts off the main thread. Keep it in step with the package. */
export const PDF_WORKER = `/pdf.worker-${PDF_VERSION}.min.mjs`;

/** A PDF's text, read in this browser. A scanned PDF has none, and says so. */
export async function pdfToText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  const runs: PdfRun[] = [];
  for (let page = 1; page <= Math.min(doc.numPages, 400); page++) {
    const content = await (await doc.getPage(page)).getTextContent();
    for (const item of content.items) {
      if ("str" in item && item.str.trim()) runs.push({ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, page });
    }
  }
  await task.destroy();
  if (!runs.length) throw new Error("That PDF has no text in it, so it may be scanned pages. Export the script as a text PDF, Final Draft or Fountain.");
  return pdfRunsToText(runs);
}

export const SCRIPT_ACCEPT = ".pdf,.fdx,.fountain,.md,.txt,application/pdf,text/plain,text/markdown";

/** Any script file, as text: PDF and Final Draft are converted, the rest are read as they are. */
export async function readScriptFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    if (file.size > 20_000_000) throw new Error("Keep each PDF under 20 MB.");
    return pdfToText(await file.arrayBuffer());
  }
  if (file.size > 3_000_000) throw new Error("Keep each script under 3 MB.");
  if (name.endsWith(".fdx")) return fdxToText(await file.text());
  return file.text();
}
