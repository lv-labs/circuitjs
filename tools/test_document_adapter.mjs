import {adapter as CircuitDocumentAdapter} from '../packages/circuit-core/index.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {compile, createSession} = CircuitDocumentAdapter;
const document = JSON.parse(await readFile(new URL('../docs/new-simulator/examples/voltage-divider.json', import.meta.url)));
const original = compile(document);
assert.equal(original.nets.length, 3);
assert.deepEqual(original.nets.map(n => n.terminals.length).sort(), [2,2,3]);
const unchanged = fixture => {
  const result = compile(fixture);
  assert.equal(result.canonical, original.canonical);
  assert.equal(result.text, original.text);
};
const layout = structuredClone(document);
for (const pose of Object.values(layout.layout.components)) Object.assign(pose, {x: 0, y: 0, rotation: 270, mirror: true});
for (const route of Object.values(layout.layout.wires)) route.bends = [{x:0,y:0},{x:999,y:-999}];
layout.title = 'Different appearance';
layout.electrical.components.forEach(c => c.reference = 'Changed display label');
layout.probes = [];
unchanged(layout);
const reordered = structuredClone(document);
for (const values of Object.values(reordered.electrical)) values.reverse();
unchanged(reordered);
const split = structuredClone(document);
split.electrical.junctions.push({id:'middle'});
const wire = split.electrical.wires.find(w => w.id === 'w2');
const end = wire.to;
wire.to = {kind:'junction',junctionId:'middle'};
split.electrical.wires.push({id:'new-edge',from:wire.to,to:end});
split.layout.junctions.middle = {x:123,y:456};
split.layout.wires['new-edge'] = {bends:[]};
unchanged(split);
const duplicateEdge = structuredClone(document);
duplicateEdge.electrical.wires.push({...structuredClone(document.electrical.wires[0]),id:'parallel-edge'});
unchanged(duplicateEdge);
const reconnected = structuredClone(document);
reconnected.electrical.wires.find(w=>w.id==='w3').from = {kind:'pin',componentId:'v1',pinId:'p'};
assert.notEqual(compile(reconnected).canonical,original.canonical);
assert.ok(compile(reconnected).diagnostics.some(d=>d.code==='UNCONNECTED_PIN'));
const extraGround=structuredClone(document);
extraGround.electrical.components.push({id:'g2',kind:'ground',modelVersion:1,reference:'GND2',parameters:{}});
const sharedGround=compile(extraGround);
assert.equal(sharedGround.text.split('\n').filter(row=>row.startsWith('g ')).length,1);
assert.equal(sharedGround.mapping.find(m=>m.id==='g1').index,sharedGround.mapping.find(m=>m.id==='g2').index);
const shorted = structuredClone(document);
shorted.electrical.wires.find(w=>w.id==='w2').to = {kind:'pin',componentId:'r1',pinId:'a'};
const shortedCompiled = compile(shorted);
const r1 = shortedCompiled.text.split('\n')[shortedCompiled.mapping.find(m=>m.id==='r1').index].split(' ');
assert.notDeepEqual(r1.slice(1,3),r1.slice(3,5), 'Shorted resistor retains distinct private endpoints');
function invalid(change, code='INVALID_DOCUMENT') {
  const fixture=structuredClone(document); change(fixture);
  assert.throws(()=>compile(fixture),error=>error.code===code);
}
invalid(d=>d.electrical.components.push(structuredClone(d.electrical.components[0])));
invalid(d=>d.electrical.junctions.push({id:'j-out'}));
invalid(d=>d.electrical.wires.push(structuredClone(d.electrical.wires[0])));
invalid(d=>d.electrical.wires[0].from.pinId='unknown');
invalid(d=>d.electrical.wires[0].from.componentId='unknown');
invalid(d=>d.electrical.wires[0].to={kind:'junction',junctionId:'unknown'});
invalid(d=>d.electrical.components.find(c=>c.id==='r1').parameters.resistance=NaN);
invalid(d=>d.electrical.components.find(c=>c.id==='r1').parameters.resistance=0);
invalid(d=>d.electrical.components.find(c=>c.id==='r1').parameters.unrecognizedElectricalValue=1);
invalid(d=>d.electrical.components[0].modelVersion=2,'UNSUPPORTED_MODEL');
invalid(d=>d.electrical.components[0].kind='unknown-model','UNSUPPORTED_MODEL');
invalid(d=>d.simulation.timeStep=Infinity);
invalid(d=>d.simulation.unrecognizedSolverMode=true);
invalid(d=>d.electrical.wires[0].resistance=100);
invalid(d=>d.electrical.components[0].unrecognizedElectricalSetting=true);
invalid(d=>d.schemaVersion=2);
invalid(d=>{d.electrical.components=d.electrical.components.filter(c=>c.kind!=='ground');});
const loose=structuredClone(document);loose.electrical.wires=[];assert.ok(compile(loose).diagnostics.some(d=>d.code==='FLOATING_NET'));
invalid(d=>d.electrical.wires.push({id:'source-short',from:{kind:'pin',componentId:'v1',pinId:'p'},to:{kind:'pin',componentId:'v1',pinId:'n'}}));
// Failure after touching a singleton engine cannot be presented as old valid state.
let calls=0;
const session=createSession({load(){ if(++calls===2) throw new Error('simulated solver failure'); }});
session.loadDocument(document);
assert.throws(()=>session.loadDocument({}),e=>e.code==='INVALID_DOCUMENT');
assert.equal(calls,1,'Validation must precede mutation');
assert.throws(()=>session.loadDocument(document),e=>e.code==='ENGINE_FAILURE');
assert.throws(()=>session.snapshot(),e=>e.code==='ENGINE_FAILURE');
assert.equal(session.loadDocument(document).frameAvailable,false,'Explicit reload recovers faulted session');
const exposed=compile(document);
exposed.mapping[0].pins.push('accidental mutation');
unchanged(document);
console.log('Document compiler checks passed: graph equivalence, connectivity changes, shorts, validation and fault handling.');

