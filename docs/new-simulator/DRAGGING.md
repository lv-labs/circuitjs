# Connected schematic dragging

The editor uses one gesture-local drag graph for pointer dragging, G, junctions,
wire sections, and floating endpoints. `CircuitCore.editing.createDragSession` (also exposed through the prototype
`CircuitEditorModel` compatibility adapter)
owns the original document, moving endpoints, cached adjacency, original segment
axes, temporary bend nodes/edges, and accumulated cursor offset. Pointer updates
advance this graph; they no longer rebuild a route from the original endpoints.
`move` and `moveSegment` are one-shot adapters to the same engine for model callers.
Wire drops split moved sections at component pins and attach them on commit;
ordinary wire crossings remain unconnected. M remains a disconnecting move through
`detach`. Rotation and X/Y flips pick components up:
all incident wire ends become stationary stubs before changing the pose, then
contacts are re-established at the final pin positions. Reorienting during G changes
the gesture to a detached Move from its original pickup position.

The implementation lives in `packages/circuit-core/drag.js` with editing/contact
operations in `commands.js`; `editor-model.js` is now a compatibility adapter.

The reference is KiCad's [SCH_MOVE_TOOL implementation](https://docs.kicad.org/doxygen/sch__move__tool_8cpp_source.html),
particularly `getConnectedDragItems`, `getConnectedItems`, `performItemMove`,
`orthoLineDrag`, `migrateHiddenJunctions`, and `trimDanglingLines`.
This is an adaptation to this editor's pin/junction references and automatic
junction dots, rather than a direct import of KiCad's C++ object hierarchy.

| KiCad rule | Editor implementation |
| --- | --- |
| Separate selected endpoints from fixed attachments | A gesture graph retains physical pins, real branches, movable corners, selected wire endpoints, and explicit boundary connectivity edges. |
| Split movement into X and Y | Each update applies axis movements separately and stops at zero when reversing an accumulated offset. |
| Prefer existing compatible wire segments | A corner slides along an adjoining segment with the matching axis, including a segment shortened to zero. |
| Preserve original line direction at zero length | Each graph edge stores its original axis independently of its current endpoints. |
| Keep fixed junctions connected | A moving wire separates from an anchored branch through one new connectivity section. |
| Add bends when a fixed pin cannot slide | Two temporary segments create the orthogonal bend. Bend counters stagger multiple attached wires by grid spacing. |
| Reuse and remerge dynamically created lines | Temporary edges survive updates; zero-length connectors collapse and straightened temporary corners remerge. Returning to the gesture origin restores the original document exactly. |
| Move a selected section without pulling fixed pins/branches | Boundary endpoints split once into moving endpoints and retained fixed contacts. Loose endpoints travel with an isolated wire. |
| Keep attached markers connected | Probes retain pin/junction references; original junction nodes carry their updated coordinates into every snapshot. |
| Clean up after committing | Finalization normalizes overlaps and removes newly dangling tails while retaining original loose ends, physical pins, probe anchors, and explicitly moved endpoints. |
| One undoable operation | Only the finalized snapshot enters a model transaction. Cancellation discards the session. |

Supported schematic geometry is orthogonal wiring on the editor's 16-unit grid.
KiCad-specific objects absent from this document model, such as hierarchical sheet
pins and bus entries, are not emulated. Source-derived regression tests cover the
rules above; native KiCad UI equivalence is not an automated test oracle.

## Verification

```sh
node tools/test_wire_pin_contacts.mjs
node tools/test_flip_connections.mjs
node tools/test_drag_session.mjs
node tools/test_pin_drag.mjs
node tools/test_editor_model.mjs
node tools/test_wire_sections.mjs
node tools/test_document_adapter.mjs
```

The session tests exercise repeated cursor updates, diagonal moves, direction
reversals, collapsed wires, fixed pin/branch constraints, corner reuse, contacts,
probe anchors, unconnected crossings, multiple wires, stable snapshot identities,
cleanup, cancellation and atomic history. A seeded stress test checks connectivity
at 400 additional cursor offsets.

With the built site served locally, browser checks use actual mouse/keyboard input:

```sh
node tools/test_drag_browser.mjs \
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  /private/tmp/circuitjs-drag-profile http://127.0.0.1:8765/editor.html
node tools/test_loose_end_routing.mjs \
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  /private/tmp/circuitjs-loose-profile http://127.0.0.1:8765/editor.html
```

Use a fresh browser profile directory for each run. The browser drag checks cover
pointer/G equivalence through the same reversal path, preview isolation, corner
reuse, cancellation, detached rotation/reflection, wire-to-pin junctions, exact
undo/redo, electrical connectivity for connected drags and the disconnecting Move
command. Reorientation and explicit new contacts can deliberately change nets.
