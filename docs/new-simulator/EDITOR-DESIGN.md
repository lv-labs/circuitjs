# Circuit document and engine adapter

Design and implementation direction, 2026-11-13. Document loading, stable-ID
results, revision coordination, continuous RC switching and the first editor are
implemented; see [DOCUMENT-ADAPTER.md](DOCUMENT-ADAPTER.md) and
[EDITOR-PROTOTYPE.md](EDITOR-PROTOTYPE.md). Broader model/catalog features and
unimplemented editing commands below remain proposals. Rust, UI toolkit and target platforms
remain open. The format is JSON and can be represented in either Rust or TypeScript.

## Ownership

The editor owns the saved circuit document. The worker owns one running simulation.
The renderer reads layout plus results; it does not own electrical connectivity.
The adapter translates a document into engine inputs and maps results back to IDs.

Keep three kinds of state separate:

| State | Contents | Saved in circuit file? |
| --- | --- | --- |
| Document | Components, values, wires, junctions, layout, probes, simulation settings | Yes |
| Editor session | Selection, hover, active tool, drag preview, camera, undo history | No, initially |
| Simulation session | Time, solver nodes, stored charge/current, frames, run/pause status | No |

Initial capacitor voltage/inductor current are document parameters. Their changing
runtime values are simulation state. Saving a design is not saving a live solver
checkpoint. A future checkpoint format must be separate and explicitly versioned.

## Saved document

See [the complete divider example](examples/voltage-divider.json).

```text
CircuitDocument {
  schemaVersion: 1
  id: DocumentId
  title: string
  electrical: { components: Component[], junctions: Junction[], wires: Wire[] }
  layout: { components: Map<ComponentId, Pose>,
            junctions: Map<JunctionId, Point>, wires: Map<WireId, {bends: Point[]}> }
  probes: Probe[]
  simulation: { timeStep: number }
}
```

IDs are opaque strings, generated once (UUIDs in production; readable IDs in
examples). They are never array offsets, labels, coordinates or solver node numbers.
Each entity kind has its own ID namespace. A pin's identity is the tuple
`(componentId, pinId)`. References such as `R1` are editable display text.

Move/rotate/value edits keep IDs. Copy/paste generates new IDs and rewrites internal
references. Delete removes incident wires in the same transaction. Undo can restore
the original entities/IDs; it creates a new revision rather than rewinding counters.

Each component stores `kind`, `modelVersion`, `reference`, and typed `parameters`.
A versioned model catalog defines pin keys, parameter validation, symbols and
engine mappings. Symbol rendering can evolve separately from electrical models.

| Kind | Pin keys | Parameters, using SI units |
| --- | --- | --- |
| resistor | a, b | resistance (> 0 ohms) |
| capacitor | a, b | capacitance (> 0 F), initialVoltage (a minus b), integration |
| inductor | a, b | inductance (> 0 H), initialCurrent (a to b), integration |
| voltageSource | p, n | waveform: dc voltage, or sine amplitude/frequency/offset/phase |
| diode | a, k | model: default initially |
| switch | a, b | closed: boolean; simple non-momentary SPST initially |
| ground | g | none; all ground pins reference global ground |

Integration is `trapezoidal` or `backwardEuler`. Numeric fields must be finite;
timeStep must be positive. Unit strings such as `4.7k` belong to the input parser;
the saved value is 4700. Unknown kinds/model versions are retained for inspection
but block simulation; never silently substitute a different electrical model.

The DC waveform is `{kind:"dc", voltage}`. The sine waveform is
`{kind:"sine", amplitude, frequencyHz, offset, phaseRadians}`; frequency is
nonnegative and voltages use volts. Poses use finite screen-world coordinates,
clockwise rotations 0/90/180/270 degrees, and a boolean local horizontal mirror
applied before rotation. Layout units have no electrical/physical length meaning.

## Connectivity is a graph

A wire has an ID and two endpoints. An endpoint is one of:

```json
{"kind":"pin","componentId":"r1","pinId":"b"}
```

```json
{"kind":"junction","junctionId":"j-out"}
```

Multiple wire edges may meet at a pin or explicit junction. Wires are undirected;
their drawing order does not establish current direction. Components are devices,
not conductive wire edges: a resistor's a/b pins are not unioned into one net.
A closed switch also remains a device, so opening it does not rewrite the saved graph.

The saved graph, not layout overlap, defines connectivity. Loading or rendering
coincident pins or crossing wires never changes the graph. The KiCad-like editor
makes placing/rotating/dropping a component onto a pin/junction/wire an explicit
connection operation: it records contact edges and any required wire split in the
same transaction. A contact edge can have zero drawn length; moving one endpoint
away reveals a wire without changing its electrical identity. Wire crossings alone
remain independent. Branch dots reflect at least three connected incident leads
or wire legs; ordinary pin-to-wire joins and two-way contacts have no dot.

The current editor uses a 16-unit grid, with exact quarter-turn pin transforms and
all supported pins on-grid. Ground's placement anchor is its connection pin. Older
layouts are snapped on editor load without inferring additional graph edges.

To connect to a wire's interior, split its edge at a new junction and attach the new
edge to that junction in one transaction. Retain the original wire ID for one
segment; allocate IDs for the other segment and new branch. Disconnecting changes
endpoints/edges explicitly. Merely adding a bend changes layout only.

A persistent junction has a position. A bend is only a point on a wire's route and
has no electrical identity. Wire endpoints are resolved from their pin/junction
references; do not store duplicate endpoint coordinates inside the wire.

The editor can show unfinished wires in tool previews, but committed wire records
always reference existing endpoints. A placed component's unconnected pin is valid
document state; whether it is simulatable is a separate question.

## Derive nets; do not maintain two sources of truth