const opamp=JSON.parse(await readFile(new URL('../docs/new-simulator/examples/opamp-noninverting.json',import.meta.url)));
const opCompiled=compile(opamp),opMapping=opCompiled.mapping.find(m=>m.id==='u1');
assert.deepEqual(opMapping.pins,['minus','plus','out']);assert.equal(opMapping.sign,-1);
assert.match(opCompiled.text,/^a \d+ 32 \d+ 32 8 15 -15 1000000 0 0 100000$/m);
assert.equal(CircuitDocumentAdapter.fromProjection(JSON.parse(opCompiled.canonical),opamp.id).canonical,opCompiled.canonical,'Op-amp worker revalidation');
for(const update of [{gain:0},{gain:Infinity},{minOutput:15},{maxOutput:-15},{minOutput:NaN},{unknown:1}]){
 const bad=structuredClone(opamp);Object.assign(bad.electrical.components.find(c=>c.id==='u1').parameters,update);assert.throws(()=>compile(bad),/op-amp|fields/);
}
const floatingInput=structuredClone(opamp);floatingInput.electrical.wires=floatingInput.electrical.wires.filter(w=>w.id!=='w1');assert.ok(compile(floatingInput).diagnostics.some(d=>d.code==='FLOATING_NET'));
console.log('Op-amp compiler checks passed: post order, output-current sign, worker revalidation and parameter/input validation.');

const sine=JSON.parse(await readFile(new URL('../docs/new-simulator/examples/opamp-sine.json',import.meta.url)));
const sineCompiled=compile(sine),sourceRecord=sineCompiled.text.split('\n')[sineCompiled.mapping.find(m=>m.id==='vin').index].split(' ');
assert.deepEqual(sourceRecord.slice(6),['1','1000','0.5','0.25','0','0.5'],'Sine amplitude/frequency/offset encoded without DC shape changes');
assert.equal(CircuitDocumentAdapter.fromProjection(JSON.parse(sineCompiled.canonical),sine.id).canonical,sineCompiled.canonical);
for(const update of [{amplitude:-1},{amplitude:Infinity},{frequency:0},{frequency:-100},{frequency:Infinity},{frequency:1e308},{offset:NaN},{offset:Infinity},{unknownPhase:1}]){
 const bad=structuredClone(sine);Object.assign(bad.electrical.components.find(c=>c.id==='vin').parameters.waveform,update);assert.throws(()=>compile(bad),/sine|fields/);
}
const zeroSine=structuredClone(sine);zeroSine.electrical.components.find(c=>c.id==='vin').parameters.waveform.amplitude=0;compile(zeroSine);
console.log('Sine compiler checks passed: legacy encoding, projection revalidation, zero amplitude and invalid-parameter rejection.');

const rail=structuredClone(sine);rail.electrical.components.find(c=>c.id==='vin').kind='voltageRail';rail.electrical.wires=rail.electrical.wires.filter(w=>w.id!=='w2');
const railCompiled=compile(rail);assert.equal(railCompiled.mapping.find(m=>m.id==='vin').pins.join(','),'p');assert.match(railCompiled.text,/^R /m);
assert.equal(CircuitDocumentAdapter.fromProjection(JSON.parse(railCompiled.canonical),rail.id).canonical,railCompiled.canonical);
for(const kind of ['square','triangle','sawtooth','pulse']){
 const d=structuredClone(rail),w=d.electrical.components.find(c=>c.id==='vin').parameters.waveform;w.kind=kind;
 if(['square','pulse'].includes(kind))w.dutyCycle=.3;
 const compiled=compile(d),tokens=compiled.text.split('\n')[compiled.mapping.find(m=>m.id==='vin').index].split(' ');
 assert.equal(tokens[6],String({square:2,triangle:3,sawtooth:4,pulse:5}[kind]));assert.equal(tokens[5],kind==='pulse'?'4':'0');
 assert.equal(CircuitDocumentAdapter.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
 if(['square','pulse'].includes(kind))for(const duty of [0,1,-.1,NaN,Infinity]){const bad=structuredClone(d);bad.electrical.components.find(c=>c.id==='vin').parameters.waveform.dutyCycle=duty;assert.throws(()=>compile(bad),/duty/);}
}
const loneRail={schemaVersion:1,id:'rail-only',electrical:{components:[{id:'v',kind:'voltageRail',modelVersion:1,parameters:{waveform:{kind:'dc',voltage:5}}}],junctions:[],wires:[]},simulation:{timeStep:1e-5}};
compile(loneRail);assert.equal(CircuitDocumentAdapter.fromProjection(JSON.parse(compile(loneRail).canonical),loneRail.id).canonical,compile(loneRail).canonical,'Implicit reference survives worker revalidation without ground symbol');
const groundedRail=structuredClone(rail);groundedRail.electrical.wires.push({id:'short-rail',from:{kind:'pin',componentId:'vin',pinId:'p'},to:{kind:'pin',componentId:'g1',pinId:'g'}});assert.throws(()=>compile(groundedRail),/loop/);
console.log('AC/rail compiler checks passed: one-terminal mapping, all periodic waveforms/duty flags, implicit ground, loop guards and projection roundtrips.');
