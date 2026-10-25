/**
 * The sizzle doctor: what a cut's own numbers say about whether it will hold a viewer.
 *
 * The thresholds come from comparing a 112-second cut of soft dissolves (slow, flat, and quiet at the start)
 * with a 57-second cut of hard cuts that speed up, which is the difference between a reel that gets
 * scrolled past and one that gets watched. They are rules of thumb for a short trailer or sizzle, not laws.
 * Everything here is a pure function of measurements, so it can be tested and run anywhere.
 */

export type Metrics = {
  seconds: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  /** When a hard cut lands, in seconds. */
  hardCuts: number[];
  /** The middle of each dissolve or fade between shots, in seconds. */
  dissolves: number[];
  /** How much moves between frames, averaged over each 4-second window. Higher is more movement. */
  motion: number[];
  /** Null when the sound couldn't be measured. */
  loudness: { integrated: number | null; range: number | null; peak: number | null; openingDb: number | null } | null;
};

export type Finding = { id: string; level: "good" | "warn" | "fail"; title: string; detail: string; fix: string };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;
const secs = (n: number) => `${r1(n)} second${r1(n) === 1 ? "" : "s"}`;

export function diagnose(m: Metrics): Finding[] {
  const out: Finding[] = [];
  const cuts = [...m.hardCuts, ...m.dissolves].sort((a, b) => a - b);
  const add = (f: Finding) => out.push(f);

  // Length
  const lengthLevel = m.seconds <= 60 ? "good" : m.seconds <= 90 ? "warn" : "fail";
  add({
    id: "length", level: lengthLevel, title: "Length",
    detail: `${secs(m.seconds)}. Sizzles and trailers that spread do it in under a minute.`,
    fix: lengthLevel === "good" ? "" : "Cut it to 45 to 60 seconds. Keep the strongest shot and the line that explains the idea, and drop the rest.",
  });

  // Pace in the opening: shots a viewer sees before they decide to stay.
  const window = Math.min(30, m.seconds * 0.4);
  const early = cuts.filter((t) => t <= window).length;
  const openAvg = window / (early + 1);
  if (m.seconds >= 10) {
    const pace = openAvg <= 2.2 ? "good" : openAvg <= 3.2 ? "warn" : "fail";
    add({
      id: "pace", level: pace, title: "Pace of the opening",
      detail: `Shots in the first ${Math.round(window)} seconds average ${secs(openAvg)}. Trailers open on shots of one to two seconds.`,
      fix: pace === "good" ? "" : "Shorten the early shots to one or two seconds each and save the long holds for one or two emotional moments.",
    });
  }

  // The hook: something happens in the first three seconds.
  if (m.seconds >= 6) {
    const inHook = cuts.filter((t) => t < 3).length;
    const moving = (m.motion[0] ?? 0) >= 12;
    const hook = inHook >= 1 || moving ? "good" : "warn";
    add({
      id: "hook", level: hook, title: "The first three seconds",
      detail: hook === "good" ? "There is a cut or real movement in the first three seconds." : "Nothing cuts and little moves in the first three seconds. People decide to scroll in about two.",
      fix: hook === "good" ? "" : "Open on your most striking image, or on a line of text that states the idea, and cut within two seconds.",
    });
  }

  // Cuts or dissolves
  if (cuts.length >= 3) {
    const soft = m.dissolves.length / cuts.length;
    const level = soft <= 0.25 ? "good" : soft <= 0.6 ? "warn" : "fail";
    add({
      id: "soft-cuts", level, title: "Hard cuts or dissolves",
      detail: `${Math.round(soft * 100)}% of the transitions are dissolves. Dissolves read as a slideshow; hard cuts on a beat read as a trailer.`,
      fix: level === "good" ? "" : "Swap most dissolves for hard cuts, and keep two or three dissolves for the quiet, emotional moments.",
    });
  }

  // A build: somewhere after the opening it should get busier than it started, in cuts or in movement.
  if (m.seconds >= 20 && m.motion.length >= 4) {
    const perWindow = Array.from({ length: Math.ceil(m.seconds / 10) }, (_, i) => cuts.filter((t) => t >= i * 10 && t < (i + 1) * 10).length);
    const cutRise = Math.max(...perWindow.slice(1)) / Math.max(1, perWindow[0] ?? 0);
    const quarter = Math.max(1, Math.floor(m.motion.length / 4));
    const motionRise = Math.max(...m.motion.slice(quarter)) / Math.max(0.1, mean(m.motion.slice(0, quarter)));
    const level = cutRise >= 1.6 || motionRise >= 1.5 ? "good" : cutRise >= 1.1 || motionRise >= 1.15 ? "warn" : "fail";
    add({
      id: "build", level, title: "A build",
      detail: level === "good" ? "It gets busier after the opening: more cuts or more movement." : "Nothing gets faster or more physical as it goes, so there is nothing to lean forward for.",
      fix: level === "good" ? "" : "Shorten the cuts toward the middle and move the most physical shots (running, breaking, reaching) next to each other, then land on the title.",
    });
  }

  // Movement
  if (m.motion.length >= 3) {
    const quiet = m.motion.filter((v) => v < 3).length / m.motion.length;
    const level = quiet <= 0.4 ? "good" : "warn";
    add({
      id: "movement", level, title: "Movement",
      detail: `${Math.round(quiet * 100)}% of the film barely moves.`,
      fix: level === "good" ? "" : "Replace static portraits with shots where something moves, or add a slow push-in so no shot is still.",
    });
  }

  // Sound
  if (!m.hasAudio) {
    add({ id: "loudness", level: "fail", title: "Sound", detail: "There is no sound track at all.", fix: "Add music from the first frame, even quiet, and level it to about -14 LUFS." });
  } else if (m.loudness) {
    const l = m.loudness;
    if (l.integrated !== null) {
      const clipped = l.peak !== null && l.peak > -1;
      const level = clipped ? "warn" : l.integrated >= -16.5 && l.integrated <= -12.5 ? "good" : "warn";
      add({
        id: "loudness", level, title: "Loudness",
        detail: clipped ? `The peaks reach ${r1(l.peak!)} dB, which will distort.` : `${r1(l.integrated)} LUFS. Social platforms play at about -14.`,
        fix: level === "good" ? "" : clipped ? "Pull the loudest sound down so the peaks stay under -1 dB." : l.integrated < -16.5 ? "Raise the mix to about -14 LUFS, or it will sound quiet next to everything else in the feed." : "Lower the mix to about -14 LUFS; the platform will turn it down and squash it.",
      });
    }
    if (l.openingDb !== null) {
      const level = l.openingDb > -45 ? "good" : "warn";
      add({
        id: "opening-sound", level, title: "Sound at the start",
        detail: level === "good" ? "There is sound from the first second." : "The first second and a half is silent.",
        fix: level === "good" ? "" : "Start the music on the first frame and let it build, so there is no dead air.",
      });
    }
  }

  return out;
}

export function summarize(findings: Finding[]): { score: number; good: number; warn: number; fail: number; verdict: string } {
  const count = (level: Finding["level"]) => findings.filter((f) => f.level === level).length;
  const fail = count("fail");
  const warn = count("warn");
  const score = Math.max(0, 100 - fail * 20 - warn * 9);
  const verdict = score >= 85 ? "Ready to post." : score >= 65 ? "Close. Fix the warnings first." : "Not yet. The cut is working against you.";
  return { score, good: count("good"), warn, fail, verdict };
}
