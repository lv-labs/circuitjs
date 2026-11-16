import assert from 'node:assert/strict';
import '../experiments/engine/document-adapter.js';
import '../experiments/engine/revision-protocol.js';
import '../experiments/engine/simulation-coordinator.js';
import '../experiments/engine/output-tools.js';
import {createEngine} from './engine_node_runtime.mjs';
import {outputFamilyKinds,outputFamilyCircuit} from './output_family_fixtures.mjs';
const M=CircuitEditorModel,A=CircuitDocumentAdapter,engine=createEngine(),session=A.createSession(engine);
const near=(a,b,tolerance=1e-10)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
assert.deepEqual(M.outputSpecs,A.outputSpecs,'Editor and compiler field contracts agree');
for(const kind of outputFamilyKinds){
 const d=outputFamilyCircuit(kind),compiled=A.compile(d);M.validate(d);assert.equal(A.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
 for(const rotation of [0,90,180,270])for(const mirror of [false,true]){
  const copy=structuredClone(d);Object.assign(copy.layout.components.part,{rotation,mirror});for(const pinId of Object.keys(M.definitions[kind].pins)){const p=M.pin(copy,{kind:'pin',componentId:'part',pinId});assert.equal(Math.abs(p.x%16),0);assert.equal(Math.abs(p.y%16),0);}assert.equal(A.compile(copy).canonical,compiled.canonical);
 }
 const model=M.create(d),before=model.document;model.transaction('Edit',next=>{next.electrical.components[0].reference='Changed';});const after=model.document;model.undo();assert.deepEqual(model.document,before);model.redo();assert.deepEqual(model.document,after);
 const copy=structuredClone(d);M.pasteSelection(copy,M.copySelection(d,new Set([M.token('component','part')])));M.validate(copy);
 session.loadDocument(d);const f=session.step(10);session.reset();assert.deepEqual(session.step(10),f);
 const bad=structuredClone(d);bad.electrical.components[0].parameters.extra=1;assert.throws(()=>M.validate(bad));assert.throws(()=>A.compile(bad));
 const missing=structuredClone(d),field=Object.keys(M.outputSpecs[kind].fields)[0];if(field){delete missing.electrical.components[0].parameters[field];assert.throws(()=>A.compile(missing));}
}
// Graphics are inert, remain in saved documents and history, and do not create terminals or reset electrical identity.
for(const kind of ['text','box','line']){
 const d=outputFamilyCircuit(kind),compiled=A.compile(d),without=structuredClone(d);without.electrical.components=without.electrical.components.filter(c=>c.id!=='part');delete without.layout.components.part;
 assert.equal(A.compile(without).canonical,compiled.canonical);assert.ok(!compiled.mapping.some(e=>e.id==='part'));
 const changed=structuredClone(d);if(kind==='text'){changed.electrical.components[0].parameters.text='<tag> & α\nText + emoji ⚡';changed.electrical.components[0].parameters.size=32;}else changed.electrical.components[0].parameters.width=256;
 assert.equal(A.compile(changed).canonical,compiled.canonical);M.validate(changed);
 const model=M.create(changed),saved=JSON.stringify(model.document);assert.deepEqual(JSON.parse(saved),changed);
 const pose=changed.layout.components.part,b=M.bounds(changed,changed.electrical.components[0]);assert.ok(b.right>b.x&&b.bottom>b.y);assert.equal(M.hit(changed,{x:pose.x+(kind==='box'?changed.electrical.components[0].parameters.width/2:0),y:pose.y},1)?.id,'part');if(kind==='box')assert.notEqual(M.hit(changed,{x:pose.x,y:pose.y},1)?.id,'part','Box interiors do not cover other components');
}
// Named nodes connect by explicit name, regardless of geometry; no redundant legacy alias loops.
{
 const d=outputFamilyCircuit('labeledNode');d.electrical.components.push({id:'alias',kind:'labeledNode',reference:'N2',modelVersion:1,parameters:{name:'NET'}},{id:'load',kind:'resistor',reference:'R',modelVersion:1,parameters:{resistance:1000}});
 d.electrical.wires.push({id:'alias-load',from:{kind:'pin',componentId:'alias',pinId:'in'},to:{kind:'pin',componentId:'load',pinId:'a'}},{id:'return',from:{kind:'pin',componentId:'load',pinId:'b'},to:{kind:'pin',componentId:'g',pinId:'g'}});
 session.loadDocument(d);near(session.step(3).pinVoltages.load.a,5);
 d.electrical.components.find(c=>c.id==='alias').parameters.name='OTHER';session.loadDocument(d);near(session.step(3).pinVoltages.load.a,0);
}
// Loaded variable source range, zero/negative values and a live RC edit preserving time and charge.
for(const voltage of [-5,0,2.5,5]){session.loadDocument(outputFamilyCircuit('variableVoltage',{minVoltage:-5,maxVoltage:5,voltage}));const f=session.step(3);near(f.pinVoltages.part.p,voltage);near(f.componentCurrents.part,-voltage/1000);}
{
 const d=outputFamilyCircuit('variableVoltage'),load=d.electrical.components.find(c=>c.id==='load');
 d.electrical.components.push({id:'cap',kind:'capacitor',modelVersion:1,reference:'C',parameters:{capacitance:1e-6,initialVoltage:0,integration:'backwardEuler'}});
 d.electrical.wires=d.electrical.wires.filter(w=>!(w.from.componentId==='load'&&w.from.pinId==='b'));
 d.electrical.wires.push({id:'rc',from:{kind:'pin',componentId:'load',pinId:'b'},to:{kind:'pin',componentId:'cap',pinId:'a'}},{id:'ground-cap',from:{kind:'pin',componentId:'cap',pinId:'b'},to:{kind:'pin',componentId:'g',pinId:'g'}});
 session.loadDocument(d);const before=session.step(100),raw=engine.snapshot(),charge=before.pinVoltages.cap.a;
 const applied=session.setVariableVoltage('part',4);near(applied.appliedAtTime,before.time);assert.deepEqual(engine.snapshot().elements.find(e=>e.id===A.compile(d).mapping.find(m=>m.id==='cap').index).voltages,raw.elements[A.compile(d).mapping.find(m=>m.id==='cap').index].voltages);
 const after=session.step(1);near(after.time,before.time+d.simulation.timeStep);near(after.pinVoltages.cap.a,(charge+4*.01)/1.01);
 const preserved=session.snapshot();assert.throws(()=>session.setVariableVoltage('part',6));assert.deepEqual(session.snapshot(),preserved);
 assert.throws(()=>session.setVariableVoltage('load',3));assert.deepEqual(session.snapshot(),preserved);
}
// Instantaneous meters preserve their legacy electrical behavior; ammeters are ideal series connections.
for(const voltage of [-3,0,5]){
 session.loadDocument(outputFamilyCircuit('voltmeter',{},voltage));let f=session.step(3);near(f.componentMeasurements.part.value,voltage);near(f.componentCurrents.part,voltage/1e7);
 session.loadDocument(outputFamilyCircuit('ammeter',{},voltage));f=session.step(3);near(f.componentMeasurements.part.value,voltage/1000);near(f.pinVoltages.part.a,f.pinVoltages.part.b);
 session.loadDocument(outputFamilyCircuit('wattmeter',{},voltage));f=session.step(3);near(f.componentMeasurements.part.value,voltage*voltage/1000);
 session.loadDocument(outputFamilyCircuit('testPoint',{},voltage));near(session.step(3).componentMeasurements.part.value,voltage);
}
session.loadDocument(outputFamilyCircuit('ohmmeter'));near(session.step(3).componentMeasurements.part.value,1000);
// RMS and extrema reuse the original meter accumulators over complete sine cycles.
for(const kind of ['voltmeter','testPoint','ammeter'])for(const mode of (kind==='ammeter'?[1]:[1,2,3,4])){
 const d=outputFamilyCircuit(kind,{mode});d.electrical.components.find(c=>c.id==='vin').parameters.waveform={kind:'sine',amplitude:5,offset:0,frequency:1000};session.loadDocument(d);
 const value=session.step(3000).componentMeasurements.part.value,expected=mode===1?5/Math.sqrt(2):mode===2?5:mode===3?-5:10;near(value,expected/(kind==='ammeter'?1000:1),1e-9);
}
// Original lamp cold-resistance equation and motor RL limit with electromechanical constants set to zero.
{
 const d=outputFamilyCircuit('lamp'),p=d.electrical.components[0].parameters,t=300;
 const r=p.nominalVoltage**2/p.nominalPower*(1.26104-4.90662*Math.sqrt(17.1839/t-.00318794)-7.8569/(t-187.56));session.loadDocument(d);const f=session.step(1);near(f.componentCurrents.part,5/(1000+r));near(f.componentMeasurements.part.resistance,r);
}
{
 const d=outputFamilyCircuit('dcMotor',{torqueConstant:0,backEmfConstant:0});session.loadDocument(d);
 for(let step=1;step<=50;step++){const f=session.step(1);near(f.componentCurrents.part,5/1001*(1-(.5/(.5+1001*d.simulation.timeStep))**step));near(f.componentMeasurements.part.speed,0);}
}
for(let value=0;value<16;value++){
 for(const mode of [0,1,2]){session.loadDocument(outputFamilyCircuit('decimalDisplay',{mode},value));const f=session.step(3);assert.equal(f.componentMeasurements.part.text,value.toString(mode===1?16:mode===2?8:10).toUpperCase());}
 session.loadDocument(outputFamilyCircuit('instructionDisplay',{lookup:'0=ZERO\n1-15=Word {a}'},value));assert.equal(session.step(3).componentMeasurements.part.text,value?'Word '+value:'ZERO');
}
{
 session.loadDocument(outputFamilyCircuit('ledArray'));const f=session.step(10),currents=f.componentMeasurements.part.currents;assert.equal(currents.length,64);assert.ok(currents.slice(0,8).every(i=>i>0));assert.ok(currents.slice(8).every(i=>Math.abs(i)<1e-12));
 near(f.componentCurrents.row0,currents.slice(0,8).reduce((a,b)=>a-b,0),1e-8);
}
// Balanced three-phase excitation and phase-sequence reversal produce opposite signed rotation.
{
 let forward;
 for(const reverse of [false,true]){
  const d=outputFamilyCircuit('threePhaseMotor',{},30);if(reverse)for(const c of d.electrical.components)if(c.kind==='voltageRail'&&c.parameters.waveform.phase)c.parameters.waveform.phase*=-1;
  session.loadDocument(d);const f=session.step(3000);near(f.pinVoltages.part.U1+f.pinVoltages.part.V1+f.pinVoltages.part.W1,0,1e-10);
  if(reverse)near(f.componentMeasurements.part.speed,-forward,1e-10);else{forward=f.componentMeasurements.part.speed;assert.ok(forward>0);}
 }
}
// Bounded capture, read without stepping, CSV/WAV headers, reset and audio sampling.
{
 const d=outputFamilyCircuit('dataExport',{capacity:5});d.electrical.components.find(c=>c.id==='vin').parameters.waveform={kind:'sine',amplitude:1,offset:0,frequency:1000};session.loadDocument(d);session.step(12);const before=session.snapshot(),capture=session.readCapture('part');assert.equal(capture.values.length,5);near(capture.startTime,7*d.simulation.timeStep);
 for(let i=0;i<5;i++)near(capture.values[i],Math.sin(2*Math.PI*1000*(7+i)*d.simulation.timeStep));
 assert.deepEqual(session.snapshot(),before);const csv=CircuitOutputTools.csv(capture);assert.equal(csv.split('\n').length,7);assert.ok(csv.startsWith('time_s,voltage_V\n'));session.reset();assert.equal(session.readCapture('part').values.length,0);
}
{
 const d=outputFamilyCircuit('audioOutput',{duration:.01,sampleRate:8000});d.electrical.components.find(c=>c.id==='vin').parameters.waveform={kind:'sine',amplitude:1,offset:0,frequency:1000};session.loadDocument(d);session.step(1200);const capture=session.readCapture('part');assert.equal(capture.values.length,80);near(capture.timeStep,1/8000);
 assert.ok(Math.max(...capture.values)>.5&&Math.min(...capture.values)<-.5);const wav=CircuitOutputTools.wav(capture),view=new DataView(wav),bytes=new Uint8Array(wav);assert.equal(String.fromCharCode(...bytes.slice(0,4)),'RIFF');assert.equal(view.getUint32(24,true),8000);assert.equal(view.getUint32(40,true),160);assert.equal(wav.byteLength,204);assert.ok(CircuitOutputTools.normalized(capture.values).every(v=>Math.abs(v)<=.200001));session.reset();assert.equal(session.readCapture('part').values.length,0);
}
assert.ok(CircuitOutputTools.normalized([Number.MAX_VALUE,-Number.MAX_VALUE]).every(Number.isFinite));
assert.deepEqual([...CircuitOutputTools.normalized([1,1,1])],[0,0,0]);
// Trigger stops a bounded call and sampled batch at the requested physical step, without faulting.
for(const channels of [undefined,[{id:'v',positive:{componentId:'part',pinId:'in'},negative:null}]]){
 session.loadDocument(outputFamilyCircuit('stopTrigger',{threshold:2,delay:.0002}));const f=session.step(1000,channels);assert.equal(f.stopRequested,true);assert.ok(f.time>=.00021-1e-12&&f.time<.00023);if(channels){assert.ok(f.sampleBatch.times.length<1000);assert.equal(f.sampleBatch.values.v.length,f.sampleBatch.times.length);}assert.doesNotThrow(()=>session.snapshot());
}
for(const [kind,p] of [['variableVoltage',{voltage:6}],['variableVoltage',{minVoltage:5}],['lamp',{warmTime:0}],['lamp',{initialTemperature:100}],['labeledNode',{name:''}],['voltmeter',{resistance:-1}],['ohmmeter',{current:-1}],['ammeter',{mode:2}],['decimalDisplay',{mode:3}],['instructionDisplay',{lookup:'16=NO'}],['dataExport',{capacity:0}],['audioOutput',{sampleRate:9000}],['stopTrigger',{delay:-1}],['dcMotor',{inertia:0}],['threePhaseMotor',{mutualInductance:10}]]){const d=outputFamilyCircuit(kind,p);assert.throws(()=>M.validate(d));assert.throws(()=>A.compile(d));}
for(const kind of ['ammeter','wattmeter']){
 const d=outputFamilyCircuit(kind),pins=kind==='ammeter'?['a','b']:['currentIn','currentOut'];d.electrical.wires.push({id:'short',from:{kind:'pin',componentId:'part',pinId:pins[0]},to:{kind:'pin',componentId:'part',pinId:pins[1]}});assert.throws(()=>A.compile(d),/ideal.*loop/);
}
// Raw loader validation happens before replacing the existing circuit.
session.loadDocument(outputFamilyCircuit('variableVoltage'));const preserved=engine.snapshot();
for(const record of ['172 0 32 0 64 0 6 6 5 0 0 .5 Voltage','181 0 32 0 64 0 300 100 120 0 .4','p 0 32 0 64 3 0 0 -1','370 0 32 0 64 3 2 0','210 0 32 0 64 0 0','211 0 32 0 64 0 1 9000 1','408 0 32 0 64 0 1 2 0','415 0 32 0 64 0 .5 1 .15 .15 0 .05 1 0','427 0 32 64 32 0 .435 .816 .0294 .0297 10 .05 1']){assert.throws(()=>engine.load(record,1e-5));assert.deepEqual(engine.snapshot(),preserved);}
console.log('Output family checks passed: all 19 models, annotations/named nets, live variable RC, meters/lamp/motor numerics, display logic, LED loading, recorder/CSV/WAV, stop triggers, geometry/history and loader guards.');
