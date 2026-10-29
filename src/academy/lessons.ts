import type { Kv } from "../story/kv";

/**
 * The Academy: seven short lessons that teach AI video by making it, in
 * haggs. Each one is a few plain steps, a button that opens the real page to
 * do it, and a small homework task. Finish all seven for a certificate.
 */

export type Lesson = { id: string; title: string; minutes: number; goal: string; steps: string[]; doIt: { label: string; href: string }; homework: string; tip: string; why?: string; techs?: Technique[] };

/** One technique: what to do, what to avoid, and why it works. */
export type Technique = { do: string; avoid: string; why: string };

/** A cover for each lesson and one for the Academy, made with ChatGPT (original scenes, no text). */
export const lessonCover = (id: string) => `/academy/lesson-${id}.webp`;
export const ACADEMY_HERO = "/academy/academy-hero.webp";
export const COVERS_BY = "Pictures made with ChatGPT";

export const LESSONS: Lesson[] = [
  {
    id: "first-video", title: "Your first video", minutes: 1, goal: "Turn one photo into a moving clip.",
    steps: ["Open the Bring a photo to life app.", "Drop in any photo.", "Type how it should move: \"slow push-in, the light shifts gently\".", "Press Run. The price is on the button."],
    doIt: { label: "Bring a photo to life", href: "/workflows/build?quick=photo-to-clip" },
    homework: "Make a clip from a photo of your own and keep it in Your apps.", tip: "Short, specific movement beats a long description.",
  },
  {
    id: "prompting", title: "Say it like a director", minutes: 12, goal: "Write words that get the shot you pictured.",
    steps: ["Name the subject and what they are doing.", "Say where it is and what the light is doing.", "Say how the camera moves, or that it doesn't.", "Change one thing at a time and make it again.", "Use the Look panel to add a lens, light and grade without typing them."],
    doIt: { label: "Open Video", href: "/video" },
    homework: "Make the same shot three times, changing only the light. Keep your favourite.", tip: "If a take is wrong, change the words, not the luck. Rolling again rarely helps.",
  },
  {
    id: "camera", title: "Move the camera", minutes: 12, goal: "Get the same moment from a new angle.",
    steps: ["Open a project and go to its Cut.", "Pick a shot and open Reshoot.", "Drag the dial to where the camera should be.", "Press Get coverage for a reverse, a wide and a close-up.", "Keep the ones that match; the rest stay as takes."],
    doIt: { label: "Open your projects", href: "/library" },
    homework: "Take one shot and make a wide, a close-up and a reverse of it.", tip: "Open weights is the free route if you have a GPU connected.",
  },
  {
    id: "characters", title: "The same person every time", minutes: 15, goal: "Build a character who stays themselves across shots.",
    steps: ["Open Characters.", "Set who they are: age, build, hair, clothes.", "Or add photos of someone who has said you may use them.", "Make the sheet: three views of the same person.", "Save them, then use them in a project or a Series."],
    doIt: { label: "Build a character", href: "/characters" },
    homework: "Build one character and put them in two different places.", tip: "A name and a marks-and-details line keep faces from drifting.",
  },
  {
    id: "locations", title: "A place you can walk around", minutes: 12, goal: "Make a location and see it from any side.",
    steps: ["Open Locations.", "Describe the place or drop a picture of it.", "Make the sheet.", "Turn the dial to look at it from another side.", "Save it and use it in a project."],
    doIt: { label: "Build a location", href: "/locations" },
    homework: "Make one place and shoot it from the front and from behind.", tip: "Lock the light, then every shot there matches.",
  },
  {
    id: "series", title: "A series in an afternoon", minutes: 15, goal: "Go from a topic to a run of short vertical videos.",
    steps: ["Open Series and pick a format.", "Choose who is in it and how it looks.", "Write it, then make the pictures on the same page.", "Open it in the editor and animate each picture.", "Render with the words burned in."],
    doIt: { label: "Make a series", href: "/series" },
    homework: "Make a three-video series about anything and render the first one.", tip: "Keep hooks under ten words. The first second decides.",
  },
  {
    id: "finish", title: "Cut it, sound it, render it", minutes: 13, goal: "Finish a film with sound that sits right.",
    steps: ["Open a project's Cut and arrange the clips on the timeline.", "Add a soundtrack on the Sound tab.", "Use Blend the voices to level and warm any spoken lines.", "Turn on Master to −16 LUFS.", "Press Render MP4."],
    doIt: { label: "Open your projects", href: "/library" },
    homework: "Render a 30-second film with music and one spoken line, and send it to someone.", tip: "A dry, quiet voice over steady music beats any effect.",
  },
];

