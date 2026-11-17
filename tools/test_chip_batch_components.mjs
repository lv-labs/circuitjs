import {editing as CircuitEditorModel, adapter as CircuitDocumentAdapter} from '../packages/circuit-core/index.mjs';
import assert from 'node:assert/strict';
import {createEngine} from './engine_node_runtime.mjs';
import {chipBatchKinds,chipOutputs,chipBatchCircuit} from './chip_batch_fixtures.mjs';
const M=CircuitEditorModel,A=CircuitDocumentAdapter,engine=createEngine(),session=A.createSession(engine);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const word=(frame,prefix)=>[0,1,2,3].reduce((value,bit)=>value+((frame.pinVoltages.part[prefix+bit]>2.5?1:0)<<bit),0);
const square=frequency=>({kind:'square',amplitude:2.5,offset:2.5,frequency,dutyCycle:.5});
for(const kind of chipBatchKinds){
 const d=chipBatchCircuit(kind),compiled=A.compile(d);M.validate(d);assert.equal(A.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
 for(const rotation of [0,90,180,270])for(const mirror of [false,true]){
  const rotated=structuredClone(d);Object.assign(rotated.layout.components.part,{rotation,mirror});
  for(const pinId of Object.keys(M.definitions[kind].pins)){const p=M.pin(rotated,{kind:'pin',componentId:'part',pinId});assert.equal(Math.abs(p.x%M.grid),0);assert.equal(Math.abs(p.y%M.grid),0);}
  assert.equal(A.compile(rotated).canonical,compiled.canonical);
 }
 const model=M.create(d),before=model.document;model.transaction('Edit',next=>{next.electrical.components[0].parameters.highVoltage=3.3;});const after=model.document;model.undo();assert.deepEqual(model.document,before);model.redo();assert.deepEqual(model.document,after);
 const pasted=structuredClone(d),fragment=M.copySelection(d,new Set([M.token('component','part')]));M.pasteSelection(pasted,fragment);M.validate(pasted);
 const pose=d.layout.components.part,height=Math.max(...Object.values(M.definitions[kind].pins).map(p=>Math.abs(p[1])))+8;
 assert.equal(M.hit(d,{x:pose.x,y:pose.y+height},1)?.id,'part','Whole chip body selectable');
 session.loadDocument(d);const first=session.step(10);session.reset();assert.deepEqual(session.step(10),first);assert.ok(!('part' in first.componentCurrents));
 const custom=chipBatchCircuit(kind,{highVoltage:3.3});session.loadDocument(custom);for(const output of chipOutputs[kind])assert.ok([0,3.3].some(v=>Math.abs(session.step(2).pinVoltages.part[output]-v)<1e-10));
 const invalid=structuredClone(d);invalid.electrical.components[0].parameters.unknown=1;assert.throws(()=>A.compile(invalid));
 for(const pins of [[chipOutputs[kind][0],'g','g'],[chipOutputs[kind][0],'part',chipOutputs[kind][1]]]){
  const loop=structuredClone(d);loop.electrical.wires.push({id:'short',from:{kind:'pin',componentId:'part',pinId:pins[0]},to:{kind:'pin',componentId:pins[1],pinId:pins[2]}});assert.throws(()=>A.compile(loop),/ideal chip output loop/);
 }
 const floating=structuredClone(d),input=Object.keys(M.definitions[kind].pins).find(p=>!chipOutputs[kind].includes(p));floating.electrical.wires=floating.electrical.wires.filter(w=>!(w.from.componentId==='in'+input));assert.ok(A.compile(floating).diagnostics.some(d=>d.code==='FLOATING_NET'));
}
for(const [kind,parameters,inputs,highPins] of [
 ['counter',{invertReset:false,initialValue:9},{reset:0,clock:0},['Q3','Q0']],
 ['latch',{initialValue:9},{load:0},['O3','O0']],
 ['halfAdder',{}, {A:5,B:5},['carry']],
 ['fullAdder',{},Object.fromEntries([...['A','B'].flatMap(prefix=>[0,1,2,3].map(bit=>[prefix+bit,5])),['carryIn',5]]),['S0','S1','S2','S3','carryOut']]
]){
 session.loadDocument(chipBatchCircuit(kind,{...parameters,highVoltage:3.3},inputs));const frame=session.step(3);
 for(const pin of chipOutputs[kind])near(frame.pinVoltages.part[pin],highPins.includes(pin)?3.3:0);
}
// Half-adder truth table and all 512 combinations of the 4-bit adder, including carry.
for(let a=0;a<2;a++)for(let b=0;b<2;b++){
 session.loadDocument(chipBatchCircuit('halfAdder',{}, {A:a*5,B:b*5}));const f=session.step(3);near(f.pinVoltages.part.sum,(a^b)*5);near(f.pinVoltages.part.carry,(a&b)*5);
}
for(let a=0;a<16;a++)for(let b=0;b<16;b++)for(let cin=0;cin<2;cin++){
 const inputs={carryIn:cin*5};for(let bit=0;bit<4;bit++){inputs['A'+bit]=((a>>bit)&1)*5;inputs['B'+bit]=((b>>bit)&1)*5;}
 session.loadDocument(chipBatchCircuit('fullAdder',{},inputs));const f=session.step(3);assert.equal(word(f,'S'),(a+b+cin)&15);near(f.pinVoltages.part.carryOut,a+b+cin>15?5:0);
}
// Counter: repeated edges, state restore, polarity, modulus and asynchronous reset.
for(const negativeEdge of [false,true])for(const modulus of [0,1,5,16])for(const initialValue of [0,3,15]){
 const d=chipBatchCircuit('counter',{negativeEdge,modulus,initialValue},{clock:square(1000)});session.loadDocument(d);
 let expected=initialValue,lastClock=false,previous={clock:0,reset:0};
 for(let step=0;step<650;step++){
  const clock=previous.clock>2.5;
  if(negativeEdge?!clock&&lastClock:clock&&!lastClock)expected=(expected+1)%(modulus||16);
  if(previous.reset<=2.5)expected=0;lastClock=clock;
  const f=session.step(1);assert.equal(word(f,'Q'),expected,`counter step ${step}`);previous=f.pinVoltages.part;
 }
}
for(const invertReset of [false,true]){
 session.loadDocument(chipBatchCircuit('counter',{invertReset,initialValue:9},{clock:0,reset:invertReset?5:0}));const first=session.step(1);assert.equal(word(first,'Q'),invertReset?0:9);
 assert.equal(word(session.step(3),'Q'),invertReset?0:9);
 session.loadDocument(chipBatchCircuit('counter',{invertReset},{clock:square(1000),reset:invertReset?0:5}));assert.equal(word(session.step(400),'Q'),0);
}
// Latch/register: sample last solved inputs on each step, transparent or rising load.
for(const edgeTriggered of [false,true])for(const initialValue of [0,9,15]){
 const inputs={load:square(1000)};for(let bit=0;bit<4;bit++)inputs['I'+bit]=square(137+bit*101);
 session.loadDocument(chipBatchCircuit('latch',{edgeTriggered,initialValue},inputs));
 let expected=initialValue,lastLoad=false,previous={load:0,I0:0,I1:0,I2:0,I3:0},changes=0;
 for(let step=0;step<1000;step++){
  const load=previous.load>2.5;if(load&&(!edgeTriggered||!lastLoad)){expected=[0,1,2,3].reduce((v,b)=>v+((previous['I'+b]>2.5?1:0)<<b),0);changes++;}lastLoad=load;
  const f=session.step(1);assert.equal(word(f,'O'),expected);previous=f.pinVoltages.part;
 }
 assert.ok(changes>=10);
}
for(const [kind,p] of [['counter',{initialValue:16}],['counter',{modulus:17}],['counter',{negativeEdge:1}],['counter',{invertReset:'true'}],['latch',{edgeTriggered:1}],['latch',{initialValue:-1}],['halfAdder',{highVoltage:0}],['fullAdder',{highVoltage:NaN}]]){
 const d=chipBatchCircuit(kind,p);assert.throws(()=>M.validate(d));assert.throws(()=>A.compile(d));
}
session.loadDocument(chipBatchCircuit('halfAdder'));const prior=engine.snapshot();
for(const record of ['164 0 32 64 32 0 3 0 0 0 0 true 0','164 0 32 64 32 0 4 0 0 0 0 true 17','164 0 32 64 32 0 4 0 0 0 0 nope 0','164 0 32 64 32 4 4 0 0 0 0 true 0','168 0 32 64 32 0 4 0 0 0 0','168 0 32 64 32 2 4 0 0 2 0','195 0 32 64 32 1','195 0 32 64 32 8192 0','196 0 32 64 32 0 4','196 0 32 64 32 2 5']){
 assert.throws(()=>engine.load(record,1e-5));assert.deepEqual(engine.snapshot(),prior);
}
console.log('Chip batch checks passed: counter edges/reset/modulus, latch/register timing/state, half/full-adder truth tables, post mapping, custom voltage, history/copy/geometry, topology and loader guards.');
