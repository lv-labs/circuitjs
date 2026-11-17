import {editing as CircuitEditorModel, adapter as CircuitDocumentAdapter} from '../packages/circuit-core/index.mjs';
import assert from 'node:assert/strict';
import {createEngine} from './engine_node_runtime.mjs';
import {logicDisplayKinds,logicDisplayCircuit} from './logic_display_fixtures.mjs';
const M=CircuitEditorModel,A=CircuitDocumentAdapter,engine=createEngine(),session=A.createSession(engine);
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
const recordFor=(document,id)=>{
  const compiled=A.compile(document),tokens=compiled.text.split('\n')[compiled.mapping.find(m=>m.id===id).index].split(' ');
  return {tokens,compiled};
};
for(const kind of logicDisplayKinds){
  const d=logicDisplayCircuit(kind),compiled=A.compile(d);M.validate(d);
  assert.equal(A.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
  assert.deepEqual(JSON.parse(JSON.stringify(d)),d);M.validate(JSON.parse(JSON.stringify(d)));
  for(const rotation of [0,90,180,270])for(const mirror of [false,true]){
    const rotated=structuredClone(d);Object.assign(rotated.layout.components.part,{rotation,mirror});
    const pinId=Object.keys(M.definitions[kind].pins)[0],point=M.pin(rotated,{kind:'pin',componentId:'part',pinId});
    assert.equal(point.x%M.grid,0);assert.equal(Math.abs(point.y%M.grid),0);
    assert.equal(A.compile(rotated).canonical,compiled.canonical);
  }
  const model=M.create(d),before=model.document;
  model.transaction('Edit',next=>{
    const p=next.electrical.components[0].parameters;
    if(kind==='output')p.showVoltage=!p.showVoltage;
    else if(kind==='logicOutput')p.threshold=3;
    else p.state=0;
  });
  const after=model.document;model.undo();assert.deepEqual(model.document,before);model.redo();assert.deepEqual(model.document,after);
  const pasted=structuredClone(d),fragment=M.copySelection(d,new Set([M.token('component','part')]));
  assert.ok(M.pasteSelection(pasted,fragment).size);M.validate(pasted);
  assert.equal(new Set(pasted.electrical.components.map(c=>c.id)).size,pasted.electrical.components.length);
  const bad=structuredClone(d);bad.electrical.components[0].parameters.unrecognized=1;assert.throws(()=>A.compile(bad));
  session.loadDocument(d);const first=session.step(10);session.reset();assert.deepEqual(session.step(10),first);
}
// Output markers are electrically invisible. Logic outputs only add the optional 1 MΩ pulldown.
{
  const d=logicDisplayCircuit('output');session.loadDocument(d);const f=session.step(3);
  near(f.pinVoltages.part.in,2.5);assert.ok(!('part' in f.componentCurrents));
  d.electrical.components[0].parameters.showVoltage=false;session.loadDocument(d);const hidden=session.step(3);
  near(hidden.pinVoltages.part.in,2.5);assert.deepEqual(hidden.pinVoltages,f.pinVoltages);
}
for(const pulldown of [false,true]){
  const d=logicDisplayCircuit('logicOutput',{pulldown});session.loadDocument(d);const f=session.step(3);
  const pull=1000*1e6/(1000+1e6),expected=pulldown?5*pull/(1000+pull):2.5;
  near(f.pinVoltages.part.in,expected);assert.ok(!('part' in f.componentCurrents));
}
// A pulldown is a finite return path for an otherwise ideal current source.
{
  const d={schemaVersion:1,id:'pulldown-return',electrical:{components:[
    {id:'g',kind:'ground',modelVersion:1,reference:'G',parameters:{}},
    {id:'i',kind:'currentSource',modelVersion:1,reference:'I1',parameters:{current:.001,maxVoltage:0}},
    {id:'m',kind:'logicOutput',modelVersion:1,reference:'M1',parameters:{threshold:2.5,mode:'numeric',pulldown:true}}
  ],junctions:[],wires:[
    {id:'w0',from:{kind:'pin',componentId:'i',pinId:'a'},to:{kind:'pin',componentId:'g',pinId:'g'}},
    {id:'w1',from:{kind:'pin',componentId:'i',pinId:'b'},to:{kind:'pin',componentId:'m',pinId:'in'}}
  ]},simulation:{timeStep:1e-5}};
  session.loadDocument(d);near(session.step(3).pinVoltages.m.in,1000);
}
// Logic inputs are ground-referenced ideal sources; ternary states use the legacy 0/1/2 levels.
for(const [parameters,expected] of [
  [{state:0},0],[{state:1},5],
  [{state:0,highVoltage:12,lowVoltage:-3,mode:'numeric'},-3],[{state:1,highVoltage:12,lowVoltage:-3,mode:'numeric'},12],
  [{state:0,mode:'ternary'},0],[{state:1,mode:'ternary'},2.5],[{state:2,mode:'ternary'},5]
]){
  const d=logicDisplayCircuit('logicInput',parameters);session.loadDocument(d);const f=session.step(3);
  near(f.pinVoltages.part.out,expected);near(f.componentCurrents.part,-f.componentCurrents.load);
  near(f.componentCurrents.load,expected/1000);
}
// Legacy record encoding: flags and optional trailing parameters.
{
  const output=logicDisplayCircuit('output',{showVoltage:true}),shown=recordFor(output,'part').tokens;
  assert.equal(shown.length,6);assert.equal(shown[0],'O');assert.equal(shown[5],'1');
  output.electrical.components[0].parameters.showVoltage=false;const hiddenRecord=recordFor(output,'part').tokens;
  assert.equal(hiddenRecord.length,6);assert.equal(hiddenRecord[5],'0');
  for(const [parameters,flag] of [
    [{mode:'logic'},0],[{mode:'numeric'},2],[{mode:'ternary'},1],[{mode:'ternary',pulldown:true},5],[{mode:'numeric',pulldown:true},6]
  ]){
    const d=logicDisplayCircuit('logicOutput',{...parameters,threshold:1.25}),record=recordFor(d,'part').tokens;
    assert.equal(record.length,7);assert.equal(record[0],'M');assert.equal(record[5],String(flag));assert.equal(Number(record[6]),1.25);
  }
  for(const [parameters,flag,state] of [
    [{mode:'logic',state:1},0,1],[{mode:'numeric',state:0},2,0],[{mode:'ternary',state:2},1,2]
  ]){
    const d=logicDisplayCircuit('logicInput',{...parameters,highVoltage:3.3,lowVoltage:.2}),record=recordFor(d,'part').tokens;
    assert.equal(record.length,10);assert.equal(record[0],'L');assert.equal(record[5],String(flag));assert.equal(record[6],String(state));
    assert.equal(record[7],'false');assert.equal(Number(record[8]),3.3);assert.equal(Number(record[9]),.2);
  }
}
// Display-only markers and logic sources are legitimate lone islands.
for(const kind of logicDisplayKinds){
  const document={schemaVersion:1,id:'lone-'+kind,electrical:{components:[
    {id:'g',kind:'ground',modelVersion:1,reference:'G',parameters:{}},
    {id:'part',kind,modelVersion:1,reference:'X',parameters:structuredClone(M.definitions[kind].parameters)}
  ],junctions:[],wires:[]},simulation:{timeStep:1e-5}};
  const compiled=A.compile(document);
  assert.equal(A.fromProjection(JSON.parse(compiled.canonical),document.id).canonical,compiled.canonical);
}
const loop=logicDisplayCircuit('logicInput');loop.electrical.wires.push({id:'short',from:{kind:'pin',componentId:'part',pinId:'out'},to:{kind:'pin',componentId:'g',pinId:'g'}});
assert.throws(()=>A.compile(loop),/ideal source/);
// The lone-marker exception does not cover an unattached passive island.
const island={schemaVersion:1,id:'marker-island',electrical:{components:[
  {id:'g',kind:'ground',modelVersion:1,reference:'G',parameters:{}},
  {id:'part',kind:'output',modelVersion:1,reference:'O1',parameters:{showVoltage:true}},
  {id:'r',kind:'resistor',modelVersion:1,reference:'R1',parameters:{resistance:1000}}
],junctions:[],wires:[{id:'w',from:{kind:'pin',componentId:'part',pinId:'in'},to:{kind:'pin',componentId:'r',pinId:'a'}}]},simulation:{timeStep:1e-5}};
assert.ok(A.compile(island).diagnostics.some(d=>d.code==='FLOATING_NET'));
for(const [kind,parameters] of [
  ['output',{showVoltage:'yes'}],['output',{showVoltage:1}],
  ['logicOutput',{threshold:NaN}],['logicOutput',{mode:'quad'}],['logicOutput',{pulldown:1}],
  ['logicInput',{state:2}],['logicInput',{mode:'numeric',state:2}],['logicInput',{highVoltage:NaN}],
  ['logicInput',{lowVoltage:Infinity}],['logicInput',{mode:'logic',state:-1}]
]){const d=logicDisplayCircuit(kind,parameters);assert.throws(()=>M.validate(d));assert.throws(()=>A.compile(d));}
for(const [kind,field] of [['output','showVoltage'],['logicOutput','pulldown'],['logicInput','highVoltage']]){
  const d=logicDisplayCircuit(kind);delete d.electrical.components[0].parameters[field];
  assert.throws(()=>M.validate(d));assert.throws(()=>A.compile(d));
}
// Legacy loader validation also covers the new record types.
const validRecords=['O 0 32 0 64 1','O 0 32 0 64 0 3','M 0 32 0 64 0 2.5','M 0 32 0 64 7 2.5','L 0 32 0 64 0 1 false 5 0','L 0 32 0 64 1 2 false 5 0'];
for(const record of validRecords)assert.doesNotThrow(()=>engine.load(record,1e-5));
session.loadDocument(logicDisplayCircuit('logicInput'));const prior=engine.snapshot();
for(const record of [
  'O 0 32 0 64 4','O 0 32 0 64 0 4',
  'M 0 32 0 64 8 2.5','M 0 32 0 64 0 NaN','M 0 32 0 64 0 2.5 1',
  'L 0 32 0 64 0 2 false 5 0','L 0 32 0 64 1 1 true 5 0','L 0 32 0 64 0 1 true 5 0',
  'L 0 32 0 64 0 1 false NaN 0','L 0 32 0 64 0 1 false 5'
]){assert.throws(()=>engine.load(record,1e-5));assert.deepEqual(engine.snapshot(),prior);}
console.log('Logic/display checks passed: output markers, logic-output levels and pulldown, logic-input states/ternary levels, legacy record flags, lone-island support, loop/parameter guards and loader validation.');