/** The longer explanation of each lesson: why it matters and the do and avoid habits behind it. */
const DEPTH: Record<string, { why: string; techs: Technique[] }> = {
  "first-video": { why: "A still is a promise; motion is the payoff. One clear movement is enough, and a first clip teaches you the whole loop: input, words, price, result.", techs: [{"do":"\"Slow push-in, the light shifts gently.\"","avoid":"\"Cinematic epic amazing motion.\"","why":"A named move and a named change give the model something to draw. Adjectives give it nothing."},{"do":"A photo with air around the subject.","avoid":"A photo cropped tight to the edges.","why":"Motion needs room. A tight crop leaves nowhere for the camera to go."},{"do":"Five seconds.","avoid":"Fifteen seconds on your first try.","why":"Short clips cost less and drift less. Extend a good one later."}] },
  "prompting": { why: "The model cannot see your head. It only has your words, so the words have to carry four things: who is in it, where it is, what the light does, and what the camera does. Miss one and the model invents it for you.", techs: [{"do":"\"Rowan, in a green parka, reads a manual in a hardware store aisle. Cold fluorescent light. Slow push-in.\"","avoid":"\"A cool epic shot of a woman, beautiful and cinematic.\"","why":"Things the camera could see beat words about how it should feel."},{"do":"Change only the light, then compare takes.","avoid":"Rewrite the whole prompt every time.","why":"If you change five things you cannot tell which one helped."},{"do":"Change the words when a take is wrong.","avoid":"Roll again and hope.","why":"The same prompt tends to give the same kind of mistake. Rolling rarely helps."}] },
  "camera": { why: "Film is coverage: a wide to place us, a medium for the talk, a close-up for the feeling, a reverse for the other person. One angle is a clip; four angles are a scene.", techs: [{"do":"Start wide, then go in.","avoid":"Close-ups only.","why":"The wide tells us where we are, so every close-up after it means more."},{"do":"Cross the line once, on purpose.","avoid":"Flip sides between every shot.","why":"Staying on one side keeps left and right steady, so the viewer does not get lost."},{"do":"Reshoot from your best take.","avoid":"Remake from words.","why":"A reshoot keeps the face, the clothes and the set. A remake rolls the dice again."}] },
  "characters": { why: "The usual way AI film breaks is the face drifting from shot to shot. A saved character fixes that: one sheet of three views plus a short line of marks that you reuse everywhere.", techs: [{"do":"One mark you can see: a scar, a silver chain, round glasses.","avoid":"\"A nice-looking man.\"","why":"A single odd detail is what the model holds onto when everything else drifts."},{"do":"Same clothes in the same sequence.","avoid":"A new outfit per shot.","why":"Clothes are the second thing viewers use to recognise someone."},{"do":"Only photos you have permission to use.","avoid":"A photo of someone you do not know.","why":"It is the rule here, and it is also the law in many places."}] },
  "locations": { why: "A place is the other half of consistency. If the shelf is on the left in one shot and the right in the next, nobody believes the room. A location sheet fixes the room, the light and the props once.", techs: [{"do":"Say the time of day and the light source.","avoid":"\"A store.\"","why":"Light is what makes two shots look like the same place."},{"do":"Put two or three props in fixed spots.","avoid":"Fill the room with detail.","why":"Fewer things are easier to keep the same across ten shots."},{"do":"Work it out in the Grey room first.","avoid":"Spend credits finding the angle.","why":"Stand-in figures and a camera cost nothing and settle the framing."}] },
  "series": { why: "Short series live or die on the first second. The format gives you the beats; you give it a hook, a face and a look. Make all the pictures first, check them as a row, then animate.", techs: [{"do":"A hook under ten words.","avoid":"A long setup before the point.","why":"The first second decides whether anyone stays."},{"do":"Pictures first, as a row.","avoid":"Animate as you go.","why":"Bad pictures animate into bad clips. Catching them early saves most of the cost."},{"do":"One look for the whole series, saved as a style sheet.","avoid":"A new look every episode.","why":"A look is a brand. Switching it makes the channel feel like several."}] },
  "finish": { why: "Sound is half of the film and most of the polish. A dry, quiet voice over steady music beats any effect, and a master level of −16 LUFS means it plays right everywhere.", techs: [{"do":"Voice 6 to 18 dB above the music.","avoid":"Music at the same level as the voice.","why":"Words must never be fought for, but the music should still be felt."},{"do":"Cut on movement.","avoid":"Cut on a still frame.","why":"The eye follows motion across the cut, so the join disappears."},{"do":"Save a named version before a big change.","avoid":"Overwrite the only cut.","why":"Versions are free and let you go back."}] },
};

for (const lesson of LESSONS) Object.assign(lesson, DEPTH[lesson.id]);

export function createProgress(kv: Kv) {
  const KEY = "academy/done";
  const valid = new Set(LESSONS.map((l) => l.id));
  const done = async () => ((await kv.get<string[]>(KEY)) ?? []).filter((id) => valid.has(id));
  return {
    done,
    async mark(id: string, on: boolean) {
      if (!valid.has(id)) return;
      const now = new Set(await done());
      if (on) now.add(id);
      else now.delete(id);
      await kv.set(KEY, [...now]);
    },
    certified: async () => (await done()).length === LESSONS.length,
  };
}
