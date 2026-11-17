'use strict';
// Portable computation module: no DOM, renderer, storage or worker construction.
(() => {
  const registry=globalThis.CircuitCoreModules ||= {};
  const Catalog=typeof module==='object'&&module.exports?require('./catalog.js'):registry.catalog;
  const {definitions,outputSpecs,validateOutput,validWaveform}=Catalog;
  function validate(document) {
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    assert(document?.schemaVersion === 1 && typeof document.id === 'string' && document.id.length > 0 && typeof document.title === 'string', 'Expected a version 1 circuit document');
    const e = document.electrical, l = document.layout;
    assert(e && l && Array.isArray(e.components) && Array.isArray(e.junctions) && Array.isArray(e.wires), 'Missing circuit graph or layout');
    for (const map of [l.components, l.junctions, l.wires]) assert(map && typeof map === 'object' && !Array.isArray(map), 'Missing layout maps');
    const ids = items => { const set = new Set(); for (const item of items) { assert(item && typeof item.id === 'string' && item.id && !set.has(item.id), 'Missing or duplicate ID'); set.add(item.id); } return set; };
    const components = ids(e.components), junctions = ids(e.junctions); ids(e.wires);
    const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
    for (const c of e.components) {
      assert(Object.hasOwn(definitions, c.kind) && c.modelVersion === 1, 'Unsupported editor component model');
      const p = l.components?.[c.id]; assert(point(p) && [0, 90, 180, 270].includes(p.rotation) && typeof p.mirror === 'boolean', 'Invalid component pose');
      assert((!Object.hasOwn(c, 'reference') || typeof c.reference === 'string') && c.parameters && typeof c.parameters === 'object', 'Invalid component reference or parameters');
      const v = c.parameters;
      if (c.kind === 'resistor') assert(Number.isFinite(v.resistance) && v.resistance > 0, 'Resistance must be positive');
      if (['npn', 'pnp'].includes(c.kind)) assert(Number.isFinite(v.beta) && v.beta > 0, 'Transistor beta must be positive');
      if (['nmos', 'pmos', 'njfet', 'pjfet'].includes(c.kind)) assert(Number.isFinite(v.threshold) && Number.isFinite(v.beta) && v.beta > 0, 'Invalid FET parameters');
      if (['andGate', 'nandGate', 'orGate', 'norGate', 'xorGate', 'xnorGate', 'inverter'].includes(c.kind)) assert(Number.isFinite(v.highVoltage) && v.highVoltage > 0 && (c.kind !== 'inverter' || Number.isFinite(v.slewRate) && v.slewRate > 0), 'Invalid logic level or slew rate');
      if(outputSpecs[c.kind])validateOutput(c,document.simulation?.timeStep);
      if(c.kind==='pushSwitch')assert(typeof v.normallyClosed==='boolean','Invalid push-switch rest state');
      if(c.kind==='mbbSwitch')assert(Number.isInteger(v.position)&&v.position>=0&&v.position<=3,'Invalid MBB position');
      if(c.kind==='transmissionLine')assert(Number.isFinite(v.delay)&&v.delay>0&&Number.isFinite(v.impedance)&&v.impedance>0&&Number.isFinite(1/v.impedance),'Invalid transmission line');
      if(c.kind==='customTransformer')assert(Number.isFinite(v.inductance)&&v.inductance>0&&Number.isFinite(v.coupling)&&v.coupling>0&&v.coupling<1&&[v.turns1,v.turns2,v.turns3].every(n=>Number.isFinite(n)&&n!==0)&&['backwardEuler','trapezoidal'].includes(v.integration),'Invalid custom transformer');
      if (['transformer','tappedTransformer'].includes(c.kind)) assert(Number.isFinite(v.inductance) && v.inductance > 0 && Number.isFinite(v.ratio) && v.ratio > 0 && Number.isFinite(v.coupling) && v.coupling > 0 && v.coupling < 1 && ['backwardEuler', 'trapezoidal'].includes(v.integration), 'Transformer needs positive inductance/ratio and coupling strictly between 0 and 1');
      if (['spdtSwitch', 'dpdtSwitch'].includes(c.kind)) assert(Number.isInteger(v.position) && v.position >= 0 && v.position <= (c.kind === 'spdtSwitch' ? 2 : 1), 'Invalid switch position');
      if (['led', 'zener'].includes(c.kind)) assert(Number.isFinite(v.forwardVoltage) && v.forwardVoltage > 0 && Number.isFinite(c.kind === 'led' ? v.maxCurrent : v.breakdownVoltage) && (c.kind === 'led' ? v.maxCurrent : v.breakdownVoltage) > 0, 'Invalid diode parameters');
      if (c.kind === 'inductor') assert(Number.isFinite(v.inductance) && v.inductance > 0 && Number.isFinite(v.initialCurrent) && ['backwardEuler', 'trapezoidal'].includes(v.integration), 'Invalid inductor parameters');
      if (c.kind === 'currentSource') assert(Number.isFinite(v.current) && Number.isFinite(v.maxVoltage) && v.maxVoltage >= 0, 'Invalid current source parameters');
      if (c.kind === 'potentiometer') {
        assert(Number.isFinite(v.resistance) && v.resistance > 0 && Number.isFinite(v.position) && v.position >= 0 && v.position <= 1, 'Potentiometer position must be between 0 and 1');
        assert(!Object.hasOwn(v, 'label') || typeof v.label === 'string', 'Potentiometer slider label must be text');
      }
      if (c.kind === 'analogSwitch' || c.kind === 'analogSpdtSwitch') assert([v.onResistance, v.offResistance].every(r => Number.isFinite(r) && r > 0 && Number.isFinite(1 / r)) && Number.isFinite(v.threshold) && typeof v.inverted === 'boolean' && typeof v.pulldown === 'boolean', 'Invalid analog switch parameters');
      if (c.kind === 'output') assert(typeof v.showVoltage === 'boolean', 'Invalid output marker');
      if (c.kind === 'logicOutput') assert(Number.isFinite(v.threshold) && ['logic', 'numeric', 'ternary'].includes(v.mode) && typeof v.pulldown === 'boolean', 'Invalid logic output parameters');
      if (c.kind === 'logicInput') assert(['logic', 'numeric', 'ternary'].includes(v.mode) && Number.isInteger(v.state) && v.state >= 0 && v.state <= (v.mode === 'ternary' ? 2 : 1) && Number.isFinite(v.highVoltage) && Number.isFinite(v.lowVoltage) && Number.isFinite(v.highVoltage - v.lowVoltage), 'Invalid logic input state or voltage');
      if(['counter','latch','halfAdder','fullAdder'].includes(c.kind))assert(Number.isFinite(v.highVoltage)&&v.highVoltage>0,'Invalid chip logic voltage');
      if(['counter','latch'].includes(c.kind))assert(Number.isInteger(v.initialValue)&&v.initialValue>=0&&v.initialValue<=15,'Initial value must be 0 to 15');
      if(c.kind==='counter')assert(Number.isInteger(v.modulus)&&v.modulus>=0&&v.modulus<=16&&typeof v.invertReset==='boolean'&&typeof v.negativeEdge==='boolean','Invalid counter parameters');
      if(c.kind==='latch')assert(typeof v.edgeTriggered==='boolean','Invalid latch mode');
      if (['dFlipFlop', 'jkFlipFlop', 'tFlipFlop'].includes(c.kind)) assert(Number.isFinite(v.highVoltage) && v.highVoltage > 0 && typeof v.initialState === 'boolean' && (c.kind !== 'jkFlipFlop' || typeof v.positiveEdge === 'boolean'), 'Invalid flip-flop parameters');
      if (c.kind === 'polarizedCapacitor') assert(Number.isFinite(v.maxReverseVoltage) && v.maxReverseVoltage >= 0, 'Maximum reverse voltage must be nonnegative');
      if (['capacitor', 'polarizedCapacitor'].includes(c.kind)) assert(Number.isFinite(v.capacitance) && v.capacitance > 0 && Number.isFinite(v.initialVoltage) && ['backwardEuler', 'trapezoidal'].includes(v.integration), 'Invalid capacitor parameters');
      if (c.kind === 'voltageSource' || c.kind === 'voltageRail') assert(validWaveform(v.waveform), 'Expected finite source values, nonnegative amplitude, positive AC frequency and duty cycle between 0 and 100%.');
      if (c.kind === 'opamp') assert(Number.isFinite(v.gain) && v.gain > 0 && Number.isFinite(v.minOutput) && Number.isFinite(v.maxOutput) && v.minOutput < v.maxOutput && Number.isFinite(v.maxOutput - v.minOutput), 'Invalid op-amp gain or output limits');
      if (c.kind === 'switch') assert(typeof v.closed === 'boolean', 'Invalid switch state');
    }
    for (const j of e.junctions) assert(point(l.junctions?.[j.id]), 'Missing junction position');
    const endpoint = ref => {
      if (ref?.kind === 'junction') return junctions.has(ref.junctionId);
      if (ref?.kind !== 'pin' || !components.has(ref.componentId)) return false;
      const c = e.components.find(c => c.id === ref.componentId);
      return Object.hasOwn(definitions[c.kind].pins, ref.pinId);
    };
    for (const w of e.wires) assert(endpoint(w.from) && endpoint(w.to) && Array.isArray(l.wires?.[w.id]?.bends) && l.wires[w.id].bends.every(point), 'Invalid wire endpoint or route');
    assert(Array.isArray(document.probes) && document.simulation && Number.isFinite(document.simulation.timeStep) && document.simulation.timeStep > 0, 'Invalid probes or timestep');
    const probeIds = ids(document.probes);
    for (const p of document.probes) assert(p.kind === 'voltage' ? endpoint(p.positive) && (p.reference === 'ground' || endpoint(p.negative)) : p.kind === 'current' && components.has(p.componentId), 'Invalid probe target');
    if (l.probes) { assert(typeof l.probes === 'object' && !Array.isArray(l.probes), 'Invalid probe layout'); for (const [id, pose] of Object.entries(l.probes)) assert(probeIds.has(id) && point(pose), 'Invalid probe layout'); }
    return document;
  }
  function empty() {
    return {
      schemaVersion: 1, id: crypto.randomUUID(), title: 'Untitled circuit', electrical: { components: [], junctions: [], wires: [] },
      layout: { components: {}, junctions: {}, wires: {} }, probes: [], simulation: { timeStep: 1e-5 }
    };
  }
  const api=Object.freeze({validate,empty});

  registry.document=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
