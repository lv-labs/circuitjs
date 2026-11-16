'use strict';
// Menu availability is separate from the generated legacy names and hierarchy.
(() => {
  const tools = {
    VarRailElm:'variableVoltage', LampElm:'lamp', TextElm:'text', BoxElm:'box', LineElm:'line', LabeledNodeElm:'labeledNode', ProbeElm:'voltmeter', OhmMeterElm:'ohmmeter', AmmeterElm:'ammeter', WattmeterElm:'wattmeter', TestPointElm:'testPoint', DecimalDisplayElm:'decimalDisplay', InstructionDisplayElm:'instructionDisplay', LEDArrayElm:'ledArray', DataRecorderElm:'dataExport', AudioOutputElm:'audioOutput', StopTriggerElm:'stopTrigger', DCMotorElm:'dcMotor', ThreePhaseMotorElm:'threePhaseMotor', WireElm:'wire', ResistorElm:'resistor', CapacitorElm:'capacitor', PolarCapacitorElm:'polarizedCapacitor',
    InductorElm:'inductor', PushSwitchElm:'pushSwitch', MBBSwitchElm:'mbbSwitch', TappedTransformerElm:'tappedTransformer', CustomTransformerElm:'customTransformer', TransLineElm:'transmissionLine', SwitchElm:'switch', Switch2Elm:'spdtSwitch', DPDTSwitchElm:'dpdtSwitch',
    PotElm:'potentiometer', TransformerElm:'transformer', GroundElm:'ground', DCVoltageElm:'voltageSource',
    ACVoltageElm:'acSource', RailElm:'voltageRail', ACRailElm:'acRail', SquareRailElm:'squareRail', ClockElm:'clockRail',
    CurrentElm:'currentSource', OutputElm:'output', LEDElm:'led', DiodeElm:'diode', ZenerElm:'zener',
    NTransistorElm:'npn', PTransistorElm:'pnp', NMosfetElm:'nmos', PMosfetElm:'pmos', NJfetElm:'njfet', PJfetElm:'pjfet',
    OpAmpElm:'opamp', OpAmpSwapElm:'opampPlusTop', AnalogSwitchElm:'analogSwitch', AnalogSwitch2Elm:'analogSpdtSwitch',
    LogicInputElm:'logicInput', LogicOutputElm:'logicOutput', InverterElm:'inverter', AndGateElm:'andGate',
    NandGateElm:'nandGate', OrGateElm:'orGate', NorGateElm:'norGate', XorGateElm:'xorGate',
    DFlipFlopElm:'dFlipFlop', JKFlipFlopElm:'jkFlipFlop', TFlipFlopElm:'tFlipFlop',
    CounterElm:'counter', LatchElm:'latch', HalfAdderElm:'halfAdder', FullAdderElm:'fullAdder', Select:'select'
  };
  function entries(definitions) {
    const visit = entry => {
      if(entry.children)return {...entry,children:entry.children.map(visit)};
      const tool=tools[entry.legacyClass];
      const available=tool==='wire'||tool==='select'||!!definitions[tool];
      return {...entry,tool:available?tool:null,available,reason:available?'':'Not available in the new simulator yet'};
    };
    return CircuitLegacyComponentMenu.map(visit);
  }
  globalThis.CircuitComponentMenu={entries};
})();
