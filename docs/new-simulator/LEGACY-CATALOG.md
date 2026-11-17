# Bundled Falstad catalog inventory

Generated with `python3 tools/inventory_legacy_catalog.py`. This is a static source inventory,
not a runtime compatibility result. Full parity targets the bundled fork first;
matching newer upstream releases requires a separate upstream comparison.

- 140 distinct element class names referenced by the legacy menu.
- 150 element subclasses found in source (includes base classes and aliases).
- 125 statically resolved serialized element types.
- 374 bundled circuit text files; 368 menu entries.
- 0 menu files missing from the bundled circuit directory.

The new editor has 84 component models plus wires. No legacy text importer exists yet.
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
| `O` | 108 | OutputElm | Base model only |
| `v` | 77 | ACVoltageElm, DCVoltageElm, VoltageElm | Base model only |
| `L` | 67 | LogicInputElm | Base model only |
| `M` | 66 | LogicOutputElm | Base model only |
| `a` | 59 | OpAmpElm, OpAmpSwapElm | Base model only |
| `l` | 50 | InductorElm | Base model only |
| `t` | 50 | NTransistorElm, PTransistorElm, TransistorElm | Base model only |
| `x` | 48 | TextElm | Base model only |
| `f` | 43 | MosfetElm, NMosfetElm, PMosfetElm | Base model only |
| `d` | 38 | DiodeElm | Base model only |
| `s` | 28 | PushSwitchElm, SwitchElm | Base model only |
| `I` | 23 | InverterElm | Base model only |
| `p` | 21 | ProbeElm | Base model only |
| `172` | 20 | VarRailElm | Base model only |
| `170` | 17 | SweepElm | Base model only |
| `150` | 14 | AndGateElm | Base model only |
| `174` | 14 | PotElm | Base model only |
| `211` | 13 | AudioOutputElm | Base model only |
| `S` | 12 | Switch2Elm | Base model only |
| `151` | 10 | NandGateElm | Base model only |
| `165` | 10 | TimerElm | Pending |
| `171` | 10 | TransLineElm | Base model only |
| `178` | 9 | RelayElm | Pending |
| `i` | 9 | CurrentElm | Base model only |
| `155` | 8 | DFlipFlopElm | Base model only |
| `179` | 8 | CC2Elm | Pending |
| `T` | 8 | TransformerElm | Base model only |
| `j` | 8 | JfetElm, NJfetElm | Base model only |
| `154` | 7 | XorGateElm | Base model only |
| `156` | 7 | JKFlipFlopElm | Base model only |
| `419` | 7 | DecimalDisplayElm | Base model only |
| `m` | 7 | MemristorElm | Base model only |
| `152` | 6 | OrGateElm | Base model only |
| `159` | 6 | AnalogSwitchElm | Base model only |
| `153` | 5 | NorGateElm | Base model only |
| `162` | 5 | LEDElm | Base model only |
| `z` | 5 | ZenerElm | Base model only |
| `160` | 4 | AnalogSwitch2Elm | Base model only |
| `164` | 4 | CounterElm | Base model only |
| `207` | 4 | LabeledNodeElm | Base model only |
| `402` | 4 | OTAElm | Pending |
| `418` | 4 | ExtVoltageElm | Pending |
| `163` | 3 | RingCounterElm | Pending |
| `175` | 3 | TunnelDiodeElm | Base model only |
| `181` | 3 | LampElm | Base model only |
| `187` | 3 | SparkGapElm | Base model only |
| `426` | 3 | RelayContactElm | Pending |
| `166` | 2 | DACElm | Pending |
| `167` | 2 | ADCElm | Pending |
| `168` | 2 | LatchElm | Base model only |
| `173` | 2 | TriodeElm | Base model only |
| `176` | 2 | VaractorElm | Base model only |
| `177` | 2 | SCRElm | Base model only |
| `400` | 2 | DarlingtonElm, NDarlingtonElm, PDarlingtonElm | Pending |
| `403` | 2 | ScopeElm | Pending |
| `425` | 2 | RelayCoilElm | Pending |
| `157` | 1 | SevenSegElm | Pending |
| `158` | 1 | VCOElm | Pending |
| `161` | 1 | PhaseCompElm | Pending |
| `169` | 1 | TappedTransformerElm | Base model only |
| `182` | 1 | SchmittElm | Base model only |
| `183` | 1 | InvertingSchmittElm | Base model only |
| `184` | 1 | MultiplexerElm | Pending |
| `185` | 1 | DeMultiplexerElm | Pending |
| `193` | 1 | TFlipFlopElm | Base model only |
| `203` | 1 | DiacElm | Base model only |
| `206` | 1 | TriacElm | Base model only |
| `208` | 1 | CustomLogicElm | Pending |
| `212` | 1 | VCVSElm | Pending |
| `213` | 1 | VCCSElm | Pending |
| `370` | 1 | AmmeterElm | Base model only |
| `405` | 1 | LEDArrayElm | Base model only |
| `417` | 1 | UnijunctionElm | Pending |
| `423` | 1 | LineElm | Base model only |
| `427` | 1 | ThreePhaseMotorElm | Base model only |
| `428` | 1 | MotorProtectionSwitchElm | Pending |
| `430` | 1 | CrossSwitchElm | Pending |
| `A` | 1 | AntennaElm | Base model only |
| `b` | 1 | BoxElm | Base model only |
| `0` | 0 | BusLogicInputElm, RoutedWireElm | Pending |
| `180` | 0 | TriStateElm | Pending |
| `186` | 0 | PisoShiftElm | Pending |
| `188` | 0 | SeqGenElm | Pending |
| `189` | 0 | SipoShiftElm | Pending |
| `194` | 0 | MonostableElm | Pending |
| `195` | 0 | HalfAdderElm | Base model only |
| `196` | 0 | FullAdderElm | Base model only |
| `197` | 0 | SevenSegDecoderElm | Pending |
| `200` | 0 | AMElm | Base model only |
| `201` | 0 | FMElm | Base model only |
| `209` | 0 | PolarCapacitorElm | Base model only |
| `210` | 0 | DataRecorderElm | Base model only |
| `214` | 0 | CCVSElm | Pending |
| `215` | 0 | CCCSElm | Pending |
| `216` | 0 | OhmMeterElm | Base model only |
| `350` | 0 | ThermistorNTCElm | Base model only |
| `368` | 0 | TestPointElm | Base model only |
| `374` | 0 | LDRElm | Base model only |
| `401` | 0 | ComparatorElm | Pending |
| `404` | 0 | FuseElm | Base model only |
| `406` | 0 | CustomTransformerElm | Base model only |
| `407` | 0 | OptocouplerElm | Pending |
| `408` | 0 | StopTriggerElm | Base model only |
| `409` | 0 | OpAmpRealElm | Pending |
| `410` | 0 | CustomCompositeElm | Pending |
| `411` | 0 | AudioInputElm | Pending |
| `412` | 0 | CrystalElm | Pending |
| `413` | 0 | SRAMElm | Pending |
| `414` | 0 | TimeDelayRelayElm | Pending |
| `415` | 0 | DCMotorElm | Base model only |
| `416` | 0 | MBBSwitchElm | Base model only |
| `420` | 0 | WattmeterElm | Base model only |
| `421` | 0 | Counter2Elm | Pending |
| `422` | 0 | DelayBufferElm | Pending |
| `424` | 0 | DataInputElm | Pending |
| `429` | 0 | DPDTSwitchElm | Base model only |
| `431` | 0 | XnorGateElm | Base model only |
| `432` | 0 | AnalogMuxElm | Pending |
| `433` | 0 | BusSplitterElm | Pending |
| `436` | 0 | ROMElm | Pending |

## Scope and migration order

1. Continue toward full component coverage for the bundled Falstad fork. See PLAN.md for menu coverage.
2. Defer audio and data import/export workflows for redesign.
3. Broaden supported variants, named model libraries and configurable options as models are added.
4. Legacy circuit import and the example chooser remain separate from component coverage.

Each family needs document schema, symbol/pin geometry, properties, compiler/result mapping
and worker-safe initialization. Keep the existing numerical implementations. Do not remove
the worker loader whitelist wholesale: constructors may still depend on the old UI.

Full example-level record counts, categories and dependencies are in `LEGACY-CATALOG.json`.
