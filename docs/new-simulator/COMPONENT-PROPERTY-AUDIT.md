# Component property parity inventory

Bundled Falstad fork, all menu classes. Dump-type matches are candidates, not proof of equivalent behavior. Includes inherited options; conditional/dynamic labels and model dialogs require manual review. No row is marked complete by this inventory.

Regenerate with `node tools/audit_component_properties.mjs`.

136 original menu classes; 49 without a matching React dump type.

| Original class | React candidates | Original editor options (including inherited) | React parameters | Status |
|---|---|---|---|---|
| ACRailElm | noiseSource, voltageRail | Waveform; DC Offset (V); Internal Resistance (ohms); Show Voltage; Circle Symbol; Specify As; High Time (s); Frequency (Hz); Phase Offset (degrees); Low Time (s); Duty Cycle; Rise/Fall Time (s) | noiseSource: amplitude, offset; voltageRail: waveform | Review required |
| ACVoltageElm | voltageSource | Waveform; DC Offset (V); Internal Resistance (ohms); Show Voltage; Circle Symbol; Specify As; High Time (s); Frequency (Hz); Phase Offset (degrees); Low Time (s); Duty Cycle; Rise/Fall Time (s) | voltageSource: waveform | Review required |
| ADCElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| AMElm | amSource | Max Voltage; Carrier Frequency (Hz); Signal Frequency (Hz) | amSource: carrierFrequency, signalFrequency, amplitude | Review required |
| AmmeterElm | ammeter | Value; Scale; Circular Symbol | ammeter: mode | Review required |
| AnalogMuxElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| AnalogSwitch2Elm | analogSpdtSwitch | Normally closed; On Resistance (ohms); Off Resistance (ohms); Pulldown Resistor; Threshold | analogSpdtSwitch: onResistance, offResistance, threshold, inverted, pulldown | Review required |
| AnalogSwitchElm | analogSwitch | Normally closed; On Resistance (ohms); Off Resistance (ohms); Pulldown Resistor; Threshold | analogSwitch: onResistance, offResistance, threshold, inverted, pulldown | Review required |
| AndGateElm | andGate | # of Inputs; High Logic Voltage; Schmitt Inputs; Invert Inputs; Propagation Delay (s) | andGate: highVoltage, inputCount, propagationDelay, schmittInputs, invertInputs | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| AntennaElm | antennaSource | Waveform; DC Offset (V); Internal Resistance (ohms); Show Voltage; Circle Symbol; Specify As; High Time (s); Frequency (Hz); Phase Offset (degrees); Low Time (s); Duty Cycle; Rise/Fall Time (s) | antennaSource:  | Review required |
| AudioInputElm |  | Max Voltage; Start Position (s); Waveform; DC Offset (V); Internal Resistance (ohms); Show Voltage; Circle Symbol; Specify As; High Time (s); Frequency (Hz); Phase Offset (degrees); Low Time (s); Duty Cycle; Rise/Fall Time (s) |  | Missing React component |
| AudioOutputElm | audioOutput | Duration (s); Sampling Rate | audioOutput: duration, sampleRate | Review required |
| BoxElm | box |  | box: width, height | Review required |
| BusLogicInputElm |  | Bus Width; Value; High Voltage; Low Voltage; Momentary Switch; IEC Symbol; Label (for linking); On Resistance (ohms) |  | Missing React component |
| BusSplitterElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| BusTransceiverElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| CC2Elm |  | High Logic Voltage; Bit Order |  | Missing React component |
| CCCSElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| CCVSElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| CapacitorElm | capacitor | Capacitance (F); Trapezoidal Approximation; Initial Voltage (on Reset); Series Resistance | capacitor: capacitance, initialVoltage, integration | Review required |
| ClockElm | noiseSource, voltageRail | Waveform; DC Offset (V); Internal Resistance (ohms); Show Voltage; Circle Symbol; Specify As; High Time (s); Frequency (Hz); Phase Offset (degrees); Low Time (s); Duty Cycle; Rise/Fall Time (s) | noiseSource: amplitude, offset; voltageRail: waveform | Review required |
| ComparatorElm |  |  |  | Missing React component |
| Counter2Elm |  | High Logic Voltage; Bit Order |  | Missing React component |
| CounterElm | counter | High Logic Voltage; Bit Order | counter: highVoltage, initialValue, modulus, invertReset, negativeEdge | Confirmed gaps: Variable bit width and bit order |
| CrossSwitchElm |  | IEC Symbol; On Resistance (ohms); Momentary Switch; Label (for linking) |  | Missing React component |
| CrystalElm |  | Series Capacitance (F); Inductance (H); Resistance (; Show Frequency |  | Missing React component |
| CurrentElm | currentSource | Current (A); Max Voltage (V, 0=unlimited) | currentSource: current, maxVoltage | Review required |
| CustomCompositeElm |  | Edit Pin Layout; View Components; High Logic Voltage (0=default); Edit Model |  | Missing React component |
| CustomTransformerElm | customTransformer | Base Inductance (H); Coupling Coefficient; Trapezoidal Approximation | customTransformer: inductance, coupling, turns1, turns2, turns3, integration | Review required |
| DACElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| DCMotorElm | dcMotor | Armature inductance (H); Armature Resistance (ohms); Torque constant (Nm/A); Moment of inertia (Kg.m^2); Friction coefficient (Nms/rad); Gear Ratio | dcMotor: inductance, resistance, torqueConstant, backEmfConstant, inertia, friction, gearRatio, loadTorque | Review required |
| DCVoltageElm | voltageSource | Waveform; DC Offset (V); Internal Resistance (ohms); Show Voltage; Circle Symbol; Specify As; High Time (s); Frequency (Hz); Phase Offset (degrees); Low Time (s); Duty Cycle; Rise/Fall Time (s) | voltageSource: waveform | Review required |
| DFlipFlopElm | dFlipFlop | High Logic Voltage; Bit Order | dFlipFlop: highVoltage, initialState | Confirmed gaps: Set/reset pins and bit order |
| DPDTSwitchElm | dpdtSwitch | # of Poles; IEC Symbol; On Resistance (ohms); Momentary Switch; Label (for linking) | dpdtSwitch: onResistance, momentary, linkLabel, iecSymbol, poleCount, position | Confirmed gaps: Keyboard shortcut |
| DataInputElm |  | Scale Factor; Sample Length (s); Repeat; Waveform; DC Offset (V); Internal Resistance (ohms); Show Voltage; Circle Symbol; Specify As; High Time (s); Frequency (Hz); Phase Offset (degrees); Low Time (s); Duty Cycle; Rise/Fall Time (s) |  | Missing React component |
| DataRecorderElm | dataExport | # of Data Points | dataExport: capacity | Review required |
| DeMultiplexerElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| DecimalDisplayElm | decimalDisplay | High Logic Voltage; Bit Order | decimalDisplay: mode | Review required |
| DelayBufferElm |  | Delay (s); Threshold (V); High Logic Voltage |  | Missing React component |
| DiacElm | diac | On resistance (ohms); Off resistance (ohms); Breakdown voltage (volts); Hold current (amps) | diac: onResistance, offResistance, breakdownVoltage, holdingCurrent | Review required |
| DiodeElm | diode | Model; Create New Simple Model; Create New Advanced Model; Edit Model | diode: model | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| ExtVoltageElm |  | Name; Waveform; DC Offset (V); Internal Resistance (ohms); Show Voltage; Circle Symbol; Specify As; High Time (s); Frequency (Hz); Phase Offset (degrees); Low Time (s); Duty Cycle; Rise/Fall Time (s) |  | Missing React component |
| FMElm | fmSource | Max Voltage; Carrier Frequency (Hz); Signal Frequency (Hz); Deviation (Hz) | fmSource: carrierFrequency, signalFrequency, amplitude, deviation | Review required |
| FullAdderElm | fullAdder | High Logic Voltage; Bit Order | fullAdder: highVoltage | Review required |
| FuseElm | fuse | I2t; Resistance; IEC Symbol | fuse: resistance, i2t | Review required |
| GroundElm | ground | Symbol | ground:  | Review required |
| GyratorElm |  | Gyration Resistance (\u2126) |  | Missing React component |
| HalfAdderElm | halfAdder | High Logic Voltage; Bit Order | halfAdder: highVoltage | Review required |
| InductorElm | inductor | Inductance (H); Trapezoidal Approximation; Initial Current (on Reset) (A); Saturation Current (A) (0=none) | inductor: inductance, initialCurrent, integration | Review required |
| InstructionDisplayElm |  | Bus Width; Threshold Voltage; Lookup Table |  | Missing React component |
| InverterElm | inverter | Slew Rate (V/ns); High Logic Voltage | inverter: highVoltage, slewRate | Review required |
| InvertingSchmittElm | invertingSchmittTrigger | Lower threshold (V); Upper threshold (V); Slew Rate (V/ns); High Logic Voltage; Low Voltage (V) | invertingSchmittTrigger: slewRate, lowerThreshold, upperThreshold, highVoltage, lowVoltage | Review required |
| JKFlipFlopElm | jkFlipFlop | High Logic Voltage; Bit Order | jkFlipFlop: highVoltage, initialState, positiveEdge | Confirmed gaps: Reset pin and bit order |
| LDRElm | photoresistor | Slider Text | photoresistor: position | Review required |
| LEDArrayElm | ledArray | High Logic Voltage; Bit Order | ledArray:  | Review required |
| LEDElm | led | Red Value (0-1); Green Value (0-1); Blue Value (0-1); Max Brightness Current (A); Model; Create New Simple Model; Create New Advanced Model; Edit Model | led: model, red, green, blue, maxCurrent | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| LabeledNodeElm | labeledNode | Text; Internal Node; Rotate Text When Vertical | labeledNode: name | Review required |
| LampElm | lamp | Nominal Power; Nominal Voltage; Warmup Time (s); Cooldown Time (s) | lamp: nominalPower, nominalVoltage, warmTime, coolTime, initialTemperature | Review required |
| LatchElm | latch | High Logic Voltage; Bit Order | latch: highVoltage, initialValue, edgeTriggered | Review required |
| LineElm | line |  | line: width, height | Review required |
| LogicInputElm | logicInput | Momentary Switch; High Logic Voltage; Low Voltage; Numeric; Ternary; IEC Symbol; Label (for linking); On Resistance (ohms) | logicInput: state, highVoltage, lowVoltage, mode | Review required |
| LogicOutputElm | logicOutput | Threshold; Current Required; Numeric; Ternary | logicOutput: threshold, mode, pulldown | Review required |
| MBBSwitchElm | mbbSwitch | Switch Group; On Resistance (ohms); Momentary Switch; IEC Symbol; Label (for linking) | mbbSwitch: onResistance, momentary, linkLabel, iecSymbol, group, position | Confirmed gaps: Keyboard shortcut |
| MemristorElm | memristor | Min Resistance (ohms); Max Resistance (ohms); Width of Doped Region (nm); Total Width (nm); Mobility (um^2/(s*V)) | memristor: onResistance, offResistance, initialDopedWidth, totalWidth, mobility | Review required |
| MonostableElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| MotorProtectionSwitchElm |  | I2t; On Resistance; Label (for linking) |  | Missing React component |
| MultiplexerElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| NDarlingtonElm |  |  |  | Missing React component |
| NJfetElm | njfet, pjfet | Threshold Voltage; Show Bulk; Swap D/S; Digital Symbol; Simulate Body Diode; Body Terminal; Show Body Diode | njfet: threshold, beta; pjfet: threshold, beta | Review required |
| NMosfetElm | nmos, pmos | Threshold Voltage; Show Bulk; Swap D/S; Digital Symbol; Simulate Body Diode; Body Terminal; Show Body Diode | nmos: threshold, beta, bodyDiode, bodyTerminal, showBulk, digitalSymbol, showBodyDiode, swapTerminals; pmos: threshold, beta, bodyDiode, bodyTerminal, showBulk, digitalSymbol, showBodyDiode, swapTerminals | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| NTransistorElm | npn, pnp | Beta/hFE; Swap E/C; Draw Circle; Model; Create New Model; Edit Model | npn: beta, model, swapTerminals, drawCircle; pnp: beta, model, swapTerminals, drawCircle | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| NandGateElm | nandGate | # of Inputs; High Logic Voltage; Schmitt Inputs; Invert Inputs; Propagation Delay (s) | nandGate: highVoltage, inputCount, propagationDelay, schmittInputs, invertInputs | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| NoiseElm | noiseSource, voltageRail | Waveform; DC Offset (V); Internal Resistance (ohms); Show Voltage; Circle Symbol; Specify As; High Time (s); Frequency (Hz); Phase Offset (degrees); Low Time (s); Duty Cycle; Rise/Fall Time (s) | noiseSource: amplitude, offset; voltageRail: waveform | Review required |
| NorGateElm | norGate | # of Inputs; High Logic Voltage; Schmitt Inputs; Invert Inputs; Propagation Delay (s) | norGate: highVoltage, inputCount, propagationDelay, schmittInputs, invertInputs | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| OTAElm |  | Positive Supply Voltage (5-20V); Negative Supply Voltage (V) |  | Missing React component |
| OhmMeterElm | ohmmeter | Current (A); Max Voltage (V, 0=unlimited) | ohmmeter: current, maxVoltage | Review required |
| OpAmpElm | opamp | Max Output (V); Min Output (V); Gain | opamp: gain, minOutput, maxOutput | Review required |
| OpAmpRealElm |  | Swap Inputs; Slew Rate (V/usec); Output Current Limit (A) |  | Missing React component |
| OpAmpSwapElm | opamp | Max Output (V); Min Output (V); Gain | opamp: gain, minOutput, maxOutput | Review required |
| OptocouplerElm |  | CTR Scale; LED Model |  | Missing React component |
| OrGateElm | orGate | # of Inputs; High Logic Voltage; Schmitt Inputs; Invert Inputs; Propagation Delay (s) | orGate: highVoltage, inputCount, propagationDelay, schmittInputs, invertInputs | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| OutputElm | output | Show Voltage; Scale; Fixed Precision | output: showVoltage | Review required |
| PDarlingtonElm |  |  |  | Missing React component |
| PMosfetElm | nmos, pmos | Threshold Voltage; Show Bulk; Swap D/S; Digital Symbol; Simulate Body Diode; Body Terminal; Show Body Diode | nmos: threshold, beta, bodyDiode, bodyTerminal, showBulk, digitalSymbol, showBodyDiode, swapTerminals; pmos: threshold, beta, bodyDiode, bodyTerminal, showBulk, digitalSymbol, showBodyDiode, swapTerminals | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| PTransistorElm | npn, pnp | Beta/hFE; Swap E/C; Draw Circle; Model; Create New Model; Edit Model | npn: beta, model, swapTerminals, drawCircle; pnp: beta, model, swapTerminals, drawCircle | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| PhaseCompElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| PisoShiftElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| PolarCapacitorElm | polarizedCapacitor | Max Reverse Voltage; Capacitance (F); Trapezoidal Approximation; Initial Voltage (on Reset); Series Resistance | polarizedCapacitor: capacitance, initialVoltage, integration, maxReverseVoltage | Review required |
| PotElm | potentiometer | Resistance (ohms); Slider Text; Show Values; Group Number (for linking) | potentiometer: resistance, position, label | Review required |
| ProbeElm | voltmeter | Show Value; Value; Scale; Use Circle Symbol; Series Resistance (0 = infinite) | voltmeter: mode, resistance | Review required |
| PushSwitchElm | pushSwitch, switch | Momentary Switch; IEC Symbol; Label (for linking); On Resistance (ohms) | pushSwitch: onResistance, momentary, linkLabel, iecSymbol, normallyClosed; switch: onResistance, momentary, linkLabel, iecSymbol, closed | Confirmed gaps: Keyboard shortcut |
| ROMElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| RailElm | noiseSource, voltageRail | Waveform; DC Offset (V); Internal Resistance (ohms); Show Voltage; Circle Symbol; Specify As; High Time (s); Frequency (Hz); Phase Offset (degrees); Low Time (s); Duty Cycle; Rise/Fall Time (s) | noiseSource: amplitude, offset; voltageRail: waveform | Review required |
| RelayCoilElm |  | Type; Inductance (H); On Current (A); Off Current (A); Coil Resistance (ohms); Switching Time (s); Label (for linking) |  | Missing React component |
| RelayContactElm |  | On Resistance (ohms); Off Resistance (ohms); Label (for linking); Normally Closed; IEC Symbol |  | Missing React component |
| RelayElm |  | Model; Create New Model; Edit Model |  | Missing React component |
| ResistorElm | resistor | Resistance (ohms) | resistor: resistance | Review required |
| RoutedWireElm |  | Show Current; Show Voltage; Show Bus Value; Show Bus Value (Hex) |  | Missing React component |
| SCRElm | scr | Trigger Current (A); Holding Current (A); Gate Resistance (ohms) | scr: triggerCurrent, holdingCurrent, gateResistance | Review required |
| SRAMElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| SchmittElm | schmittTrigger | Lower threshold (V); Upper threshold (V); Slew Rate (V/ns); High Logic Voltage; Low Voltage (V) | schmittTrigger: slewRate, lowerThreshold, upperThreshold, highVoltage, lowVoltage | Review required |
| SeqGenElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| SevenSegDecoderElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| SevenSegElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| SipoShiftElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| SparkGapElm | sparkGap | On resistance (ohms); Off resistance (ohms); Breakdown voltage; Holding current (A) | sparkGap: onResistance, offResistance, breakdownVoltage, holdingCurrent | Review required |
| SquareRailElm | noiseSource, voltageRail | Waveform; DC Offset (V); Internal Resistance (ohms); Show Voltage; Circle Symbol; Specify As; High Time (s); Frequency (Hz); Phase Offset (degrees); Low Time (s); Duty Cycle; Rise/Fall Time (s) | noiseSource: amplitude, offset; voltageRail: waveform | Review required |
| StopTriggerElm | stopTrigger | Voltage; Trigger Type; Delay (s) | stopTrigger: threshold, direction, delay | Review required |
| SweepElm | sweepSource | Min Frequency (Hz); Max Frequency (Hz); Sweep Time (s); Logarithmic; Max Voltage; Bidirectional | sweepSource: minFrequency, maxFrequency, amplitude, sweepTime, logarithmic, bidirectional | Review required |
| Switch2Elm | spdtSwitch | Center Off; Group Number (for linking); # of Throws; Momentary Switch; IEC Symbol; Label (for linking); On Resistance (ohms) | spdtSwitch: onResistance, momentary, linkLabel, iecSymbol, group, throwCount, centerOff, position | Confirmed gaps: Keyboard shortcut |
| SwitchElm | pushSwitch, switch | Momentary Switch; IEC Symbol; Label (for linking); On Resistance (ohms) | pushSwitch: onResistance, momentary, linkLabel, iecSymbol, normallyClosed; switch: onResistance, momentary, linkLabel, iecSymbol, closed | Confirmed gaps: Keyboard shortcut |
| TFlipFlopElm | tFlipFlop | High Logic Voltage; Bit Order | tFlipFlop: highVoltage, initialState | Confirmed gaps: Set/reset pins and bit order |
| TappedTransformerElm | tappedTransformer | Primary Inductance (H); Ratio (N1/N2); Coupling Coefficient; Trapezoidal Approximation | tappedTransformer: inductance, ratio, coupling, integration | Review required |
| TestPointElm | testPoint | Value; Label | testPoint: mode, label | Review required |
| TextElm | text | Text; Size; Draw Bar On Top | text: text, size, drawBar | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| ThermistorNTCElm | thermistor | R at 25\u00b0C; R at 50\u00b0C; Slider min temp (\u00b0C); Slider max temp (\u00b0C); Slider Text | thermistor: resistance25, resistance50, minTemperature, maxTemperature, position | Review required |
| ThreePhaseMotorElm | threePhaseMotor | Stator Inductance (H); Rotor Inductance (H); Coupling Coefficient; Stator Resistance (ohms); Rotor Resistance (ohms); Friction coefficient (Nms/rad); Moment of inertia (Kg.m^2) | threePhaseMotor: statorResistance, rotorResistance, statorInductance, rotorInductance, mutualInductance, friction, inertia | Review required |
| TimeDelayRelayElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| TimerElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| TransLineElm | transmissionLine | Delay (s); Impedance (ohms) | transmissionLine: delay, impedance | Review required |
| TransformerElm | transformer | Primary Inductance (H); Ratio (N1/N2); Coupling Coefficient; Trapezoidal Approximation; Swap Secondary Polarity; Saturation Current (A) (0=none) | transformer: inductance, ratio, coupling, integration | Review required |
| TriStateElm |  | On Resistance (ohms); Off Resistance (ohms); Output Pulldown Resistance (ohms); High Logic Voltage; Bus Width |  | Missing React component |
| TriacElm | triac | Trigger Current (A); Holding Current (A); Gate-MT1 Resistance (ohms) | triac: triggerCurrent, holdingCurrent, gateResistance | Review required |
| TriodeElm | triode | mu; kg1 | triode: mu, kg1 | Review required |
| TunnelDiodeElm | tunnelDiode |  | tunnelDiode:  | Review required |
| UnijunctionElm |  |  |  | Missing React component |
| VCCSElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| VCOElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| VCVSElm |  | High Logic Voltage; Bit Order |  | Missing React component |
| VarRailElm | variableVoltage | Min Voltage; Max Voltage; Slider Text; Waveform; DC Offset (V); Internal Resistance (ohms); Show Voltage; Circle Symbol; Specify As; High Time (s); Frequency (Hz); Phase Offset (degrees); Low Time (s); Duty Cycle; Rise/Fall Time (s) | variableVoltage: minVoltage, maxVoltage, voltage, label | Review required |
| VaractorElm | varactor | Capacitance @ 0V (F); Model; Create New Simple Model; Create New Advanced Model; Edit Model | varactor: capacitance | Review required |
| WattmeterElm | wattmeter | Value | wattmeter: mode | Review required |
| WireElm |  | Show Current; Show Voltage; Show Bus Value; Show Bus Value (Hex) |  | Missing React component |
| XnorGateElm | xnorGate | # of Inputs; High Logic Voltage; Schmitt Inputs; Invert Inputs; Propagation Delay (s) | xnorGate: highVoltage, inputCount, propagationDelay, schmittInputs, invertInputs | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| XorGateElm | xorGate | # of Inputs; High Logic Voltage; Schmitt Inputs; Invert Inputs; Propagation Delay (s) | xorGate: highVoltage, inputCount, propagationDelay, schmittInputs, invertInputs | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
| ZenerElm | zener | Model; Create New Simple Model; Create New Advanced Model; Edit Model | zener: model | Properties implemented; bundled-source review recorded in PROPERTY-PARITY.md |
