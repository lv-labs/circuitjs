# Bundled Falstad catalog inventory

Generated with `python3 tools/inventory_legacy_catalog.py`. This is a static source inventory,
not a runtime compatibility result. Full parity targets the bundled fork first;
matching newer upstream releases requires a separate upstream comparison.

- 140 distinct element class names referenced by the legacy menu.
- 150 element subclasses found in source (includes base classes and aliases).
- 125 statically resolved serialized element types.
- 374 bundled circuit text files; 368 menu entries.
- 0 menu files missing from the bundled circuit directory.

The new editor has 28 component models plus wires. No legacy text importer exists yet.
Even examples whose record types have editor equivalents need parameter, flags, geometry,
junction, model-definition and scope conversion. Type coverage alone is not loadability.
Aliases sharing a dump type may use different flags and parameters. Records not resolved
to element classes are retained verbatim in the inventory for separate classification.

## Component types by example usage

| Record type | Bundled examples using it | Source classes / variants | New editor equivalent |
| --- | ---: | --- | --- |
| `w` | 302 | WireElm | Base model only |
| `r` | 258 | ResistorElm | Base model only |
| `g` | 249 | GroundElm | Base model only |
| `R` | 201 | ACRailElm, ClockElm, NoiseElm, RailElm, SquareRailElm | Base model only |
| `c` | 135 | CapacitorElm | Base model only |
| `O` | 108 | OutputElm | Pending |
| `v` | 77 | ACVoltageElm, DCVoltageElm, VoltageElm | Base model only |
| `L` | 67 | LogicInputElm | Pending |
| `M` | 66 | LogicOutputElm | Pending |
| `a` | 59 | OpAmpElm, OpAmpSwapElm | Base model only |
| `l` | 50 | InductorElm | Base model only |
| `t` | 50 | NTransistorElm, PTransistorElm, TransistorElm | Base model only |
| `x` | 48 | TextElm | Pending |
| `f` | 43 | MosfetElm, NMosfetElm, PMosfetElm | Base model only |
| `d` | 38 | DiodeElm | Base model only |
| `s` | 28 | PushSwitchElm, SwitchElm | Base model only |
| `I` | 23 | InverterElm | Base model only |
| `p` | 21 | ProbeElm | Pending |
| `172` | 20 | VarRailElm | Pending |
| `170` | 17 | SweepElm | Pending |
| `150` | 14 | AndGateElm | Base model only |
| `174` | 14 | PotElm | Base model only |
| `211` | 13 | AudioOutputElm | Pending |
| `S` | 12 | Switch2Elm | Base model only |
| `151` | 10 | NandGateElm | Base model only |
| `165` | 10 | TimerElm | Pending |
| `171` | 10 | TransLineElm | Pending |
| `178` | 9 | RelayElm | Pending |
| `i` | 9 | CurrentElm | Base model only |
| `155` | 8 | DFlipFlopElm | Pending |
| `179` | 8 | CC2Elm | Pending |
| `T` | 8 | TransformerElm | Base model only |
| `j` | 8 | JfetElm, NJfetElm | Base model only |
| `154` | 7 | XorGateElm | Base model only |
| `156` | 7 | JKFlipFlopElm | Pending |
| `419` | 7 | DecimalDisplayElm | Pending |
| `m` | 7 | MemristorElm | Pending |
| `152` | 6 | OrGateElm | Base model only |
| `159` | 6 | AnalogSwitchElm | Pending |
| `153` | 5 | NorGateElm | Base model only |
| `162` | 5 | LEDElm | Base model only |
| `z` | 5 | ZenerElm | Base model only |
| `160` | 4 | AnalogSwitch2Elm | Pending |
| `164` | 4 | CounterElm | Pending |
| `207` | 4 | LabeledNodeElm | Pending |
| `402` | 4 | OTAElm | Pending |
| `418` | 4 | ExtVoltageElm | Pending |
| `163` | 3 | RingCounterElm | Pending |
| `175` | 3 | TunnelDiodeElm | Pending |
| `181` | 3 | LampElm | Pending |
| `187` | 3 | SparkGapElm | Pending |
| `426` | 3 | RelayContactElm | Pending |
| `166` | 2 | DACElm | Pending |
| `167` | 2 | ADCElm | Pending |
| `168` | 2 | LatchElm | Pending |
| `173` | 2 | TriodeElm | Pending |
| `176` | 2 | VaractorElm | Pending |
| `177` | 2 | SCRElm | Pending |
| `400` | 2 | DarlingtonElm, NDarlingtonElm, PDarlingtonElm | Pending |
| `403` | 2 | ScopeElm | Pending |
| `425` | 2 | RelayCoilElm | Pending |
| `157` | 1 | SevenSegElm | Pending |
| `158` | 1 | VCOElm | Pending |
| `161` | 1 | PhaseCompElm | Pending |
| `169` | 1 | TappedTransformerElm | Pending |
| `182` | 1 | SchmittElm | Pending |
| `183` | 1 | InvertingSchmittElm | Pending |
| `184` | 1 | MultiplexerElm | Pending |
| `185` | 1 | DeMultiplexerElm | Pending |
| `193` | 1 | TFlipFlopElm | Pending |
| `203` | 1 | DiacElm | Pending |
| `206` | 1 | TriacElm | Pending |
| `208` | 1 | CustomLogicElm | Pending |
| `212` | 1 | VCVSElm | Pending |
| `213` | 1 | VCCSElm | Pending |
| `370` | 1 | AmmeterElm | Pending |
| `405` | 1 | LEDArrayElm | Pending |
| `417` | 1 | UnijunctionElm | Pending |
| `423` | 1 | LineElm | Pending |
| `427` | 1 | ThreePhaseMotorElm | Pending |
| `428` | 1 | MotorProtectionSwitchElm | Pending |
| `430` | 1 | CrossSwitchElm | Pending |
| `A` | 1 | AntennaElm | Pending |
| `b` | 1 | BoxElm | Pending |
| `0` | 0 | BusLogicInputElm, RoutedWireElm | Pending |
| `180` | 0 | TriStateElm | Pending |
| `186` | 0 | PisoShiftElm | Pending |
| `188` | 0 | SeqGenElm | Pending |
| `189` | 0 | SipoShiftElm | Pending |
| `194` | 0 | MonostableElm | Pending |
| `195` | 0 | HalfAdderElm | Pending |
| `196` | 0 | FullAdderElm | Pending |
| `197` | 0 | SevenSegDecoderElm | Pending |
| `200` | 0 | AMElm | Pending |
| `201` | 0 | FMElm | Pending |
| `209` | 0 | PolarCapacitorElm | Pending |
| `210` | 0 | DataRecorderElm | Pending |
| `214` | 0 | CCVSElm | Pending |
| `215` | 0 | CCCSElm | Pending |
| `216` | 0 | OhmMeterElm | Pending |
| `350` | 0 | ThermistorNTCElm | Pending |
| `368` | 0 | TestPointElm | Pending |
| `374` | 0 | LDRElm | Pending |
| `401` | 0 | ComparatorElm | Pending |
| `404` | 0 | FuseElm | Pending |
| `406` | 0 | CustomTransformerElm | Pending |
| `407` | 0 | OptocouplerElm | Pending |
| `408` | 0 | StopTriggerElm | Pending |
| `409` | 0 | OpAmpRealElm | Pending |
| `410` | 0 | CustomCompositeElm | Pending |
| `411` | 0 | AudioInputElm | Pending |
| `412` | 0 | CrystalElm | Pending |
| `413` | 0 | SRAMElm | Pending |
| `414` | 0 | TimeDelayRelayElm | Pending |
| `415` | 0 | DCMotorElm | Pending |
| `416` | 0 | MBBSwitchElm | Pending |
| `420` | 0 | WattmeterElm | Pending |
| `421` | 0 | Counter2Elm | Pending |
| `422` | 0 | DelayBufferElm | Pending |
| `424` | 0 | DataInputElm | Pending |
| `429` | 0 | DPDTSwitchElm | Base model only |
| `431` | 0 | XnorGateElm | Pending |
| `432` | 0 | AnalogMuxElm | Pending |
| `433` | 0 | BusSplitterElm | Pending |
| `436` | 0 | ROMElm | Pending |

## Scope and migration order

1. Components first: retain the verified models and expand remaining component families.
   Legacy text import is explicitly deferred by user direction (2026-11-14).
2. Polarized capacitors, remaining switch variants, tapped/saturating transformers and other analog devices.
3. Broader transistor variants, named model data and configurable model options.
4. Logic gates, sequential devices, chips and mixed-signal elements.
5. Custom/composite devices, behavioral sources, specialized and interactive devices.
6. Deferred: legacy import and example chooser preserving all category paths; retain unavailable entries with explicit
   reasons until their dependencies are supported. Restore saved scopes/annotations where possible.

Each family needs document schema, symbol/pin geometry, properties, compiler/result mapping
and worker-safe initialization. Keep the existing numerical implementations. Do not remove
the worker loader whitelist wholesale: constructors may still depend on the old UI.

Full example-level record counts, categories and dependencies are in `LEGACY-CATALOG.json`.
