# Camera key timing and reverse

The shared viewport now offers a camera-key time field and Move camera key button. Select a key using the existing playhead or previous/next-key controls, choose an unoccupied time in 0–6 seconds, and move it without changing its framing values or removing other keys. Times use the existing 0.05-second grid. Occupied, invalid or out-of-range times are refused without editing the path.

Reverse camera move reverses key order and spacing within the path's existing first/last-key interval. It preserves the interval, framing values and unwrapped orbit angles. Other scene objects and their animation remain unchanged. Both operations use the existing saved camera path and undo history; no new project format, renderer or paid action is introduced.

Focused tests check key movement, collision and invalid input refusal, preserved values, reversed interpolation and double-reversal restoration. Full-suite/build/browser verification is recorded separately in local evidence.
