import type { Shot } from "./model";
import type { GreyScene } from "./grey-scene";
import { addTake } from "./takes";
/** A completed request remembers its own input scene without undoing edits made while it ran. */
export function addGreyTake(shot: Shot, render: NonNullable<Shot["render"]>, origin: string, producedScene: GreyScene, currentScene: GreyScene): Shot {
  return { ...addTake(shot, render, origin, producedScene), greyScene: currentScene };
}
