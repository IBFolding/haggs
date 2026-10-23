import type { Kv } from "../story/kv";

/**
 * The Academy: seven short lessons that teach AI video by making it, in
 * haggs. Each one is a few plain steps, a button that opens the real page to
 * do it, and a small homework task. Finish all seven for a certificate.
 */

export type Lesson = { id: string; title: string; minutes: number; goal: string; steps: string[]; doIt: { label: string; href: string }; homework: string; tip: string };

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
