import type { Metrics } from "../story/doctor";

/** A long, soft cut to show the sizzle doctor's report without anyone adding a film. */
export const EXAMPLE_FILM: { name: string; metrics: Metrics } = {
  name: "An example: a 112-second sizzle made of dissolves",
  metrics: {
    seconds: 112, width: 2048, height: 1152, fps: 30, hasAudio: true,
    hardCuts: [],
    dissolves: [2, 6, 10, 14, 16, 20, 23, 28, 30, 32, 35, 39, 43, 48, 51, 52, 53, 54, 55, 58, 61, 62, 63, 64, 65, 71, 74, 78, 79, 80, 81, 82, 83, 86, 89, 90, 91, 92, 93, 94, 98, 103, 107],
    motion: [7.5, 5.5, 5.7, 8.7, 6.9, 5.8, 5.7, 4.9, 9.7, 9.8, 8.9, 2.3, 11.8, 23.2, 6.4, 18, 14, 7.5, 4.2, 18.7, 17.6, 6.7, 21.3, 15.7, 11.2, 9.8, 11.7],
    loudness: { integrated: -16, range: 7.1, peak: -2, openingDb: -40 },
  },
};
