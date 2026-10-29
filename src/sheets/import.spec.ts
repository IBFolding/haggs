import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { fdxToText, PDF_WORKER, pdfRunsToText, type PdfRun } from "./import";
import { parseScreenplay } from "./screenplay";

const fdx = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="5">
<Content>
<Paragraph Type="Scene Heading"><Text>EXT. ROOFTOP - NIGHT</Text></Paragraph>
<Paragraph Type="Action"><Text>NIA (24) dangles a phone over the edge. </Text><Text Style="Bold">Wind.</Text></Paragraph>
<Paragraph Type="Character"><Text>NIA</Text></Paragraph>
<Paragraph Type="Parenthetical"><Text>(daring)</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>Say it again &amp; mean it.</Text></Paragraph>
<Paragraph><DualDialogue>
<Paragraph Type="Character"><Text>JONAH</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>No.</Text></Paragraph>
<Paragraph Type="Character"><Text>NIA</Text></Paragraph>
<Paragraph Type="Dialogue"><Text>Yes.</Text></Paragraph>
</DualDialogue></Paragraph>
<Paragraph Type="Scene Heading"><Text>int. lift - continuous</Text></Paragraph>
<Paragraph Type="Action"><Text>JONAH (25) holds the doors.</Text></Paragraph>
</Content>
<TitlePage><Content><Paragraph><Text>RING TONE</Text></Paragraph></Content></TitlePage>
</FinalDraft>`;

test("a Final Draft script reads into the same scenes, speakers and lines as a typed one", () => {
  const play = parseScreenplay(fdxToText(fdx));
  assert.deepEqual(play.scenes.map((s) => s.heading), ["EXT. ROOFTOP - NIGHT", "INT. LIFT - CONTINUOUS"]);
  assert.deepEqual(play.scenes[0]!.dialogue.map((l) => [l.character, l.words]), [["NIA", "Say it again & mean it."], ["JONAH", "No."], ["NIA", "Yes."]]);
  assert.equal(play.scenes[0]!.dialogue[0]!.parenthetical, "daring");
  assert.match(play.scenes[0]!.action, /Wind\./);
  assert.deepEqual(play.characters.map((c) => c.name).sort(), ["JONAH", "NIA"]);
  // Final Draft and most PDFs split place and time with a spaced hyphen.
  assert.deepEqual(play.scenes.map((s) => [s.place, s.time]), [["ROOFTOP", "NIGHT"], ["LIFT", "CONTINUOUS"]]);
});

test("a file that isn't Final Draft, or has no script in it, is refused with a reason", () => {
  assert.throws(() => fdxToText("<html></html>"), /isn't a Final Draft/);
  assert.throws(() => fdxToText("<FinalDraft><Content></Content></FinalDraft>"), /no script/);
});

/** A page laid out like a Courier 12 screenplay: left margin 108pt, cues at 3.7in, dialogue at 2.5in. */
function page(n: number, rows: [number, string][]): PdfRun[] {
  let y = 720;
  const out: PdfRun[] = [{ str: `${n}.`, x: 500, y: 750, width: 14, page: n }];
  for (const [indent, str] of rows) {
    if (str) out.push({ str, x: 108 + indent * 7.2, y, width: str.length * 7.2, page: n });
    y -= 12;
  }
  return out;
}

test("a PDF's runs rebuild the lines, indents and blank lines the parser needs, without page furniture", () => {
  const runs = [
    ...page(1, [[0, "1     EXT. ROOFTOP - NIGHT     1"], [0, ""], [0, "NIA (24) dangles a phone over the edge."], [0, ""], [22, "NIA"], [10, "Say it again. I dare"], [22, "(MORE)"]]),
    ...page(2, [[22, "NIA (CONT'D)"], [10, "you."], [0, ""], [0, "2     INT. LIFT - CONTINUOUS     2"], [0, ""], [0, "JONAH (25) holds the doors."], [0, ""], [22, "JONAH"], [10, "I lied about the ring."]]),
  ];
  const text = pdfRunsToText(runs);
  assert.doesNotMatch(text, /\(MORE\)|^\s*\d\.\s*$/m);
  const play = parseScreenplay(text);
  assert.deepEqual(play.scenes.map((s) => s.heading), ["EXT. ROOFTOP - NIGHT", "INT. LIFT - CONTINUOUS"]);
  assert.deepEqual(play.characters.map((c) => c.name).sort(), ["JONAH", "NIA"]);
  assert.match(play.scenes[1]!.dialogue[0]!.words, /I lied about the ring/);
});

test("two runs on one baseline join with a space, and a split word stays whole", () => {
  const text = pdfRunsToText([
    { str: "INT. KITCHEN", x: 108, y: 700, width: 86.4, page: 1 },
    { str: "- DAY", x: 201.6, y: 700, width: 36, page: 1 },
    { str: "Sh", x: 108, y: 676, width: 14.4, page: 1 },
    { str: "e waits.", x: 122.4, y: 676, width: 57.6, page: 1 },
  ]);
  assert.equal(text, "INT. KITCHEN - DAY\n\nShe waits.\n");
});

test("the PDF worker the reader points at is served, and matches the installed pdf.js", () => {
  const version = JSON.parse(readFileSync("node_modules/pdfjs-dist/package.json", "utf8")).version as string;
  assert.equal(PDF_WORKER, `/pdf.worker-${version}.min.mjs`);
  assert.ok(existsSync(`public${PDF_WORKER}`));
});
