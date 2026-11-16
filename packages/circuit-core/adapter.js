'use strict';
// Portable computation module: no DOM, renderer, storage or worker construction.
(() => {
  const registry=globalThis.CircuitCoreModules ||= {};
  const Catalog=typeof module==='object'&&module.exports?require('./catalog.js'):registry.catalog;
  const fail = (code, message) => { throw Object.assign(new Error(message), {code}); };
  const check = (condition, message) => { if (!condition) fail('INVALID_DOCUMENT', message); };
  const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const id = x => typeof x === 'string' && x.length > 0;
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const key = parts => JSON.stringify(parts);
  const {outputSpecs,graphic,validateOutput}=Catalog;
  const catalog=new Map(Object.entries(Catalog.simulationModels).map(([kind,model])=>[kind,{...model,pins:model.postOrder}]));
  const magnetic=kind=>['transformer','tappedTransformer','customTransformer'].includes(kind);
  const contactClosed=d=>d.kind==='pushSwitch'?d.parameters.normallyClosed:d.parameters.closed;
  const spst=kind=>kind==='switch'||kind==='pushSwitch';
  const capacitor=kind=>['capacitor','polarizedCapacitor'].includes(kind);
  const analog=kind=>['analogSwitch','analogSpdtSwitch'].includes(kind);
  // Output markers have no electrical effect; logic output is a passive read-only
  // probe (plus an optional 1 MΩ pulldown). Standalone markers need no floating warning.
  const displayOnly=kind=>['output','logicOutput','testPoint','labeledNode','decimalDisplay','instructionDisplay','dataExport','audioOutput','stopTrigger'].includes(kind);
  const logicSource=kind=>kind==='logicInput';
  const railSource=kind=>kind==='voltageRail'||kind==='variableVoltage';
  const logicMode=kind=>kind==='logic'||kind==='numeric'||kind==='ternary';
  const flipFlop=kind=>['dFlipFlop','jkFlipFlop','tFlipFlop'].includes(kind);
  // ChipElm stamps each output as an implicit ground-referenced voltage source.
  const nextChip=kind=>['counter','latch','halfAdder','fullAdder'].includes(kind);
  const chipOutputs=kind=>({counter:['Q3','Q2','Q1','Q0'],latch:['O0','O1','O2','O3'],halfAdder:['sum','carry'],fullAdder:['S0','S1','S2','S3','carryOut']}[kind] || (flipFlop(kind)?['Q','Qn']:[]));
  // Legacy ChipElm post coordinates for the canonical horizontal 2x3 body.
  function chipPostPoints(kind,x){
    if(kind==='counter')return [[x,32],[x,128],...[0,1,2,3].map(i=>[x+96,32+i*32])];
    if(kind==='latch')return [...[0,1,2,3].map(i=>[x,128-i*32]),...[0,1,2,3].map(i=>[x+96,128-i*32]),[x,160]];
    if(kind==='halfAdder')return [[x+96,32],[x+96,64],[x,32],[x,64]];
    if(kind==='fullAdder')return [...[0,1,2,3].map(i=>[x,128-i*32]),...[0,1,2,3].map(i=>[x,256-i*32]),...[0,1,2,3].map(i=>[x+96,192-i*32]),[x,288],[x+96,32]];
    return kind==='jkFlipFlop'?[[x,32],[x,64],[x,96],[x+96,32],[x+96,96]]:
      [[x,32],[x+96,32],[x+96,96],[x,64]];
  }
  function analogPairs(device,ground){
    if(!analog(device.kind))return [];
    const p=device.pins,pairs=device.kind==='analogSwitch'?[[p.a,p.b]]:[[p.common,p.a],[p.common,p.b]];
    if(device.parameters.pulldown)for(const pin of [p.a,p.b])pairs.push([pin,ground]);
    return pairs;
  }
  const bipolar=kind=>['npn','pnp'].includes(kind);
  const fet=kind=>['nmos','pmos','njfet','pjfet'].includes(kind);
  const logic=kind=>['andGate','nandGate','orGate','norGate','xorGate','inverter'].includes(kind);
  function windingOrSwitchPairs(device){
    const p=device.pins;
    if(device.kind==='ammeter')return [[p.a,p.b]];
    if(device.kind==='wattmeter')return [[p.returnIn,p.returnOut],[p.currentIn,p.currentOut]];
    if(device.kind==='threePhaseMotor')return Object.keys(p).slice(1).map(pin=>[p.U1,p[pin]]);
    if(device.kind==='ledArray')return Array.from({length:8},(_,row)=>Array.from({length:8},(_,col)=>[p['R'+row],p['C'+col]])).flat();
    if(device.kind==='voltmeter')return device.parameters.resistance>0?[[p.a,p.b]]:[];
    if(device.kind==='transmissionLine')return [[p.left,p.leftReturn],[p.right,p.rightReturn]];
    if(device.kind==='tappedTransformer')return [[p.p1,p.p2],[p.s1,p.tap],[p.tap,p.s2]];
    if(device.kind==='customTransformer')return [[p.p1a,p.p1b],[p.p2a,p.p2b],[p.sa,p.sb]];
    if(device.kind==='mbbSwitch')return device.parameters.position%2?[[p.common,p.a],[p.common,p.b]]:[[p.common,device.parameters.position===0?p.a:p.b]];
    if(device.kind==='transformer')return [[p.p1,p.p2],[p.s1,p.s2]];
    if(device.kind==='spdtSwitch')return device.parameters.position===2?[]:[[p.common,device.parameters.position===0?p.a:p.b]];
    if(device.kind==='dpdtSwitch')return [[p.common1,device.parameters.position===0?p.a1:p.b1],[p.common2,device.parameters.position===0?p.a2:p.b2]];
    return [];
  }
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

  function outputPostPoints(kind,x){
    if(kind==='wattmeter')return [[x,64],[x+64,64],[x,32],[x+64,32]];
    if(kind==='decimalDisplay'||kind==='instructionDisplay')return [0,1,2,3].map(i=>[x,128-32*i]);
    if(kind==='ledArray')return [...Array.from({length:8},(_,i)=>[x+32+32*i,288]),...Array.from({length:8},(_,i)=>[x,32+32*i])];
    if(kind==='threePhaseMotor')return [[x,0],[x+64,64],[x,32],[x+64,32],[x,64],[x+64,0]];
    return null;
  }
  function outputRecord(d,x){
    const p=d.parameters,enc=encodeURIComponent;
    const records={
      variableVoltage:()=>({flags:0,parameters:` 6 ${p.voltage} ${p.maxVoltage} ${p.minVoltage} 0 0.5 ${enc(p.label)||'%00'}`}),
      lamp:()=>({flags:0,parameters:` ${p.initialTemperature} ${p.nominalPower} ${p.nominalVoltage} ${p.warmTime} ${p.coolTime}`}),
      labeledNode:()=>({flags:4,parameters:' '+enc('private-net-'+x)}),
      voltmeter:()=>({flags:3,parameters:` ${p.mode} 0 ${p.resistance}`}),
      ohmmeter:()=>({flags:0,parameters:` ${p.current} ${p.maxVoltage}`}),
      ammeter:()=>({flags:3,parameters:` ${p.mode} 0`}),
      wattmeter:()=>({flags:0,parameters:` 32 ${p.mode}`}),
      testPoint:()=>({flags:1,parameters:` ${p.mode} ${enc(p.label)||'%00'}`}),
      decimalDisplay:()=>({flags:0,parameters:` 4 ${p.mode}`}),
      instructionDisplay:()=>({flags:0,parameters:` ${p.threshold} ${enc(p.lookup)||'%00'}`}),
      ledArray:()=>({flags:0,parameters:' 8 8'}),
      dataExport:()=>({flags:0,parameters:` ${p.capacity}`}),
      audioOutput:()=>({flags:0,parameters:` ${p.duration} ${p.sampleRate} 1`}),
      stopTrigger:()=>({flags:0,parameters:` ${p.threshold} ${p.direction} ${p.delay}`}),
      dcMotor:()=>({flags:0,parameters:' '+['inductance','resistance','torqueConstant','backEmfConstant','inertia','friction','gearRatio','loadTorque'].map(k=>p[k]).join(' ')}),
      threePhaseMotor:()=>({flags:0,parameters:' '+['statorResistance','rotorResistance','statorInductance','rotorInductance','mutualInductance','friction','inertia'].map(k=>p[k]).join(' ')})
    };
    return records[d.kind]();
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
      if(outputSpecs[component.kind]){try{parameters=validateOutput(component,document.simulation.timeStep);}catch(error){check(false,component.id+': '+error.message);}}
      else if(component.kind==='pushSwitch'){
        exactFields(component.parameters,['normallyClosed'],component.id);check(typeof component.parameters.normallyClosed==='boolean',component.id+': invalid push-switch rest state');parameters={normallyClosed:component.parameters.normallyClosed};
      }else if(component.kind==='mbbSwitch'){
        exactFields(component.parameters,['position'],component.id);const {position}=component.parameters;check(Number.isInteger(position)&&position>=0&&position<=3,component.id+': invalid MBB position');parameters={position};
      }else if(component.kind==='transmissionLine'){
        exactFields(component.parameters,['delay','impedance'],component.id);const {delay,impedance}=component.parameters,steps=Math.floor(delay/document.simulation.timeStep);
        check(Number.isFinite(delay)&&delay>0&&Number.isFinite(impedance)&&impedance>0&&Number.isFinite(1/impedance)&&steps>=1&&steps<=100000,component.id+': line delay must span 1 to 100000 timesteps and impedance must be positive');parameters={delay,impedance};
      }else if(component.kind==='customTransformer'){
        exactFields(component.parameters,['inductance','coupling','turns1','turns2','turns3','integration'],component.id);
        const {inductance,coupling,turns1,turns2,turns3,integration}=component.parameters,ls=[turns1,turns2,turns3].map(n=>n*n*inductance),product=ls[0]*ls[1]*ls[2],det=product*(1-coupling)**2*(1+2*coupling);
        check(Number.isFinite(inductance)&&inductance>0&&[turns1,turns2,turns3].every(n=>Number.isFinite(n)&&n!==0)&&Number.isFinite(coupling)&&coupling>0&&coupling<1&&ls.every(l=>Number.isFinite(l)&&l>0)&&ls.every(l=>ls.every(m=>Number.isFinite(l*m)&&l*m>0))&&Number.isFinite(det)&&det>0&&Number.isFinite(1/det)&&['backwardEuler','trapezoidal'].includes(integration),component.id+': invalid custom transformer');
        parameters={inductance,coupling,turns1,turns2,turns3,integration};
      }else if (component.kind === 'resistor') {
        exactFields(component.parameters, ['resistance'], component.id);
        const r = component.parameters.resistance;
        check(Number.isFinite(r) && r > 0 && Number.isFinite(1 / r), component.id + ': invalid resistance');
        parameters = {resistance: r};
      } else if (component.kind === 'output') {
        exactFields(component.parameters, ['showVoltage'], component.id);
        check(typeof component.parameters.showVoltage === 'boolean', component.id + ': showVoltage must be boolean');
        parameters = {showVoltage: component.parameters.showVoltage};
      } else if (component.kind === 'logicOutput') {
        exactFields(component.parameters, ['threshold', 'mode', 'pulldown'], component.id);
        const {threshold, mode, pulldown} = component.parameters;
        check(Number.isFinite(threshold) && logicMode(mode) && typeof pulldown === 'boolean', component.id + ': invalid logic output');
        parameters = {threshold, mode, pulldown};
      } else if (component.kind === 'logicInput') {
        exactFields(component.parameters, ['state', 'highVoltage', 'lowVoltage', 'mode'], component.id);
        const {state, highVoltage, lowVoltage, mode} = component.parameters;
        check(logicMode(mode) && Number.isInteger(state) && state >= 0 && state <= (mode === 'ternary' ? 2 : 1) &&
          Number.isFinite(highVoltage) && Number.isFinite(lowVoltage) && Number.isFinite(highVoltage - lowVoltage),
          component.id + ': invalid logic input state or voltage');
        parameters = {state, highVoltage, lowVoltage, mode};
      } else if(nextChip(component.kind)){
        const fields=['highVoltage',...(component.kind==='counter'?['initialValue','modulus','invertReset','negativeEdge']:component.kind==='latch'?['initialValue','edgeTriggered']:[])];
        exactFields(component.parameters,fields,component.id);
        const p=component.parameters;
        check(Number.isFinite(p.highVoltage)&&p.highVoltage>0,component.id+': invalid chip logic voltage');
        if(component.kind==='counter'||component.kind==='latch')check(Number.isInteger(p.initialValue)&&p.initialValue>=0&&p.initialValue<=15,component.id+': initial value must be 0 to 15');
        if(component.kind==='counter')check(Number.isInteger(p.modulus)&&p.modulus>=0&&p.modulus<=16&&typeof p.invertReset==='boolean'&&typeof p.negativeEdge==='boolean',component.id+': invalid counter parameters');
        if(component.kind==='latch')check(typeof p.edgeTriggered==='boolean',component.id+': invalid latch mode');
        parameters=Object.fromEntries(fields.map(field=>[field,p[field]]));
      } else if (flipFlop(component.kind)) {
        const fields=['highVoltage','initialState',...(component.kind==='jkFlipFlop'?['positiveEdge']:[])];
        exactFields(component.parameters, fields, component.id);
        const {highVoltage, initialState}=component.parameters;
        check(Number.isFinite(highVoltage) && highVoltage > 0 && typeof initialState === 'boolean' &&
          (component.kind !== 'jkFlipFlop' || typeof component.parameters.positiveEdge === 'boolean'),
          component.id + ': invalid flip-flop parameters');
        parameters={highVoltage, initialState};
        if(component.kind==='jkFlipFlop')parameters.positiveEdge=component.parameters.positiveEdge;
      } else if(component.kind==='transformer'||component.kind==='tappedTransformer'){
        exactFields(component.parameters,['inductance','ratio','coupling','integration'],component.id);
        const {inductance,ratio,coupling,integration}=component.parameters;
        const l2=inductance*ratio*ratio/(component.kind==='tappedTransformer'?4:1),mutual=coupling*Math.sqrt(inductance*l2),det=inductance*l2-mutual*mutual;
        check(Number.isFinite(inductance)&&inductance>0&&Number.isFinite(ratio)&&ratio>0&&Number.isFinite(coupling)&&coupling>0&&coupling<1&&Number.isFinite(det)&&det>0&&Number.isFinite(1/det)&&['backwardEuler','trapezoidal'].includes(integration),component.id+': invalid transformer inductance, ratio, coupling or integration');
        parameters={inductance,ratio,coupling,integration};
      } else if(['spdtSwitch','dpdtSwitch'].includes(component.kind)){
        exactFields(component.parameters,['position'],component.id);const {position}=component.parameters;
        check(Number.isInteger(position)&&position>=0&&position<=(component.kind==='spdtSwitch'?2:1),component.id+': invalid switch position');parameters={position};
      } else if(['led','zener'].includes(component.kind)){
        const extra=component.kind==='led'?'maxCurrent':'breakdownVoltage';exactFields(component.parameters,['forwardVoltage',extra],component.id);
        const {forwardVoltage}=component.parameters,value=component.parameters[extra];
        check(Number.isFinite(forwardVoltage)&&forwardVoltage>0&&Number.isFinite(value)&&value>0,component.id+': invalid diode parameters');parameters={forwardVoltage,[extra]:value};
      } else if(analog(component.kind)){
        exactFields(component.parameters,['onResistance','offResistance','threshold','inverted','pulldown'],component.id);
        const {onResistance,offResistance,threshold,inverted,pulldown}=component.parameters;
        check([onResistance,offResistance].every(r=>Number.isFinite(r)&&r>0&&Number.isFinite(1/r))&&Number.isFinite(threshold)&&typeof inverted==='boolean'&&typeof pulldown==='boolean',component.id+': invalid analog switch parameters');
        parameters={onResistance,offResistance,threshold,inverted,pulldown};
      } else if(bipolar(component.kind)){
        exactFields(component.parameters,['beta'],component.id);const {beta}=component.parameters;
        check(Number.isFinite(beta)&&beta>0,component.id+': invalid transistor beta');parameters={beta};
      } else if(fet(component.kind)){
        exactFields(component.parameters,['threshold','beta'],component.id);const {threshold,beta}=component.parameters;
        check(Number.isFinite(threshold)&&Number.isFinite(beta)&&beta>0,component.id+': invalid FET parameters');parameters={threshold,beta};
      } else if(logic(component.kind)){
        const inverter=component.kind==='inverter';exactFields(component.parameters,inverter?['highVoltage','slewRate']:['highVoltage'],component.id);
        const {highVoltage,slewRate}=component.parameters;check(Number.isFinite(highVoltage)&&highVoltage>0&&(!inverter||Number.isFinite(slewRate)&&slewRate>0),component.id+': invalid logic parameters');
        parameters={highVoltage,...(inverter?{slewRate}:{})};
      } else if (component.kind === 'inductor') {
        exactFields(component.parameters, ['inductance','initialCurrent','integration'], component.id);
        const {inductance,initialCurrent,integration}=component.parameters;
        check(Number.isFinite(inductance)&&inductance>0&&Number.isFinite(initialCurrent)&&['backwardEuler','trapezoidal'].includes(integration),component.id+': invalid inductor');
        parameters={inductance,initialCurrent,integration};
      } else if (component.kind === 'diode') {
        exactFields(component.parameters, [], component.id);parameters={};
      } else if (component.kind === 'currentSource') {
        exactFields(component.parameters,['current','maxVoltage'],component.id);
        const {current,maxVoltage}=component.parameters;
        check(Number.isFinite(current)&&Number.isFinite(maxVoltage)&&maxVoltage>=0,component.id+': invalid current source');parameters={current,maxVoltage};
      } else if (component.kind === 'potentiometer') {
        exactFields(component.parameters,['resistance','position'],component.id);
        const {resistance,position}=component.parameters;
        check(Number.isFinite(resistance)&&resistance>0&&Number.isFinite(1/resistance)&&Number.isFinite(position)&&position>=0&&position<=1,component.id+': invalid potentiometer');parameters={resistance,position};
      } else if (capacitor(component.kind)) {
        const polarized=component.kind==='polarizedCapacitor';
        exactFields(component.parameters, ['capacitance', 'initialVoltage', 'integration',...(polarized?['maxReverseVoltage']:[])], component.id);
        const {capacitance, initialVoltage, integration} = component.parameters;
        check(Number.isFinite(capacitance) && capacitance > 0 && Number.isFinite(initialVoltage) &&
          ['trapezoidal', 'backwardEuler'].includes(integration), component.id + ': invalid capacitor');
        parameters = {capacitance, initialVoltage, integration};
        if(polarized){
          const {maxReverseVoltage}=component.parameters;
          check(Number.isFinite(maxReverseVoltage)&&maxReverseVoltage>=0,component.id+': invalid maximum reverse voltage');
          parameters.maxReverseVoltage=maxReverseVoltage;
        }
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
          exactFields(waveform, ['kind', 'amplitude', 'frequency', 'offset', ...(duty?['dutyCycle']:[]),...(Object.hasOwn(waveform,'phase')?['phase']:[])], component.id + ' waveform');
          const {amplitude, frequency, offset}=waveform;
          if(Object.hasOwn(waveform,'phase'))check(Number.isFinite(waveform.phase),'Phase must be finite radians');
          check(Number.isFinite(amplitude) && amplitude >= 0 && Number.isFinite(frequency) && frequency > 0 &&
            Number.isFinite(2*Math.PI*frequency) && Number.isFinite(offset) && Number.isFinite(offset+amplitude) &&
            Number.isFinite(offset-amplitude), component.id + ': invalid ' + waveform.kind + ' amplitude, frequency or offset');
          if(duty)check(Number.isFinite(waveform.dutyCycle)&&waveform.dutyCycle>0&&waveform.dutyCycle<1,component.id+': duty cycle must be between 0 and 1');
          parameters = {waveform: {kind: waveform.kind, amplitude, frequency, offset, ...(duty?{dutyCycle:waveform.dutyCycle}:{}),...(Object.hasOwn(waveform,'phase')&&waveform.phase!==0?{phase:waveform.phase}:{})}};
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
    for(let i=devices.length-1;i>=0;i--)if(graphic(devices[i].kind))devices.splice(i,1);
    check(devices.length>0,'No electrical components to simulate');
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
    const labels=new Map();for(const device of devices)if(device.kind==='labeledNode'){const terminal=key(['pin',device.id,'in']),name=device.parameters.name;if(labels.has(name))join(terminal,labels.get(name));else labels.set(name,terminal);}
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

    // Retain ideal-loop guards; floating islands use the legacy solver stabilization.
    const adjacency = new Map(nets.map(net => [net.key, new Set()]));
    const sourceParent = new Map(nets.map(net => [net.key, net.key]));
    function sourceRoot(k) { while (sourceParent.get(k) !== k) k = sourceParent.get(k); return k; }
    const groundNet = nets.find(net => net.ground)?.key || ground;
    if(!adjacency.has(groundNet)){adjacency.set(groundNet,new Set());sourceParent.set(groundNet,groundNet);}
    for (const device of devices) {
      if(device.kind==='transmissionLine')check(device.pins.leftReturn===groundNet&&device.pins.rightReturn===groundNet,'Transmission line return pins must connect directly to ground: '+device.id);
      if (railSource(device.kind) || logicSource(device.kind)) {
        const idealPin = railSource(device.kind) ? device.pins.p : device.pins.out;
        adjacency.get(idealPin).add(groundNet);adjacency.get(groundNet).add(idealPin);
        const a=sourceRoot(idealPin), b=sourceRoot(groundNet);
        check(a!==b,'Unsupported ideal source/rail loop: '+device.id);sourceParent.set(a,b);
      }
      if (device.kind === 'opamp'||logic(device.kind)) {
        const a=sourceRoot(device.pins.out), b=sourceRoot(groundNet);
        check(a !== b, 'Unsupported ideal op-amp output/source loop: ' + device.id);
        sourceParent.set(a,b);
      }
      for(const output of chipOutputs(device.kind)){
        const a=sourceRoot(device.pins[output]), b=sourceRoot(groundNet);
        check(a!==b, 'Unsupported ideal '+(flipFlop(device.kind)?'flip-flop':'chip')+' output loop: '+device.id);
        sourceParent.set(a,b);
      }
      for(const [left,right] of windingOrSwitchPairs(device)){
        adjacency.get(left).add(right);adjacency.get(right).add(left);
        if(['spdtSwitch','dpdtSwitch','mbbSwitch','ammeter','wattmeter'].includes(device.kind)){
          const a=sourceRoot(left),b=sourceRoot(right);check(a!==b,'Unsupported ideal switch loop: '+device.id);sourceParent.set(a,b);
        }
      }
      for(const [left,right] of analogPairs(device,groundNet)){adjacency.get(left).add(right);adjacency.get(right).add(left);}
      if(device.kind==='logicOutput'&&device.parameters.pulldown){
        adjacency.get(device.pins.in).add(groundNet);adjacency.get(groundNet).add(device.pins.in);
      }
      if(bipolar(device.kind)){
        for(const end of [device.pins.collector,device.pins.emitter]){adjacency.get(device.pins.base).add(end);adjacency.get(end).add(device.pins.base);}
      }
      if(fet(device.kind)){
        adjacency.get(device.pins.source).add(device.pins.drain);adjacency.get(device.pins.drain).add(device.pins.source);
        if(device.kind.includes('jfet')){adjacency.get(device.pins.gate).add(device.pins.source);adjacency.get(device.pins.source).add(device.pins.gate);}
      }
      if(device.kind==='potentiometer'){
        const {a,b,wiper}=device.pins;
        for(const end of [a,b]){adjacency.get(end).add(wiper);adjacency.get(wiper).add(end);}
        if(device.parameters.position===0||device.parameters.position===1){
          const end=sourceRoot(device.parameters.position===0?a:b),tap=sourceRoot(wiper);
          check(end!==tap,'Unsupported ideal potentiometer loop: '+device.id);sourceParent.set(end,tap);
        }
      }
      const pins = Object.values(device.pins);
      if (pins.length === 2 && !logic(device.kind)&&device.kind!=='voltmeter') {
        if (!spst(device.kind) || contactClosed(device)) {
          adjacency.get(pins[0]).add(pins[1]); adjacency.get(pins[1]).add(pins[0]);
        }
        if (device.kind === 'voltageSource' || (spst(device.kind) && contactClosed(device))) {
          const a = sourceRoot(pins[0]), b = sourceRoot(pins[1]);
          check(a !== b, 'Unsupported ideal source/switch loop: ' + device.id);
          sourceParent.set(a, b);
        }
      }
    }
    const openSources=[];
    // Report open current sources; let the original solver substitute its large
    // resistance so disconnecting a lead does not block the entire document.
    for(const source of devices.filter(d=>['currentSource','ohmmeter'].includes(d.kind)&&d.parameters.maxVoltage===0&&d.parameters.current!==0)){
      const paths=new Map([...adjacency.keys()].map(k=>[k,new Set()]));
      const link=(a,b)=>{paths.get(a).add(b);paths.get(b).add(a);};
      for(const d of devices){
        if(['currentSource','ohmmeter'].includes(d.kind))continue;
        for(const pair of [...windingOrSwitchPairs(d),...analogPairs(d,groundNet)])link(...pair);
        const pins=Object.values(d.pins);
        if(pins.length===2&&!logic(d.kind)&&d.kind!=='voltmeter'&&(!spst(d.kind)||contactClosed(d)))link(pins[0],pins[1]);
        if(bipolar(d.kind)){link(d.pins.base,d.pins.collector);link(d.pins.base,d.pins.emitter);}
        if(fet(d.kind)){link(d.pins.source,d.pins.drain);if(d.kind.includes('jfet'))link(d.pins.gate,d.pins.source);}
        if(d.kind==='potentiometer'){link(d.pins.a,d.pins.wiper);link(d.pins.b,d.pins.wiper);}
        if(railSource(d.kind)||logicSource(d.kind))link(railSource(d.kind)?d.pins.p:d.pins.out,groundNet);
        if(d.kind==='logicOutput'&&d.parameters.pulldown)link(d.pins.in,groundNet);
        if(d.kind==='opamp'||logic(d.kind))link(d.pins.out,groundNet);
        for(const output of chipOutputs(d.kind))link(d.pins[output],groundNet);
      }
      const reached=new Set([source.pins.a]),queue=[source.pins.a];
      for(let i=0;i<queue.length;i++)for(const next of paths.get(queue[i]))if(!reached.has(next)){reached.add(next);queue.push(next);}
      // Open sources use the original solver's high-resistance fallback.
      if(!reached.has(source.pins.b))openSources.push(source.id);
    }
    // The legacy model repairs ideal capacitor/source loops by adding resistance.
    // Reject them here rather than silently changing live-state semantics.
    for (const device of devices) if (capacitor(device.kind)) {
      const pins=Object.values(device.pins);
      const a = sourceRoot(pins[0]), b = sourceRoot(pins[1]);
      check(a !== b, 'Unsupported ideal capacitor/source loop: ' + device.id);
      sourceParent.set(a, b);
    }
    // OpAmpElm has an implicit ground-referenced output source, but no input
    // conductance. Unreferenced inputs use legacy floating-node stabilization.
    // A lone output/logic-output marker has no electrical effect, so seed only
    // its own single-terminal net when producing floating-node warnings.
    const reached = new Set([groundNet, ...nets.filter(net => net.ground).map(net => net.key),
      ...devices.filter(device=>device.kind==='opamp'||logic(device.kind)).map(device=>device.pins.out),
      ...devices.flatMap(device=>chipOutputs(device.kind).map(output=>device.pins[output])),
      ...devices.filter(device=>displayOnly(device.kind)).flatMap(device=>Object.values(device.pins))
        .filter(net=>nets.find(n=>n.key===net).terminals.every(([id])=>displayOnly(components.get(id).kind)))]);
    const queue = [...reached];
    for (let i = 0; i < queue.length; i++) for (const next of adjacency.get(queue[i]))
      if (!reached.has(next)) { reached.add(next); queue.push(next); }
    // Falstad references floating islands through its existing 100 MΩ stabilization.
    // Preserve their actual terminals; warnings do not block simulation.
    const diagnostics = nets.filter(net => !net.ground && net.terminals.length === 1).map(net => ({
      code: 'UNCONNECTED_PIN', severity: 'warning', message: 'Pin has no external connection',
      pins: net.terminals.map(([componentId, pinId]) => ({componentId, pinId}))
    }));
    for(const net of nets.filter(net=>!reached.has(net.key)))diagnostics.push({code:'FLOATING_NET',severity:'warning',message:'Floating node uses Falstad reference stabilization',pins:net.terminals.map(([componentId,pinId])=>({componentId,pinId}))});
    for(const componentId of openSources)diagnostics.push({code:'OPEN_CURRENT_SOURCE',severity:'warning',message:'Open current source uses Falstad high-resistance fallback',componentId});
    const projection = {devices, nets, simulation: {timeStep: document.simulation.timeStep}};
    const canonical = JSON.stringify(projection);
    const hubs = new Map(nets.map((net, i) => [net.key, [32 + i * 64, -1024]]));
    check(32 + Math.max(devices.length, nets.length) * 512 < 2147483647, 'Circuit exceeds coordinate limit');
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
      const x = 32 + index * 512;
      let parameters = '';
      let flags = 0;
      if(outputSpecs[device.kind]){const encoding=outputRecord(device,x);parameters=encoding.parameters;flags=encoding.flags;}
      if (device.kind === 'resistor') parameters = ' ' + device.parameters.resistance;
      if (device.kind === 'voltageSource' || device.kind === 'voltageRail') {
        const w=device.parameters.waveform;
        const code={sine:1,square:2,triangle:3,sawtooth:4,pulse:5}[w.kind];
        if(w.kind==='pulse')flags=4;
        parameters=w.kind==='dc'?' 0 40 ' + w.voltage + ' 0 0 0.5':` ${code} ${w.frequency} ${w.amplitude} ${w.offset} ${w.phase??0} ${w.dutyCycle??0.5}`;
      }
      if (capacitor(device.kind)) {
        flags = device.parameters.integration === 'backwardEuler' ? 2 : 0;
        parameters = ` ${device.parameters.capacitance} ${device.parameters.initialVoltage} ${device.parameters.initialVoltage}`;
        if(device.kind==='polarizedCapacitor')parameters+=` ${device.parameters.maxReverseVoltage}`;
      }
      if(device.kind==='pushSwitch')parameters=` ${device.parameters.normallyClosed?0:1} true`;
      if(device.kind==='mbbSwitch')parameters=` ${device.parameters.position} false 0`;
      if(device.kind==='tappedTransformer'){flags=device.parameters.integration==='backwardEuler'?2:0;parameters=` ${device.parameters.inductance} ${device.parameters.ratio} 0 0 0 ${device.parameters.coupling}`;}
      if(device.kind==='customTransformer'){const p=device.parameters;flags=p.integration==='backwardEuler'?2:0;parameters=` ${p.inductance} ${p.coupling} ${[p.turns1,p.turns2,p.turns3].map(n=>String(n).replace('e+','e')).join(',').replace(/,([^,]*)$/,':$1')} 3 0 0 0`;}
      if(device.kind==='transmissionLine')parameters=` ${device.parameters.delay} ${device.parameters.impedance} 32 0`;
      if(analog(device.kind)){flags=(device.parameters.inverted?1:0)|(device.parameters.pulldown?2:0);parameters=` ${device.parameters.onResistance} ${device.parameters.offResistance} ${device.parameters.threshold}`;}
      if(device.kind==='transformer'){flags=device.parameters.integration==='backwardEuler'?2:0;parameters=` ${device.parameters.inductance} ${device.parameters.ratio} 0 0 ${device.parameters.coupling} 0`;}
      if(device.kind==='spdtSwitch'){flags=1;parameters=` ${device.parameters.position} false 0 2`;}
      if(device.kind==='dpdtSwitch')parameters=` ${device.parameters.position} false 2`;
      if(device.kind==='led'){flags=1;parameters=` ${device.parameters.forwardVoltage} 1 0 0 ${device.parameters.maxCurrent}`;}
      if(device.kind==='zener'){flags=1;parameters=` ${device.parameters.forwardVoltage} ${device.parameters.breakdownVoltage}`;}
      if(device.kind==='output')flags=device.parameters.showVoltage?1:0;
      if(device.kind==='logicOutput'){
        flags=(device.parameters.mode==='ternary'?1:0)|(device.parameters.mode==='numeric'?2:0)|(device.parameters.pulldown?4:0);
        parameters=' '+device.parameters.threshold;
      }
      if(device.kind==='logicInput'){
        flags=(device.parameters.mode==='ternary'?1:0)|(device.parameters.mode==='numeric'?2:0);
        parameters=` ${device.parameters.state} false ${device.parameters.highVoltage} ${device.parameters.lowVoltage}`;
      }
      if(flipFlop(device.kind)){
        const {highVoltage,initialState}=device.parameters;
        // ChipElm flags: SMALL=1, CUSTOM_VOLTAGE=8192; JK adds POSITIVE_EDGE=4.
        if(highVoltage!==5)flags|=8192;
        if(device.kind==='jkFlipFlop'&&device.parameters.positiveEdge)flags|=4;
        parameters=highVoltage!==5?` ${highVoltage}`:'';
        parameters+=` ${initialState?highVoltage:0} ${initialState?0:highVoltage}`;
      }
      if(nextChip(device.kind)){
        const p=device.parameters,custom=p.highVoltage!==5;
        flags=(custom?8192:0)|(device.kind==='counter'?(p.negativeEdge?8:0):device.kind==='latch'?2|(p.edgeTriggered?0:4):device.kind==='fullAdder'?2:0);
        parameters=(device.kind==='halfAdder'?'':' 4')+(custom?' '+p.highVoltage:'');
        if(device.kind==='counter')parameters+=' '+[3,2,1,0].map(bit=>(p.initialValue>>bit)&1?p.highVoltage:0).join(' ')+` ${p.invertReset} ${p.modulus}`;
        if(device.kind==='latch')parameters+=' '+[0,1,2,3].map(bit=>(p.initialValue>>bit)&1?p.highVoltage:0).join(' ');
      }
      if(bipolar(device.kind))parameters=` ${device.kind==='pnp'?-1:1} 0 0 ${device.parameters.beta}`;
      if(fet(device.kind)){flags=device.kind.startsWith('p')?1:0;parameters=` ${device.parameters.threshold} ${device.parameters.beta}`;}
      if(logic(device.kind))parameters=device.kind==='inverter'?` ${device.parameters.slewRate} ${device.parameters.highVoltage}`:` 2 0 ${device.parameters.highVoltage}`;
      if(device.kind==='inductor'){
        flags=device.parameters.integration==='backwardEuler'?2:0;
        parameters=` ${device.parameters.inductance} ${device.parameters.initialCurrent} ${device.parameters.initialCurrent} 0`;
      }
      if(device.kind==='currentSource')parameters=` ${device.parameters.current} ${device.parameters.maxVoltage}`;
      if(device.kind==='potentiometer')parameters=` ${device.parameters.resistance} ${device.parameters.position} Resistance`;
      if (device.kind === 'switch') parameters = ` ${device.parameters.closed ? 0 : 1} false`;
      if (device.kind === 'opamp') {
        flags=8;parameters=` ${device.parameters.maxOutput} ${device.parameters.minOutput} 1000000 0 0 ${device.parameters.gain}`;
      }
      const pot=device.kind==='potentiometer',three=bipolar(device.kind)||fet(device.kind)||(logic(device.kind)&&device.kind!=='inverter');
      const multiSwitch=['spdtSwitch','dpdtSwitch','mbbSwitch','tappedTransformer','customTransformer','transmissionLine'].includes(device.kind)||analog(device.kind),transformer=device.kind==='transformer';
      const chip=flipFlop(device.kind)||nextChip(device.kind)||['wattmeter','decimalDisplay','instructionDisplay','ledArray','threePhaseMotor'].includes(device.kind);
      records.push(`${model.type} ${x} 32 ${chip?x+64:device.kind==='opamp'?x+32:pot||three||multiSwitch||transformer?x+64:x} ${chip?32:device.kind==='opamp'||three||multiSwitch?32:pot?0:64} ${flags}${parameters}`);
      mapping.push({id: device.id, kind: device.kind, index: engineIndex, pins: [...model.pins], sign: model.sign});
      const chipPosts=outputPostPoints(device.kind,x)|| (chip?chipPostPoints(device.kind,x):null);
      model.pins.forEach((pin, post) => {
        const [hx, hy] = hubs.get(device.pins[pin]);
        const [px,py]=device.kind==='tappedTransformer'?[[x,32],[x,96],[x+64,32],[x+64,64],[x+64,96]][post]:device.kind==='customTransformer'?[[x,32],[x,64],[x,80],[x,112],[x+64,32],[x+64,112]][post]:device.kind==='transmissionLine'?[[x,64],[x+64,64],[x,32],[x+64,32]][post]:device.kind==='mbbSwitch'?[[x,32],[x+64,16],[x+64,48]][post]:chipPosts?chipPosts[post]:device.kind==='analogSwitch'?[[x,32],[x+64,32],[x+32,48]][post]:device.kind==='analogSpdtSwitch'?[[x,32],[x+64,16],[x+64,48],[x+32,16]][post]:transformer?[[x,32],[x+64,32],[x,64],[x+64,64]][post]:device.kind==='spdtSwitch'?[[x,32],[x+64,16],[x+64,48]][post]:device.kind==='dpdtSwitch'?[[x,32],[x+64,48],[x+64,16],[x,80],[x+64,96],[x+64,64]][post]:bipolar(device.kind)?[[x,32],[x+64,device.kind==='pnp'?48:16],[x+64,device.kind==='pnp'?16:48]][post]:fet(device.kind)?[[x,32],[x+64,48],[x+64,16]][post]:logic(device.kind)&&three?[[x,48],[x,16],[x+64,32]][post]:device.kind==='opamp'?[[x,16],[x,48],[x+32,32]][post]:pot?[[x,32],[x+64,32],[x+32,0]][post]:[x,32+post*32];
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
      const pinVoltages = [], componentCurrents = [], componentMeasurements = [];
      for (const entry of compiled.mapping) {
        const elm = raw.elements[entry.index];
        check(elm && entry.pins.every((_, post) => Number.isFinite(elm.voltages[post])) &&
          (entry.sign === null || Number.isFinite(elm.current)), 'Non-finite or missing engine result');
        pinVoltages.push([entry.id, Object.fromEntries(entry.pins.map((pin, post) => [pin, elm.voltages[post]]))]);
        if (entry.sign !== null) componentCurrents.push([entry.id, entry.sign * elm.current]);
        if(elm.measurements&&outputSpecs[entry.kind]){
          const valid=value=>value===null||typeof value==='boolean'||typeof value==='string'&&value.length<=10000||Number.isFinite(value)||Array.isArray(value)&&value.length<=1000000&&value.every(Number.isFinite);
          check(record(elm.measurements)&&Object.values(elm.measurements).every(valid),'Invalid component measurement');
          componentMeasurements.push([entry.id,structuredClone(elm.measurements)]);
        }
      }
      return {documentId: compiled.documentId, frameSequence: sequence, time: raw.time, timeStep: raw.timeStep,
        pinVoltages: Object.fromEntries(pinVoltages), componentCurrents: Object.fromEntries(componentCurrents),
        diagnostics: structuredClone(compiled.diagnostics),...(componentMeasurements.length?{componentMeasurements:Object.fromEntries(componentMeasurements)}:{}),...(raw.stopRequested?{stopRequested:true}:{})};
    }
    function install(next) {
      invoke(() => engine.load(next.text, next.timeStep));
      compiled = next; faulted = false; hasFrame = false; sequence = 0;
      return {documentId: next.documentId, time: 0, timeStep: next.timeStep, frameAvailable: false,
        componentIds: next.mapping.map(entry => entry.id), netCount: next.nets.length,
        diagnostics: structuredClone(next.diagnostics)};
    }
    return {
      ...(typeof engine.updateCircuit==='function'?{updateProjection:(projection,documentId)=>{
        active();const next=fromProjection(projection,documentId);
        check(next.documentId===compiled.documentId,'Live update requires the same document');
        const oldDevices=new Map(JSON.parse(compiled.canonical).devices.map(d=>[d.id,d])),oldEntries=new Map(compiled.mapping.map(e=>[e.id,e])),nextDevices=new Map(JSON.parse(next.canonical).devices.map(d=>[d.id,d]));
        const seenNew=new Set(),seenOld=new Set(),retained=[];
        for(const entry of next.mapping){const old=oldEntries.get(entry.id);if(!old||old.kind!==entry.kind||seenNew.has(entry.index)||seenOld.has(old.index))continue;
          retained.push([entry.index,old.index,JSON.stringify(oldDevices.get(entry.id).parameters)!==JSON.stringify(nextDevices.get(entry.id).parameters)]);seenNew.add(entry.index);seenOld.add(old.index);
        }
        const raw=invoke(()=>engine.updateCircuit(next.text,next.timeStep,retained));compiled=next;hasFrame=false;
        return {appliedAtTime:raw.time,frameAvailable:false,retainedComponents:retained.length};
      }}:{}),
      loadDocument: document => install(compile(document)),
      installProjection: (projection, documentId) => install(fromProjection(projection, documentId)),
      readCapture: componentId=>{
        active();const entry=compiled.mapping.find(item=>item.id===componentId&&['dataExport','audioOutput'].includes(item.kind));check(entry,'Expected recorder ID');
        const capture=invoke(()=>engine.readCapture(entry.index));check(record(capture)&&Array.isArray(capture.values)&&capture.values.length<=1000000&&capture.values.every(Number.isFinite)&&Number.isFinite(capture.timeStep)&&capture.timeStep>0&&Number.isFinite(capture.startTime),'Invalid capture');
        return {...structuredClone(capture),componentId};
      },
      setVariableVoltage:(componentId,voltage)=>{
        active();const entry=compiled.mapping.find(item=>item.id===componentId&&item.kind==='variableVoltage');check(entry&&Number.isFinite(voltage),'Expected variable source ID and finite voltage');
        const projection=JSON.parse(compiled.canonical);projection.devices.find(item=>item.id===componentId).parameters.voltage=voltage;
        const next=fromProjection(projection,compiled.documentId),raw=invoke(()=>engine.setVariableVoltage(entry.index,voltage));compiled=next;hasFrame=false;
        return {appliedAtTime:raw.time,frameAvailable:false};
      },
      setContact: (componentId, field, value) => {
        active();const entry=compiled.mapping.find(item=>item.id===componentId);
        const fields={pushSwitch:'normallyClosed',spdtSwitch:'position',dpdtSwitch:'position',mbbSwitch:'position',logicInput:'state'};
        check(entry&&fields[entry.kind]===field,'Expected switch/input state field');
        const projection=JSON.parse(compiled.canonical);projection.devices.find(d=>d.id===componentId).parameters[field]=value;
        const next=fromProjection(projection,compiled.documentId),position=entry.kind==='pushSwitch'?(value?0:1):value;
        const raw=invoke(()=>engine.setContact(entry.index,position));compiled=next;hasFrame=false;
        return {appliedAtTime:raw.time,frameAvailable:false};
      },
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
            if(raw.stopRequested)break;
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
  const api=Object.freeze({outputSpecs, graphic, compile, fromProjection, createSession, normalizeSampleChannels});
  registry.adapter=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
