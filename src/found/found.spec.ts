import assert from "node:assert/strict";
import test from "node:test";
import { foundBoard, parseSearch, pickFile, searchUrl, searchWords } from "./found";

test("search words are the nouns of a description, not the filler", () => {
  assert.deepEqual(searchWords("I want to make a film about the city at night and a lonely diner"), ["city", "night", "lonely", "diner"]);
  assert.deepEqual(searchWords("the and of"), []);
});

test("the archive search stays inside Prelinger's films and cannot be changed by the words", () => {
  const u = new URL(searchUrl(["diner", 'x") OR collection:(secret'], 12));
  const q = u.searchParams.get("q")!;
  // Whatever the words say, they stay one harmless run of letters inside the OR list.
  assert.equal(q, "(diner OR xORcollectionsecret) AND collection:(prelinger) AND mediatype:(movies)");
  assert.equal(u.hostname, "archive.org");
  assert.equal(u.searchParams.get("rows"), "12");
  assert.throws(() => searchUrl(["!!"]), /few words/);
  assert.match(new URL(searchUrl(["night", "diner"], 5, "all")).searchParams.get("q")!, /^\(night AND diner\)/);
});

test("search results are read, with bad identifiers dropped", () => {
  const found = parseSearch({ response: { docs: [
    { identifier: "Diner1954", title: ["A Diner"], year: "1954", description: "<p>A lunch counter,  at night.</p>" },
    { identifier: "../etc/passwd", title: "bad" },
    { identifier: "NoTitle" },
  ] } });
  assert.deepEqual(found.map((f) => f.id), ["Diner1954", "NoTitle"]);
  assert.equal(found[0]!.title, "A Diner");
  assert.equal(found[0]!.about, "A lunch counter, at night.");
  assert.equal(found[0]!.thumb, "https://archive.org/services/img/Diner1954");
  assert.deepEqual(parseSearch(null), []);
});

test("the web-sized h.264 copy is kept, not the original or anything too big", () => {
  const meta = { files: [
    { name: "film.mpg", format: "MPEG2", size: "900000000" },
    { name: "film_512kb.mp4", format: "512Kb MPEG4", size: "20000000" },
    { name: "film.mp4", format: "h.264", size: "60000000" },
    { name: "huge.mp4", format: "h.264", size: "900000000" },
    { name: "sub/dir.mp4", format: "h.264", size: "1000" },
  ] };
  const f = pickFile("film", meta)!;
  assert.equal(f.name, "film.mp4");
  assert.equal(f.url, "https://archive.org/download/film/film.mp4");
  assert.equal(pickFile("x", { files: [{ name: "a.mpg", format: "MPEG2", size: "1" }] }), null);
});

test("picks become a board, each shot naming where it came from", () => {
  const found = { id: "Diner1954", title: "A Diner", year: "1954", about: "", thumb: "", page: "https://archive.org/details/Diner1954" };
  const p = foundBoard("Night shift", "a lonely night", [{ found, localUrl: "/api/local/haggs-renders/x.mp4", seconds: 4.26 }]);
  const shot = p.boards![0]!.shots[0]!;
  assert.equal(shot.seconds, 4.3);
  assert.match(shot.beat, /Prelinger Archives, https:\/\/archive\.org\/details\/Diner1954/);
  assert.equal(shot.render?.url, "/api/local/haggs-renders/x.mp4");
  assert.throws(() => foundBoard("x", "", []), /at least one/);
});
