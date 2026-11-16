# Simple and Pro: one project, two ways to work

Simple is `/simple`: a conversation with the user's paired Claude Code or Codex,
next to a reviewed production plan. Pro retains the existing full editing,
workflow and model controls. The mode preference is not a billing plan.
The landing page starts with Haggy; the header switches modes without creating
another project. An active production board is retained across that switch.

## The flow

1. Select an existing project or start a named project. Optionally choose actual
   character/place references from the existing bank. Projects are not mutated
   by the AI's Simple planning tools.
2. Pair the local companion and choose Claude Code or Codex. Ask for the goal,
   audience, duration, style and story. Haggy reads the project and proposes
   or revises a structured plan. Missing essentials can be clarified in chat.
3. Inspect the cast/location preparation, shot beats, framing/camera movement,
   lighting, pacing, references, chosen models, voice, effects and soundtrack.
   Existing reference images are shown; ungenerated shots are labelled planned.
4. Estimate the remaining steps. Review provider USD and equivalent Haggs
   credits, then explicitly approve that version and press Execute plan.
5. The browser executes one step at a time: reference assets, shots, narration,
   effects, music. Fresh per-step server quotes are checked against the reviewed
   estimates. A higher or unknown price stops execution. Results attach to a
   separate editable board with source takes preserved.
6. Review the result, export MP4 from Simple using the existing renderer, or open
   the same board in Pro to refine takes, timing, framing and sound. The export
   uses actual selected media and mixes the separate audio tracks. No automatic
   subtitles are added. Previous exports remain labelled when the cut changes.

The initial automatic routes use the existing Comfy workflows for Nano Banana 2
reference/still images, MiniMax H3 video, ElevenLabs speech/effects and Sonilo
music. This is a curated route by production role, not a universal model optimizer.
Simple supports up to 24 shots / 180 seconds, with optional reused project takes.
Quick moments can be half a second in the edit; MiniMax renders at least four
seconds, and the estimate covers that full render before the cut trims it.
Other providers, open workflows, rented GPUs and detailed settings remain in Pro.
Open weights only is enforced server-side; automatic partner-model execution is
refused while that switch is on. Planning itself can still use the selected AI.

## Execution and account boundaries

- MCP tools can propose/read a plan. They cannot approve it or execute a paid
  step. Direct board-edit tools are refused in Simple, including replayed turns
  that originated in Pro. Pro retains the existing editing tools and Undo.
- Per-step approval claims use the existing durable shared Supabase quote ledger,
  with exact input, price and account/provider bindings. There is no in-memory
  production fallback. That ledger and existing provider/storage configuration
  must be present for execution. Unknown pricing is blocked.
- The browser takes a Web Lock to prevent concurrent execution of one project.
  It saves an intent before each submission and the result before attaching it.
  A dropped response remains unresolved and is never automatically submitted
  again. Inspect Activity/provider jobs to reconcile uncertain outcomes.
- Pause means stop before the next submission. The current provider job can
  finish and charge. Keep the tab open: this is not a background worker.
- A reload restores the plan and journal. Completed saved results can be
  reattached without another generation; uncertain requests block continuation.
  Remaining steps require a fresh estimate/review after reload.
- Plans/journals are stored locally under account-scoped keys. They are not
  cross-device cloud plan storage. Switching accounts stops further submissions
  and project attachment; an old account's result stays in its journal.
- Quotes are estimates, not a guaranteed final provider invoice. Existing credit,
  BYOK, storage, rollout and account rules still apply. No subscription or key is
  changed by switching modes.

Update/restart `npm run haggy:connect` when installing this version. Personal
connector protocol v3 adds the Simple mode context and planning tools.

Optional Dictate uses the browser's SpeechRecognition implementation after an
explicit click and microphone permission. It fills the composer; it does not
send or execute. Availability varies and some browsers use an online speech
service. See [MDN SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

## Verification boundary

Tests cover planning without mutation, Simple direct-edit refusal, native model
configuration, bound single-use quotes, exact-once submission under concurrent
claims, full reference/picture/voice/effect/music attachment, the native export
cut contract, durable saving failure, recovery without duplicate calls, price
changes, account changes and pause. The browser exercised a real SDK MCP transport
with a deterministic fake AI, plan rendering, actual non-billable estimate code,
approval gating, refresh and mode switching at desktop/phone sizes.

No live personal-model request, paid media generation or real new MP4 export was
submitted for this change. Browser microphone performance was not tested. These
checks do not complete release gates R1–R6 or qualify a real paid production run.

## Storyboard-first production candidate

The new Simple flow is brief → cast/world bible → storyboard animatic → motion
and sound → export review. A `.txt`, `.md`, or `.fountain` script can accompany
the brief. Sending it asks the paired personal AI for a plan; it never executes.

Each bible asset has an actual selected image, editable identity, wardrobe and
continuity anchors. Approval binds the image and those details to the plan's
look. Changes require approval again. The storyboard pass generates stills only.
Play the silent animatic and adjust shot holds before approving its exact frames
and timing. The final pass uses those images as video first frames. Reused video
plays separately in the timing preview; the animatic is not a final audio mix.

Exact matching storyboard frames and final video takes can be reused across plan
versions. Audio reuse binds text/prompt, native voice and applicable duration,
and stays within the same account and project. A saved execution snapshot keeps
its request graph stable when caches update. This is input matching, not visual
identity analysis, and it cannot guarantee the provider preserves faces or motion.

A project queue retains versioned receipts, including unresolved submissions.
Unknown outcomes block further paid passes until the person checks provider jobs
and explicitly acknowledges the record. That does not settle, cancel, refund or
retry the original request. The original uncertain step remains blocked. Plans,
bibles, approvals, queue and caches are browser-local, account-scoped records.

Export preflight blocks missing selected pictures, unspoken narration and effects
or overlays extending past the cut. Cropping, long captions and audio mix settings
receive manual-review warnings. These are metadata checks, not artistic scores.

Validation: 1,579 tests passed, eight skipped; production build passed. A real
local FFmpeg export of owned synthetic video and tone produced H.264/AAC at
1920×1080, 2.026 seconds. This is a local renderer proof, not hosted export or a
paid generation-through-export proof. No new paid provider requests were made.

Browser fixture checks also verified reference editing/persistence, approval invalidation, animatic playback, timing changes, refresh restoration and no phone overflow. No real provider media was generated in those checks.
