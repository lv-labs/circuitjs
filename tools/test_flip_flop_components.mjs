import assert from 'node:assert/strict';
import '../experiments/engine/document-adapter.js';
import {createEngine} from './engine_node_runtime.mjs';
import {flipFlopKinds,flipFlopCircuit} from './flip_flop_fixtures.mjs';
const M=CircuitEditorModel,A=CircuitDocumentAdapter,engine=createEngine(),session=A.createSession(engine);
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const recordFor=(document,id)=>{
  const compiled=A.compile(document),tokens=compiled.text.split('\n')[compiled.mapping.find(m=>m.id===id).index].split(' ');
  return {tokens,compiled};
};

for(const kind of flipFlopKinds){
  const d=flipFlopCircuit(kind),compiled=A.compile(d);M.validate(d);
  assert.equal(A.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
  assert.deepEqual(JSON.parse(JSON.stringify(d)),d);M.validate(JSON.parse(JSON.stringify(d)));
  for(const rotation of [0,90,180,270])for(const mirror of [false,true]){
    const rotated=structuredClone(d);Object.assign(rotated.layout.components.part,{rotation,mirror});
    for(const pinId of Object.keys(M.definitions[kind].pins)){
      const point=M.pin(rotated,{kind:'pin',componentId:'part',pinId});
      assert.equal(point.x%16,0);assert.equal(Math.abs(point.y%16),0);
    }
    assert.equal(A.compile(rotated).canonical,compiled.canonical);
  }
  const model=M.create(d),before=model.document;
  model.transaction('Edit',next=>{
    const p=next.electrical.components[0].parameters;
    p.initialState=!p.initialState;
    if(kind==='jkFlipFlop')p.positiveEdge=!p.positiveEdge;
  });
  const after=model.document;model.undo();assert.deepEqual(model.document,before);model.redo();assert.deepEqual(model.document,after);
  const pasted=structuredClone(d),fragment=M.copySelection(d,new Set([M.token('component','part')]));
  assert.ok(M.pasteSelection(pasted,fragment).size);M.validate(pasted);
  assert.equal(new Set(pasted.electrical.components.map(c=>c.id)).size,pasted.electrical.components.length);
  const bad=structuredClone(d);bad.electrical.components[0].parameters.unrecognized=1;assert.throws(()=>A.compile(bad));
  session.loadDocument(d);const first=session.step(10);session.reset();assert.deepEqual(session.step(10),first);
}

// D flip-flop: the stored Q state is restored on the first step, then a static
// high clock produces one rising edge that loads D. Q/Qn stay complementary.
for(const [state,D] of [[false,5],[true,0]]){
  const d=flipFlopCircuit('dFlipFlop',{initialState:state},{clock:5,D});
  session.loadDocument(d);
  const restored=session.step(1);
  near(restored.pinVoltages.part.Q,state?5:0);near(restored.pinVoltages.part.Qn,state?0:5);
  const loaded=session.step(2);
  near(loaded.pinVoltages.part.Q,D);near(loaded.pinVoltages.part.Qn,5-D);
  assert.ok(!('part' in loaded.componentCurrents));
}
{
  const d=flipFlopCircuit('dFlipFlop',{initialState:true},{clock:0,D:0});
  session.loadDocument(d);const held=session.step(4);
  near(held.pinVoltages.part.Q,5);near(held.pinVoltages.part.Qn,0);
}
// T flip-flop toggles on a high clock with T high, holds with T or clock low,
// and honours the restored initial state.
for(const [initial,T,clock,expected] of [
  [false,5,5,5],[true,5,5,0],[false,5,0,0],[false,0,5,0]
]){
  const d=flipFlopCircuit('tFlipFlop',{initialState:initial},{T,clock});
  session.loadDocument(d);const f=session.step(3);
  near(f.pinVoltages.part.Q,expected);near(f.pinVoltages.part.Qn,5-expected);
}
// JK flip-flop: positive-edge J/K logic toggles once for both-high and sets/clears
// for single-high inputs; the default negative edge does not trigger a static clock.
for(const [parameters,J,K,expected] of [
  [{positiveEdge:true},5,5,5],[{positiveEdge:true},5,0,5],[{positiveEdge:true},0,5,0],
  [{positiveEdge:false},5,0,0]
]){
  const d=flipFlopCircuit('jkFlipFlop',parameters,{J,K,clock:5});
  session.loadDocument(d);const f=session.step(3);
  near(f.pinVoltages.part.Q,expected);near(f.pinVoltages.part.Qn,5-expected);
}
// Custom logic levels drive the outputs and are stored in the legacy record.
{
  const d=flipFlopCircuit('dFlipFlop',{initialState:true,highVoltage:3.3},{clock:0});
  session.loadDocument(d);const f=session.step(2);
  near(f.pinVoltages.part.Q,3.3);near(f.pinVoltages.part.Qn,0);
}
// Record encoding: flags SMALL=1 is not emitted, CUSTOM_VOLTAGE=8192 and
// JK POSITIVE_EDGE=4 are, with Q/Qn volts as the two trailing state fields.
{
  const cases=[
    ['dFlipFlop',{initialState:false},'155',0,['0','5']],
    ['dFlipFlop',{initialState:true},'155',0,['5','0']],
    ['dFlipFlop',{initialState:true,highVoltage:3.3},'155',8192,['3.3','0']],
    ['jkFlipFlop',{positiveEdge:true},'156',4,['0','5']],
    ['jkFlipFlop',{positiveEdge:true,initialState:true,highVoltage:2.5},'156',8196,['2.5','0']],
    ['tFlipFlop',{initialState:true},'193',0,['5','0']]
  ];
  for(const [kind,parameters,type,flags,state] of cases){
    const record=recordFor(flipFlopCircuit(kind,parameters),'part').tokens;
    assert.equal(record[0],type);assert.equal(record[5],String(flags));
    assert.equal(record.length,6+(flags&8192?1:0)+2);
    assert.deepEqual(record.slice(-2),state);
  }
}
// Lone inputs are not display exceptions; chip outputs are ground-referenced
// ideal sources, so shorts between them or to ground are rejected.
{
  const d=M.empty();d.id='lone-flip-flop';
  d.electrical.components.push(
    {id:'part',kind:'dFlipFlop',modelVersion:1,reference:'U1',parameters:{highVoltage:5,initialState:false}},
    {id:'g',kind:'ground',modelVersion:1,reference:'G',parameters:{}});
  d.layout.components.part={x:0,y:0,rotation:0,mirror:false};d.layout.components.g={x:160,y:0,rotation:0,mirror:false};
  assert.ok(A.compile(d).diagnostics.some(d=>d.code==='FLOATING_NET'));
}
{
  const d=flipFlopCircuit('dFlipFlop');
  d.electrical.wires.push({id:'short',from:{kind:'pin',componentId:'part',pinId:'Q'},to:{kind:'pin',componentId:'part',pinId:'Qn'}});
  assert.throws(()=>A.compile(d),/flip-flop output/);
}
{
  const d=flipFlopCircuit('tFlipFlop');
  d.electrical.wires.push({id:'short',from:{kind:'pin',componentId:'part',pinId:'Q'},to:{kind:'pin',componentId:'g',pinId:'g'}});
  assert.throws(()=>A.compile(d),/flip-flop output/);
}
// Parameter guards.
for(const [kind,parameters] of [
  ['dFlipFlop',{highVoltage:0}],['dFlipFlop',{highVoltage:NaN}],['dFlipFlop',{initialState:1}],
  ['jkFlipFlop',{positiveEdge:1}],['tFlipFlop',{initialState:'no'}]
]){const d=flipFlopCircuit(kind,parameters);assert.throws(()=>M.validate(d));assert.throws(()=>A.compile(d));}
for(const [kind,field] of [['dFlipFlop','initialState'],['jkFlipFlop','positiveEdge'],['tFlipFlop','highVoltage']]){
  const d=flipFlopCircuit(kind);delete d.electrical.components[0].parameters[field];
  assert.throws(()=>M.validate(d));assert.throws(()=>A.compile(d));
}
// Legacy loader validation also covers the three chip records.
const validRecords=[
  '155 0 32 64 32 0 0 5','155 0 32 64 32 0 5 0','155 0 32 64 32 8192 3.3 0 3.3',
  '156 0 32 64 32 4 0 5','156 0 32 64 32 8196 3.3 0 3.3','193 0 32 64 32 0 5 0'
];
for(const record of validRecords)assert.doesNotThrow(()=>engine.load(record,1e-5));
session.loadDocument(flipFlopCircuit('dFlipFlop'));const prior=engine.snapshot();
for(const record of [
  '155 0 32 64 32 0 0','155 0 32 64 32 0 0 5 0','155 0 32 64 32 1 0 5',
  '155 0 32 64 32 2 0 5','155 0 32 64 32 8192 3.3 0 0','155 0 32 64 32 0 5 5',
  '155 0 32 64 32 0 0 NaN','155 0 32 32 32 0 0 5','155 0 32 64 48 0 0 5',
  '156 0 32 64 32 2 0 5','193 0 32 64 32 8196 3.3 0 3.3'
]){assert.throws(()=>engine.load(record,1e-5));assert.deepEqual(engine.snapshot(),prior);}
// Repeated-clock coverage retained from the recovery review; match legacy one-step input sampling.
for(const kind of flipFlopKinds)for(const initialState of [false,true])for(const positiveEdge of kind==='jkFlipFlop'?[false,true]:[true]){
  const d=flipFlopCircuit(kind,{initialState,...(kind==='jkFlipFlop'?{positiveEdge}:{})},{D:5,T:5,J:5,K:5});
  d.electrical.components.find(c=>c.id==='clock').parameters.waveform={kind:'square',amplitude:2.5,frequency:1000,offset:2.5,dutyCycle:.5};
  if(kind==='dFlipFlop')d.electrical.components.find(c=>c.id==='inD').parameters.waveform={kind:'square',amplitude:2.5,frequency:137,offset:2.5,dutyCycle:.5};
  session.loadDocument(d);let q=initialState,lastClock=false,previous={clock:0,D:0},edges=0;
  for(let step=0;step<1200;step++){
    const clock=previous.clock>2.5;
    if(step>0||kind==='tFlipFlop'){
      if(positiveEdge?clock&&!lastClock:!clock&&lastClock){q=kind==='dFlipFlop'?previous.D>2.5:!q;edges++;}
      lastClock=clock;
    }
    const frame=session.step(1);near(frame.pinVoltages.part.Q,q?5:0);near(frame.pinVoltages.part.Qn,q?0:5);previous=frame.pinVoltages.part;
  }
  assert.equal(edges,12);
  const pose=d.layout.components.part,offset=kind==='jkFlipFlop'?40:24;
  assert.equal(M.hit(d,{x:pose.x,y:pose.y+offset},1)?.id,'part','Full flip-flop body is selectable');
}
console.log('Flip-flop checks passed: D/T/JK state restore and edges, Q/Qn levels, custom logic voltage, record flags/state, placement, preflight and loader guards.');
