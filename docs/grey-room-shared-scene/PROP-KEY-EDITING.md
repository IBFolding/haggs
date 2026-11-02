# Prop key timing and reversal

Selected props now expose Move prop key and Reverse prop motion beside their existing key controls. Retiming moves a key within the six-second viewport on its 0.05-second grid, refusing occupied times and preserving every channel and all other keys. Locked props cannot be edited.

Reverse mirrors the complete stored path inside its original first/last-key interval, including sparse channels and imported keys beyond six seconds. The UI identifies longer paths explicitly; it does not truncate them. Neither operation modifies camera motion, asset URLs, model attachments or unrelated props. Existing scene saves and undo/redo handle both changes without a new project format.

Pure tests cover sparse-channel reversal, longer paths, preservation, invalid/colliding inputs, locks and serialization. Local browser checks cover desktop/mobile controls, undo/redo and reopen. Paid AI is not used.
