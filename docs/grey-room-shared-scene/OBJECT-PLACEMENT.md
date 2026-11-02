# Explicit object placement

Selected figures and props now have X/Z floor-position fields, Place object and Centre on floor. Coordinates are shown and entered in metres at centimetre increments, bounded to the existing −3 to 3 metre room. Selecting an object only fills the fields; placement is explicit. Focusing a field pauses playback. Locked props refuse placement, and switching selection/playhead refreshes the fields.

Placement uses existing saved figure coordinates and the same prop edit pipeline as dragging. Position channels that already have keys record changes at the current playhead; unanimated position channels remain static, matching the existing drag controls. Other keys, source media and model attachments remain intact. Walking figures use the entered point as their existing walking-path centre, preserving facing, pose and camera motion. Existing save/reopen and undo/redo are reused without a format change. No paid/provider functionality is involved.

The shared key writer selects the nearest saved moment when imported keys are closely spaced. This prevents edits at an exact later key from overwriting an earlier neighbour and preserves sparse values on both keys.
