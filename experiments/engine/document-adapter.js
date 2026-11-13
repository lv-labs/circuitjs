'use strict';
// Document catalog: resistors, capacitors, voltage sources/rails, switches, op-amps and ground.
// The compiler is pure; only createSession invokes the existing engine.
(() => {
  const fail = (code, message) => { throw Object.assign(new Error(message), {code}); };
  const check = (condition, message) => { if (!condition) fail('INVALID_DOCUMENT', message); };
  const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const id = x => typeof x === 'string' && x.length > 0;
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const key = parts => JSON.stringify(parts);
  const catalog = new Map([
    ['resistor', {pins: ['a', 'b'], type: 'r', sign: 1}],
    ['capacitor', {pins: ['a', 'b'], type: 'c', sign: 1}],
    ['switch', {pins: ['a', 'b'], type: 's', sign: 1}],
    ['voltageSource', {pins: ['n', 'p'], type: 'v', sign: -1}],
    ['voltageRail', {pins: ['p'], type: 'R', sign: -1}],
    ['opamp', {pins: ['minus', 'plus', 'out'], type: 'a', sign: -1}],
    ['ground', {pins: ['g'], type: 'g', sign: null}]
  ]);
  function exactFields(value, fields, label) {
    check(record(value) && Object.keys(value).length === fields.length &&
      fields.every(field => Object.hasOwn(value, field)), label + ': unexpected or missing fields');
  }
  function unique(values, label) {
    check(Array.isArray(values), label + ' must be an array');
    const result = new Map();
    for (const value of values) {
      check(record(value) && id(value.id), label + ': expected nonempty string ID');
      check(!result.has(value.id), label + ': duplicate ID ' + value.id);
      result.set(value.id, value);
    }
    return result;
  }
  function compile(document) {
    check(record(document) && document.schemaVersion === 1 && id(document.id), 'Expected version 1 document and ID');
    exactFields(document.electrical, ['components', 'junctions', 'wires'], 'electrical graph');
    exactFields(document.simulation, ['timeStep'], 'simulation settings');
    check(record(document.simulation) && Number.isFinite(document.simulation.timeStep) &&
      document.simulation.timeStep > 0, 'Expected positive finite timestep');
    const components = unique(document.electrical.components, 'components');
    const junctions = unique(document.electrical.junctions, 'junctions');
    const wires = unique(document.electrical.wires, 'wires');
    check(components.size > 0, 'Circuit must contain components');
    const parent = new Map();
    const rank = new Map();
    function add(k) { parent.set(k, k); rank.set(k, 0); }
    function find(k) {
      let root = k;
      while (parent.get(root) !== root) root = parent.get(root);
      while (k !== root) { const next = parent.get(k); parent.set(k, root); k = next; }
      return root;
    }
    function join(a, b) {
      a = find(a); b = find(b);
      if (a === b) return;
      if (rank.get(a) < rank.get(b)) [a, b] = [b, a];
      parent.set(b, a);
      if (rank.get(a) === rank.get(b)) rank.set(a, rank.get(a) + 1);
    }
    const ground = key(['global-ground']); add(ground);
    let grounds = 0;
    const devices = [...components.values()].sort((a, b) => compare(a.id, b.id)).map(component => {
      check(Object.keys(component).every(field => ['id', 'kind', 'modelVersion', 'reference', 'parameters'].includes(field)),
        'Unexpected component field: ' + component.id);
      const model = catalog.get(component.kind);
      if (!model || component.modelVersion !== 1)
        fail('UNSUPPORTED_MODEL', 'Unsupported model/version: ' + component.kind + ' (' + component.id + ')');
      let parameters;
      if (component.kind === 'resistor') {
        exactFields(component.parameters, ['resistance'], component.id);
        const r = component.parameters.resistance;
        check(Number.isFinite(r) && r > 0 && Number.isFinite(1 / r), component.id + ': invalid resistance');
        parameters = {resistance: r};
      } else if (component.kind === 'capacitor') {
        exactFields(component.parameters, ['capacitance', 'initialVoltage', 'integration'], component.id);
        const {capacitance, initialVoltage, integration} = component.parameters;
        check(Number.isFinite(capacitance) && capacitance > 0 && Number.isFinite(initialVoltage) &&
          ['trapezoidal', 'backwardEuler'].includes(integration), component.id + ': invalid capacitor');
        parameters = {capacitance, initialVoltage, integration};
      } else if (component.kind === 'opamp') {
        exactFields(component.parameters, ['gain', 'minOutput', 'maxOutput'], component.id);
        const {gain, minOutput, maxOutput} = component.parameters;
        check(Number.isFinite(gain) && gain > 0 && Number.isFinite(minOutput) && Number.isFinite(maxOutput) &&
          minOutput < maxOutput && Number.isFinite(maxOutput-minOutput), component.id + ': invalid op-amp gain or output limits');
        parameters = {gain, minOutput, maxOutput};
      } else if (component.kind === 'switch') {
        exactFields(component.parameters, ['closed'], component.id);
        check(typeof component.parameters.closed === 'boolean', component.id + ': closed must be boolean');
        parameters = {closed: component.parameters.closed};
      } else if ((component.kind === 'voltageSource' || component.kind === 'voltageRail')) {
        exactFields(component.parameters, ['waveform'], component.id);
        const waveform = component.parameters.waveform;
        check(record(waveform), component.id + ': expected waveform');
        if(waveform.kind === 'dc') {
          exactFields(waveform, ['kind', 'voltage'], component.id + ' waveform');
          check(Number.isFinite(waveform.voltage), component.id + ': invalid voltage');
          parameters = {waveform: {kind: 'dc', voltage: waveform.voltage}};
        } else if(['sine','square','triangle','sawtooth','pulse'].includes(waveform.kind)) {
          const duty=['square','pulse'].includes(waveform.kind);
          exactFields(waveform, ['kind', 'amplitude', 'frequency', 'offset', ...(duty?['dutyCycle']:[])], component.id + ' waveform');
          const {amplitude, frequency, offset}=waveform;
          check(Number.isFinite(amplitude) && amplitude >= 0 && Number.isFinite(frequency) && frequency > 0 &&
            Number.isFinite(2*Math.PI*frequency) && Number.isFinite(offset) && Number.isFinite(offset+amplitude) &&
            Number.isFinite(offset-amplitude), component.id + ': invalid ' + waveform.kind + ' amplitude, frequency or offset');
          if(duty)check(Number.isFinite(waveform.dutyCycle)&&waveform.dutyCycle>0&&waveform.dutyCycle<1,component.id+': duty cycle must be between 0 and 1');
          parameters = {waveform: {kind: waveform.kind, amplitude, frequency, offset, ...(duty?{dutyCycle:waveform.dutyCycle}:{})}};
        } else fail('UNSUPPORTED_MODEL', 'Unsupported voltage-source waveform');
      } else {
        exactFields(component.parameters, [], component.id); parameters = {}; grounds++;
      }
      for (const pin of model.pins) {
        const terminal = key(['pin', component.id, pin]); add(terminal);
        if (component.kind === 'ground') join(terminal, ground);
      }
      return {id: component.id, kind: component.kind, modelVersion: 1, parameters};
    });
    check(grounds > 0 || devices.some(device=>device.kind==='voltageRail'), 'Explicit ground is required');
    for (const [j, value] of junctions) {
      exactFields(value, ['id'], 'junction');
      add(key(['junction', j]));
    }
    function endpoint(ref) {
      check(record(ref), 'Expected wire endpoint');
      if (ref.kind === 'pin') {
        exactFields(ref, ['kind', 'componentId', 'pinId'], 'pin endpoint');
        const c = components.get(ref.componentId);
        check(c && catalog.get(c.kind).pins.includes(ref.pinId), 'Unknown component/pin endpoint');
        return key(['pin', ref.componentId, ref.pinId]);
      }
      exactFields(ref, ['kind', 'junctionId'], 'junction endpoint');
      check(ref.kind === 'junction' && junctions.has(ref.junctionId), 'Unknown junction endpoint');
      return key(['junction', ref.junctionId]);
    }
    for (const wire of wires.values()) {
      exactFields(wire, ['id', 'from', 'to'], 'wire');
      join(endpoint(wire.from), endpoint(wire.to));
    }
    const groups = new Map();
    for (const device of devices) for (const pin of catalog.get(device.kind).pins) {
      const root = find(key(['pin', device.id, pin]));
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push([device.id, pin]);
    }
    const terminalNets = new Map();
    const nets = [...groups].map(([root, terminals]) => {
      terminals.sort((a, b) => compare(a[0], b[0]) || compare(a[1], b[1]));
      const grounded = root === find(ground);
      const netKey = key([grounded, terminals]);
      for (const [c, p] of terminals) terminalNets.set(key(['pin', c, p]), netKey);
      return {key: netKey, ground: grounded, terminals};
    }).sort((a, b) => compare(a.key, b.key));
    for (const device of devices) device.pins = Object.fromEntries(catalog.get(device.kind).pins.map(pin =>
      [pin, terminalNets.get(key(['pin', device.id, pin]))]));

    // Reject floating islands and ideal-source loops in this limited catalog,
    // rather than silently relying on the legacy solver's grounding/repair rules.
    const adjacency = new Map(nets.map(net => [net.key, new Set()]));
    const sourceParent = new Map(nets.map(net => [net.key, net.key]));
    function sourceRoot(k) { while (sourceParent.get(k) !== k) k = sourceParent.get(k); return k; }
    const groundNet = nets.find(net => net.ground)?.key || ground;
    if(!adjacency.has(groundNet)){adjacency.set(groundNet,new Set());sourceParent.set(groundNet,groundNet);}
    for (const device of devices) {
      if (device.kind === 'voltageRail') {
        adjacency.get(device.pins.p).add(groundNet);adjacency.get(groundNet).add(device.pins.p);
        const a=sourceRoot(device.pins.p), b=sourceRoot(groundNet);
        check(a!==b,'Unsupported ideal source/rail loop: '+device.id);sourceParent.set(a,b);
      }
      if (device.kind === 'opamp') {
        const a=sourceRoot(device.pins.out), b=sourceRoot(groundNet);
        check(a !== b, 'Unsupported ideal op-amp output/source loop: ' + device.id);
        sourceParent.set(a,b);
      }
      const pins = Object.values(device.pins);
      if (pins.length === 2) {
        if (device.kind !== 'switch' || device.parameters.closed) {
          adjacency.get(pins[0]).add(pins[1]); adjacency.get(pins[1]).add(pins[0]);
        }
        if (device.kind === 'voltageSource' || (device.kind === 'switch' && device.parameters.closed)) {
          const a = sourceRoot(pins[0]), b = sourceRoot(pins[1]);
          check(a !== b, 'Unsupported ideal source/switch loop: ' + device.id);
          sourceParent.set(a, b);
        }
      }
    }
    // The legacy model repairs ideal capacitor/source loops by adding resistance.
    // Reject them here rather than silently changing live-state semantics.
    for (const device of devices) if (device.kind === 'capacitor') {
      const a = sourceRoot(device.pins.a), b = sourceRoot(device.pins.b);
      check(a !== b, 'Unsupported ideal capacitor/source loop: ' + device.id);
      sourceParent.set(a, b);
    }
    // OpAmpElm has an implicit ground-referenced output source, but no input
    // conductance. Inputs must have an external reference/feedback path.
    const reached = new Set([groundNet, ...nets.filter(net => net.ground).map(net => net.key),
      ...devices.filter(device=>device.kind==='opamp').map(device=>device.pins.out)]);
    const queue = [...reached];
    for (let i = 0; i < queue.length; i++) for (const next of adjacency.get(queue[i]))
      if (!reached.has(next)) { reached.add(next); queue.push(next); }
    check(nets.every(net=>reached.has(net.key)), 'Floating circuit island is unsupported in this document slice');
    const diagnostics = nets.filter(net => !net.ground && net.terminals.length === 1).map(net => ({
      code: 'UNCONNECTED_PIN', severity: 'warning', message: 'Pin has no external connection',
      pins: net.terminals.map(([componentId, pinId]) => ({componentId, pinId}))
    }));
    const projection = {devices, nets, simulation: {timeStep: document.simulation.timeStep}};
    const canonical = JSON.stringify(projection);
    const hubs = new Map(nets.map((net, i) => [net.key, [32 + i * 64, -1024]]));
    check(32 + Math.max(devices.length, nets.length) * 64 < 2147483647, 'Circuit exceeds coordinate limit');
    const records = [], connections = [], mapping = [];
    let groundIndex = null;
    devices.forEach((device, index) => {
      const model = catalog.get(device.kind);
      // GroundElm implicitly joins ground symbols. Emitting extra explicit hub
      // wires as well would make redundant loops in legacy wire-current analysis.
      // All public ground pins alias the one physical reference element instead.
      if (device.kind === 'ground' && groundIndex !== null) {
        mapping.push({id: device.id, index: groundIndex, pins: [...model.pins], sign: null});
        return;
      }
      const engineIndex = records.length;
      if (device.kind === 'ground') groundIndex = engineIndex;
      const x = 32 + index * 64;
      let parameters = '';
      let flags = 0;
      if (device.kind === 'resistor') parameters = ' ' + device.parameters.resistance;
      if (device.kind === 'voltageSource' || device.kind === 'voltageRail') {
        const w=device.parameters.waveform;
        const code={sine:1,square:2,triangle:3,sawtooth:4,pulse:5}[w.kind];
        if(w.kind==='pulse')flags=4;
        parameters=w.kind==='dc'?' 0 40 ' + w.voltage + ' 0 0 0.5':` ${code} ${w.frequency} ${w.amplitude} ${w.offset} 0 ${w.dutyCycle??0.5}`;
      }
      if (device.kind === 'capacitor') {
        flags = device.parameters.integration === 'backwardEuler' ? 2 : 0;
        parameters = ` ${device.parameters.capacitance} ${device.parameters.initialVoltage} ${device.parameters.initialVoltage}`;
      }
      if (device.kind === 'switch') parameters = ` ${device.parameters.closed ? 0 : 1} false`;
      if (device.kind === 'opamp') {
        flags=8;parameters=` ${device.parameters.maxOutput} ${device.parameters.minOutput} 1000000 0 0 ${device.parameters.gain}`;
      }
      records.push(`${model.type} ${x} 32 ${device.kind==='opamp'?x+32:x} ${device.kind==='opamp'?32:64} ${flags}${parameters}`);
      mapping.push({id: device.id, kind: device.kind, index: engineIndex, pins: [...model.pins], sign: model.sign});
      model.pins.forEach((pin, post) => {
        const [hx, hy] = hubs.get(device.pins[pin]);
        const [px,py]=device.kind==='opamp'?[[x,16],[x,48],[x+32,32]][post]:[x,32+post*32];
        connections.push(`w ${px} ${py} ${hx} ${hy} 0`);
      });
    });
    return {documentId: document.id, timeStep: document.simulation.timeStep,
      text: [...records, ...connections].join('\n'), mapping, nets, canonical, diagnostics};
  }

  // Revalidate canonical electrical input inside the addressed worker. Rebuild an
  // explicit graph and compare its projection rather than trusting supplied nets.
  function fromProjection(projection, documentId) {
    exactFields(projection, ['devices', 'nets', 'simulation'], 'electrical projection');
    check(Array.isArray(projection.devices) && Array.isArray(projection.nets), 'Expected projection arrays');
    const components = projection.devices.map(device => {
      exactFields(device, ['id', 'kind', 'modelVersion', 'parameters', 'pins'], 'projected device');
      return {id: device.id, kind: device.kind, modelVersion: device.modelVersion, parameters: device.parameters};
    });
    const junctions = [], wires = [];
    projection.nets.forEach((net, i) => {
      exactFields(net, ['key', 'ground', 'terminals'], 'projected net');
      check(typeof net.key === 'string' && typeof net.ground === 'boolean' && Array.isArray(net.terminals), 'Invalid net');
      const junctionId = 'projection-net-' + i;
      junctions.push({id: junctionId});
      net.terminals.forEach((terminal, j) => {
        check(Array.isArray(terminal) && terminal.length === 2 && terminal.every(id), 'Invalid terminal');
        wires.push({id: `projection-wire-${i}-${j}`, from: {kind: 'pin', componentId: terminal[0], pinId: terminal[1]},
          to: {kind: 'junction', junctionId}});
      });
    });
    const compiled = compile({schemaVersion: 1, id: documentId, electrical: {components, junctions, wires}, simulation: projection.simulation});
    check(compiled.canonical === JSON.stringify(projection), 'Projection must match canonical devices, nets and pin assignments');
    return compiled;
  }

  function normalizeSampleChannels(channels=[]) {
    check(Array.isArray(channels)&&channels.length<=32,'Scope supports at most 32 voltage channels');
    const seen=new Set();
    const terminal=ref=>{exactFields(ref,['componentId','pinId'],'sample terminal');check(id(ref.componentId)&&id(ref.pinId),'Invalid sample terminal');return {componentId:ref.componentId,pinId:ref.pinId};};
    return channels.map(channel=>{
      exactFields(channel,['id','positive','negative'],'sample channel');check(id(channel.id)&&!seen.has(channel.id),'Missing/duplicate sample channel ID');seen.add(channel.id);
      return {id:channel.id,positive:terminal(channel.positive),negative:channel.negative===null?null:terminal(channel.negative)};
    }).sort((a,b)=>compare(a.id,b.id));
  }
  function createSession(engine) {
    let compiled = null, faulted = false, hasFrame = false, sequence = 0;
    function active() {
      if (faulted) fail('ENGINE_FAILURE', 'Engine session faulted; load a valid document to recover');
      if (!compiled) fail('NO_DOCUMENT', 'Load a document first');
    }
    function invoke(action) {
      try { return action(); }
      catch (error) { faulted = true; hasFrame = false; fail('ENGINE_FAILURE', String(error.message || error)); }
    }
    function frame(raw) {
      check(raw && Number.isFinite(raw.time) && raw.time >= 0 && Number.isFinite(raw.timeStep) && raw.timeStep > 0,
        'Invalid engine time');
      const pinVoltages = [], componentCurrents = [];
      for (const entry of compiled.mapping) {
        const elm = raw.elements[entry.index];
        check(elm && entry.pins.every((_, post) => Number.isFinite(elm.voltages[post])) &&
          (entry.sign === null || Number.isFinite(elm.current)), 'Non-finite or missing engine result');
        pinVoltages.push([entry.id, Object.fromEntries(entry.pins.map((pin, post) => [pin, elm.voltages[post]]))]);
        if (entry.sign !== null) componentCurrents.push([entry.id, entry.sign * elm.current]);
      }
      return {documentId: compiled.documentId, frameSequence: sequence, time: raw.time, timeStep: raw.timeStep,
        pinVoltages: Object.fromEntries(pinVoltages), componentCurrents: Object.fromEntries(componentCurrents),
        diagnostics: structuredClone(compiled.diagnostics)};
    }
    function install(next) {
      invoke(() => engine.load(next.text, next.timeStep));
      compiled = next; faulted = false; hasFrame = false; sequence = 0;
      return {documentId: next.documentId, time: 0, timeStep: next.timeStep, frameAvailable: false,
        componentIds: next.mapping.map(entry => entry.id), netCount: next.nets.length,
        diagnostics: structuredClone(next.diagnostics)};
    }
    return {
      loadDocument: document => install(compile(document)),
      installProjection: (projection, documentId) => install(fromProjection(projection, documentId)),
      setSwitch: (componentId, closed) => {
        active();
        const entry = compiled.mapping.find(item => item.id === componentId && item.kind === 'switch');
        check(entry && typeof closed === 'boolean', 'Expected switch ID and boolean closed state');
        const projection = JSON.parse(compiled.canonical);
        projection.devices.find(device => device.id === componentId).parameters.closed = closed;
        const next = fromProjection(projection, compiled.documentId);
        const raw = invoke(() => engine.setSwitch(entry.index, closed));
        compiled = next; hasFrame = false;
        return {appliedAtTime: raw.time, frameAvailable: false};
      },
      step: (count, channels) => {
        active();
        check(Number.isInteger(count) && count >= 1 && count <= 10000, 'Step count must be 1–10000');
        const normalized=normalizeSampleChannels(channels);
        const locate=ref=>{
          if(ref===null)return null;
          const entry=compiled.mapping.find(item=>item.id===ref.componentId),post=entry?.pins.indexOf(ref.pinId);
          check(entry&&post>=0,'Unknown scope component/pin');return {index:entry.index,post};
        };
        // Validate every channel before advancing the solver. Only one batch crosses
        // the worker boundary; no display-frame downsampling hides intermediate peaks.
        const targets=normalized.map(channel=>({positive:locate(channel.positive),negative:locate(channel.negative)}));
        return invoke(() => {
          if(!normalized.length){const raw=engine.step(count);sequence++;hasFrame=true;return frame(raw);}
          const times=[],values=normalized.map(()=>[]);let raw;
          const voltage=ref=>ref===null?0:raw.elements[ref.index]?.voltages[ref.post];
          for(let i=0;i<count;i++){
            raw=engine.step(1);
            check(Number.isFinite(raw.time)&&Number.isFinite(raw.timeStep)&&raw.timeStep>0,'Invalid scope sample time');
            times.push(Math.max(0,raw.time-raw.timeStep));
            targets.forEach((target,j)=>{const value=voltage(target.positive)-voltage(target.negative);check(Number.isFinite(value),'Invalid scope sample voltage');values[j].push(value);});
          }
          sequence++;hasFrame=true;
          return {...frame(raw),sampleBatch:{channels:normalized,times,values:Object.fromEntries(normalized.map((channel,i)=>[channel.id,values[i]]))}};
        });
      },
      snapshot: () => { active(); if (!hasFrame) fail('NO_FRAME', 'Advance simulation before reading results');
        return invoke(() => frame(engine.snapshot())); },
      reset: () => { active(); return install(compiled); }
    };
  }
  globalThis.CircuitDocumentAdapter = Object.freeze({compile, fromProjection, createSession, normalizeSampleChannels});
})();
