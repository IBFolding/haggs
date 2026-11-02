"use server";
import { cancelDeletedHostedOutput } from "../server/hosted-output-runtime";

import {storageAllowance,removedStorage} from "../server/storage-quota";
import { listStoredMedia, deleteStoredMedia } from "../server/media-store";

import { ownerOf, userNow } from "../server/auth";
import { hosted } from "../server/blob";
import { deletable, mine, type Item } from "../server/library";

export type Files = { ok: true; items: Item[]; hosted: boolean; allowanceBytes?:number } | { ok: false; reason: string };

async function everything(owner: string): Promise<Item[]> {
  return listStoredMedia(`haggs/${owner}/`);
}

/** The files a signed-in person has in the store. */
export async function myFiles(): Promise<Files> {
  if (!hosted()) return { ok: true, items: [], hosted: false };
  const user = await userNow();
  if (!user) return { ok: false, reason: "Sign in to see your files." };
  try {
    return { ok: true, items: mine(ownerOf(user), await everything(ownerOf(user))), hosted: true, allowanceBytes:await storageAllowance(user) };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "Your files couldn't be listed." };
  }
}

/** Deletes some of your files. Only ones in your own folder are touched, whatever is asked for. */
export async function deleteFiles(urls: string[]): Promise<{ ok: true; deleted: number } | { ok: false; reason: string }> {
  const user = await userNow();
  if (!hosted() || !user) return { ok: false, reason: "Sign in to delete files." };
  try {
    const ok = deletable(ownerOf(user), urls.slice(0, 200), await everything(ownerOf(user)));
    if (ok.length) { for(const url of ok) { await deleteStoredMedia(url); await cancelDeletedHostedOutput(url); await removedStorage(user.id,url); } }
    return { ok: true, deleted: ok.length };
  } catch (caught) {
    return { ok: false, reason: caught instanceof Error ? caught.message : "The files couldn't be deleted." };
  }
}
