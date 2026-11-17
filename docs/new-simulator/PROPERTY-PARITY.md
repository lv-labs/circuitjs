# Component property parity work

Baseline: the original Falstad Java application bundled in this repository, not the latest upstream website.

## Inventory and status

[COMPONENT-PROPERTY-AUDIT.md](COMPONENT-PROPERTY-AUDIT.md) and its JSON companion list all 136 original menu classes, inherited editor labels, candidate React counterparts and parameter keys. Regenerate with `node tools/audit_component_properties.mjs`. There are 49 menu classes without a matching React dump type. Matching dump types alone do not establish parity. Conditional controls, variant layouts, inherited methods and shared app preferences still require review before declaring full parity.

## Implemented

- **Diodes, LEDs and zeners:** all ten public built-in models; reusable custom simple and advanced models. Simple mode exposes saturation current, forward voltage/current and breakdown. Advanced mode exposes saturation current, series resistance, emission coefficient and breakdown. Zener pickers include only models with positive breakdown. LED RGB values and full-brightness current are supported; display brightness follows Falstad's logarithmic curve.
- **Custom model persistence:** model definitions are embedded in component parameters and shared by name within a circuit. Editing a model updates all references in that circuit; renaming forks it. Conflicting definitions are rejected. Definitions survive document save/load and worker projection round trips. Unreferenced custom models are not currently retained as a separate library.
- **Bipolar transistors:** default/spice-default selection, custom model creation/editing with all 20 numeric fields from the bundled model editor, including leakage, reverse beta, Early voltage, roll-off, emission coefficients, junction capacitances and transit times. Zero disables Early voltage/roll-off. Emitter/collector swap preserves physical wire endpoints. Draw-circle option is exposed per component.
- **MOSFETs:** body-diode simulation, separate body terminal, bulk visibility, digital symbol, body-diode visibility, source/drain swap, threshold and beta. Pin layouts and worker node counts update when body-terminal settings change. As in the original model, hiding bulk or selecting a digital symbol disables the body path.
- **Gates:** 1–8 inputs, high logic voltage, Schmitt inputs, input inversion and propagation delay. Input pins, rendering, wiring, hit testing, scope pin menus and worker mappings use the configured count. Removing pins preserves attached wires and voltage probes as junction endpoints.
- **Switches:** on resistance, linked labels/groups, momentary operation, IEC actuator indication, 2–10 SPDT throws and 1–8 DPDT poles. Existing fixed-format documents retain their old encoding. Resistive switch paths no longer count as ideal shorts in loop validation. Momentary previews toggle linked switches; releasing switches with more than two states advances through the second toggle, matching the original press/release cycle.
- **Text:** bar-on-top property, with backward-compatible defaults.

These are implemented property families, not a declaration of complete application parity. Global drawing preferences are currently represented per component; IEC/body-diode artwork uses the React symbol style rather than reproducing every original drawing detail.

## Validation

- `node tools/test_diode_models.mjs`: all built-ins, simple/advanced models, LED/zener curves, breakdown, live edits, old-document migration, shared edits/rename/conflicts, invalid values and projection round trips.
- `node tools/test_property_parity.mjs`: NPN/PNP model behavior, charge parameters and live edits, gate truth tables/counts/inversion/delay, removed-pin migration, live node-count changes, MOSFET reverse body-diode conduction, body terminals and terminal swaps.
- `node tools/test_switch_properties.mjs`: switch resistance and live edits, variable poles/throws, linked/momentary behavior, invalid configurations and projection round trips.
- `node tools/test_symbol_authoring.mjs`: generated catalog, authored symbols and lead metadata.
- `pnpm build` in `wires`: generated catalog consistency, TypeScript and production build.

Engine source changes require rebuilding the worker. The local cached build command is documented in HANDOFF.md. Browser verification is intentionally excluded at the user's request.

## Remaining work

1. Switch keyboard shortcuts; exact global drawing-preference semantics; retaining unused custom models in a library.
2. Digital chip options: configurable widths/bit order, optional set/reset/enable pins, and component-specific modes. The current chips remain fixed-layout subsets.
3. Remaining source, passive and display properties from the inventory. Review inherited and conditional options explicitly; do not mark completion from label matching alone.
4. The 49 original menu classes without React counterparts, including analog/hybrid chips and subcircuit tools.
5. Imported legacy circuit/model-library interchange beyond the current document format.

For each item, extend the document schema compatibly, implement editor/drawing changes, update worker validation/serialization, and verify observable solver behavior. Keep builds and tests focused; no browser verification unless the user requests it.
