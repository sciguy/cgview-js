# Track sizing

```js
track.setThickness(2, {mode: 'ratio'});
track.setThickness(20, {mode: 'pixels'});
cgv.draw();

track.computedInitialSlotThickness;
track.slots(1).thickness; // current rendered pixels for this slot
```

`track.computedInitialSlotThickness`: Read-only thickness in pixels per visible slot at zoom factor 1, computed using the current canvas dimensions, ratios, and settings.

`setThickness` requires an explicit mode and a finite positive JavaScript number.
It returns the track. Missing/unknown modes throw `TypeError`; invalid values
throw `RangeError`, before changing any state.

- **Ratio:** equivalent to `track.update({thicknessRatio: value})`. Redistributes
  the existing space. Other slots can change width. Hidden and empty tracks can
  still have their ratios updated. The original ratio setter/update API remains
  available, including numeric-string conversion; invalid ratios are ignored.
- **Pixels:** targets pixels **per visible slot**, at zoom factor 1, with the
  current canvas dimensions. A two-slot track set to 20 has two 20 px slots,
  excluding dividers and spacing. Other visible slots retain their computed
  overview widths and their ratios. The operation updates the selected ratio,
  `initialMapThicknessProportion`, and, when needed, `maxMapThicknessProportion`
  and `maxSlotThickness` together.

Pixel sizing requires a loaded, visible track in the viewer with at least one
visible slot. Otherwise it throws `Error` without changing anything. A visible
but empty data slot still counts as a slot. `computedInitialSlotThickness` returns
`undefined` for loading, hidden, removed, or slotless tracks. This read-only getter
calculates the shared caps too; it neither resets zoom nor changes slot geometry.

There is no stored pixel size, sizing mode, or original-size baseline. Save the
map normally with `cgv.io.toJSON()`; the resulting track ratios and settings
round-trip. Matching canvas dimensions reproduce overview widths. Canvas
resizing and zooming can change rendered widths. Pixel sizing does not promise
unchanged neighbours at every zoom level or that a large map fits the canvas.
Targets that would give the existing circular layout a non-positive backbone
radius throw `RangeError` before mutation, rather than failing during drawing.

`settings.maxSlotThickness` is the shared pixel cap for feature and plot slots
at all zoom levels. It is accepted in construction, `settings.update()`, and
JSON. Maps that omit it retain the legacy **50 px** default, including when
loaded into a viewer that previously used a different cap. It must be finite
and at least `layout.minSlotThickness` (normally 1 px); invalid updates are
ignored. Initial/max map proportions must be finite and positive.

The shared cap normally scales ratios proportionally. Pixel sizing accounts
for the actual capped overview widths, and raises the cap when needed. In this
case it never lowers the cap, so subsequent edits do not squeeze a previously
enlarged track. With extreme ratio differences the existing 1 px floor can also
apply, producing widths that are no longer proportional to ratios. Compatible
pixel targets preserve that mapping (and may adjust the cap); incompatible
targets throw `RangeError` without mutation. For example, with ratios
`[0.01, 1, 2, 100]` under an active 50 px cap, setting the third track to 5 px is
possible, but 0.5 px cannot preserve all neighbours without changing their
ratios. Ratio mode remains available to change such a layout deliberately.

Coordinated changes perform one layout calculation and preserve the zoomed focal
base and radial offset synchronously. They cancel any in-flight recentering
transition instead of scheduling slider animations. `settings-update` (when
settings change) and `tracks-update` retain their usual payloads and are emitted
after the completed layout. A pixel target already met is a no-op. Like
`track.update()`, the operation leaves drawing to the caller.

For custom coordinated controls, `cgv.layout.batchProportionUpdates(callback)`
batches synchronous changes, supports nesting, and delivers sizing update
notifications after the outermost calculation. Empty/unchanged batches do not
recalculate. It flushes applied changes even when a callback throws; it is not a
rollback transaction. Do not pass asynchronous callbacks.

Enable **Track Sizing** in the test page's **Options** to show the section.
It calls this API directly. Its slider and
numeric input use actual pixels or ratios, and readouts follow loading, track
changes, settings, zoom, and canvas resizing.
