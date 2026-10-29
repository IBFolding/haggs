import { EMPTY_PROFILE, readProfile, type Profile } from "./profile";
export type ProfileDraft = { owner: string | null; draft: Profile; saved: Profile };
/** Auth refreshes must never replace the same person's in-progress edits. */
export function syncProfileDraft(current: ProfileDraft, user: { id: string; user_metadata?: { profile?: unknown } } | null): ProfileDraft {
  if (current.owner === (user?.id ?? null)) return current;
  const profile = user ? readProfile(user.user_metadata?.profile) : EMPTY_PROFILE;
  return { owner: user?.id ?? null, draft: profile, saved: profile };
}
