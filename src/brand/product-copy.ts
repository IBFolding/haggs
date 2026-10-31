import { LESSONS } from "../academy/lessons";
import { QUICK_APPS } from "../comfy/quick";

/** Public product claims derived from the catalogs they describe. */
export const ACADEMY_MINUTES = LESSONS.reduce((total, lesson) => total + lesson.minutes, 0);
export const READY_MADE_APPS_SUMMARY = `${QUICK_APPS.length} ready-made apps: swap, relight, try on, upscale.`;
export const AGENT_OPEN_PAGE_DESCRIPTION = `Take the person to a page in haggs: /library, /photos (make pictures), /edit (edit a picture), /characters, /locations, /video, /series (a topic into short vertical videos, faceless channels too), /swap (put a character into a video), /editor (the Cut of their last board), /academy (seven short lessons), /workflows (${QUICK_APPS.length} ready-made apps), /workflows/build (the open canvas; ?quick=<app> opens a ready-made one, e.g. relight, upscale, try-on, swap-person), /workflows/community, /workflows/<name>, /board/<project>?b=<board>, /board/<project>/sheets?b=<board>, /board/<project>/cut?b=<board>, /board/<project>/media?b=<board>, /gallery.`;
export const ACCOUNT_BENEFITS = "An account holds your plan and credits and can keep finished results available on every device. Projects stay on this device.";