Derive connected sets from wire edges with union-find, adding every pin/junction as
a vertex and unioning ground pins with global ground. Nets are compiler output,
not separately editable objects in the saved file. Electrical net labels, buses,
hierarchy and implicit power connections are deferred; plain annotations do not
connect anything.

Each net gets a deterministic key from its sorted pin-identity tuples plus its
ground status. Use an unambiguous tuple encoding, not concatenated strings. Keys
are derived, not permanent user identities: joining/splitting nets changes them.
Junction-only routing fragments can be retained visually and omitted from the
solver. Probes store pin/junction references and resolve to the current net.

The canonical electrical projection consists of sorted components/parameters,
pin-to-net assignments and simulation settings. Exclude positions, rotations,
bends, wire IDs, junction IDs, labels and probes. Compare canonical values before
advancing the circuit revision. Consequently, rerouting or splitting a wire without
changing connected pin sets does not restart simulation.

Render wire voltages by resolving their endpoints to nets. A net has a voltage,
but does not have one meaningful current for every branch. Initially expose
component terminal currents only. Wire-current animation needs an explicit branch
current reconstruction policy, especially for redundant wire loops; do not invent
one from a net-wide current or synthetic engine wires.

## Bridge explicit nets to the existing engine

First implementation should generate private synthetic coordinates for the
existing text loader. These coordinates have no relationship to editor layout.
This reuses the current node analysis rather than rewriting numerical code.

1. Validate the document and model catalog references; derive the canonical nets.
2. Give each non-ground component terminal a unique synthetic endpoint and every
   net a unique hub. Keep coordinate ranges disjoint and within integer limits.
3. Emit existing CircuitJS component records and ordinary wires joining each
   terminal to its hub. Emit one engine ground and alias all public ground pins
   to it; multiple GroundElm records plus hub wires create redundant legacy loops.
4. Return a mapping of component/pin IDs to engine element indices/post indices,
   plus net keys to representative terminals. Synthetic wires are adapter internals.
5. Map results using that mapping; never expose numerical node indices or generated
   geometry as document IDs. Ignore internal model nodes when reporting public pins.

On full load/reset, populate legacy stored-voltage/current fields from the
document's initial conditions as well as its configured initial-value fields.
Do not accidentally initialize from a previous snapshot or write changing solver
state back into the saved parameters. State-preserving switch events operate on
the existing engine instance instead of reserializing the whole circuit.

Unique terminal endpoints prevent zero-length devices even if both terminals are
on the same net. Ordinary CircuitJS wire closure uses endpoints, so geometric
crossings among generated wires do not create new nets. Verify that assumption
with adapter tests, including shorts, disconnected pins and coincident layouts.

The voltage-source mapping needs special care: document p is positive, while the
current CircuitJS source stores posts as [negative, positive]. Emit [n, p]. Report
two-terminal current from a to b, a to k, or p to n respectively; invert the legacy
source current for the passive sign convention. A source delivering power then
has negative `V(p)-V(n)` times `I(p to n)`. Verify signs against the divider fixture.
Ground current is unavailable until a well-defined mapping is provided.

Initially require explicit ground to start simulation rather than invoke the
legacy first-source grounding fallback. Surface diagnostics for floating nets and
any legacy stabilization/regularization. Do not claim removal of existing leakage
or convergence behaviour: numerical semantics remain CircuitJS's.

A later direct-net input to the Java engine can replace synthetic coordinates
behind the same adapter contract once equivalence has been demonstrated.

## Editing transactions and simulation policy

Commit one user action as one atomic document transaction. Validate its references,
calculate the resulting electrical projection, and store before/after data for
undo. Drag previews and intermediate text input do not send simulation changes.
The UI should state when an electrical edit restarts simulation; no confirmation
dialog is required for routine editing.

| Action | Document action | Initial worker policy |
| --- | --- | --- |
| Drag/rotate without new contacts, select, pan/zoom, bend a wire, edit display reference | Layout/session change | No engine mutation |
| Place/drop/rotate onto another connection target | Explicit contact edges/splits in the same transaction | Reuse or replace according to canonical electrical comparison |
| Add/remove a probe | Measurement configuration | Read existing results; no restart |
| Split/reroute edges with identical connected pin sets | Graph/layout transaction | No restart after canonical comparison |
| Toggle a supported switch | Update desired closed parameter | Apply at step boundary, retain time/state |
| Change R/C/L/source/diode parameters or initial conditions | Electrical transaction | Replace circuit and restart at initial state |
| Add/delete a device, reconnect pins, change timestep/integration | Electrical transaction | Replace circuit and restart |
| Reset | No document edit | Restart latest committed circuit, not original imported text |
| Undo/redo | New transaction restoring content | Classify using the same rules |

State-preserving switch support starts with the tested RC cases; do not generalize
it to every inductive/ideal-source topology without validation. Unsupported
preserve requests return an explicit capability error, not a silent restart.
More live parameter edits can be added individually with reference tests.

See [worker protocol](WORKER-PROTOCOL.md) for revisions, scheduling and failures.

## Initial slice and remaining scope

The initial loading, revision, run and editor slices now exist. The following was
the first acceptance target; the model table above includes future models.
Copy/paste and a separate detach/move operation remain unimplemented.

Implement this schema/catalog and graph validation, compile the divider example
to the existing worker, and return ID-mapped pin voltages/currents. Prove that
moving/rotating everything and changing every wire route produces the same canonical
projection and results. Then split/merge a junction, edit a resistance, and toggle
a switch to exercise the three policies: no mutation, reset, and preserve.

Acceptance includes explicit crossings, identity through undo/copy/paste, source
current signs, invalid references, stale results, failed replacement, and known
unsupported state preservation. Keep the tested simulation equations untouched.
