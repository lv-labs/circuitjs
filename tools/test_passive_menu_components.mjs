import {editing as CircuitEditorModel, adapter as CircuitDocumentAdapter} from '../packages/circuit-core/index.mjs';
import assert from 'node:assert/strict';
import {createEngine} from './engine_node_runtime.mjs';
import {passiveMenuKinds,passiveMenuCircuit} from './passive_menu_fixtures.mjs';
const M=CircuitEditorModel,A=CircuitDocumentAdapter,engine=createEngine(),session=A.createSession(engine);
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
for(const kind of passiveMenuKinds){
 const d=passiveMenuCircuit(kind),compiled=A.compile(d);M.validate(d);assert.equal(A.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
 for(const rotation of [0,90,180,270])for(const mirror of [false,true]){
  const copy=structuredClone(d);Object.assign(copy.layout.components.part,{rotation,mirror});for(const pinId of Object.keys(M.definitions[kind].pins)){const p=M.pin(copy,{kind:'pin',componentId:'part',pinId});assert.equal(Math.abs(p.x%M.grid),0);assert.equal(Math.abs(p.y%M.grid),0);}assert.equal(A.compile(copy).canonical,compiled.canonical);
 }
 const model=M.create(d),before=model.document;model.transaction('Edit',next=>{const p=next.electrical.components[0].parameters;if(kind==='pushSwitch')p.normallyClosed=true;else if(kind==='mbbSwitch')p.position=1;else if(kind==='transmissionLine')p.delay=.002;else p.inductance=8;});const after=model.document;model.undo();assert.deepEqual(model.document,before);model.redo();assert.deepEqual(model.document,after);
 const copy=structuredClone(d);M.pasteSelection(copy,M.copySelection(d,new Set([M.token('component','part')])));M.validate(copy);
 session.loadDocument(d);const first=session.step(10);session.reset();assert.deepEqual(session.step(10),first);
 const invalid=structuredClone(d);invalid.electrical.components[0].parameters.unknown=1;assert.throws(()=>A.compile(invalid));
}
for(const normallyClosed of [false,true]){
 const d=passiveMenuCircuit('pushSwitch',{normallyClosed}),model=M.create(d),saved=JSON.stringify(model.document),pressed=M.momentaryDocument(d,'part');
 assert.equal(JSON.stringify(model.document),saved);M.validate(pressed);
 session.loadDocument(d);near(session.step(2).pinVoltages.load.a,normallyClosed?5:0);
 session.loadDocument(pressed);near(session.step(2).pinVoltages.load.a,normallyClosed?0:5);
 session.loadDocument(d);near(session.step(2).pinVoltages.load.a,normallyClosed?5:0);
 assert.equal(model.canUndo,false);assert.equal(model.canRedo,false);assert.equal(JSON.stringify(model.document),saved);
}
for(const position of [0,1,2,3]){
 session.loadDocument(passiveMenuCircuit('mbbSwitch',{position}));const f=session.step(2);near(f.pinVoltages.loadA.a,position===2?0:5);near(f.pinVoltages.loadB.a,position===0?0:5);assert.ok(!('part' in f.componentCurrents));
}
// Independent small-matrix inversion and nodal solve for the coupled-winding first step.
function inverse(matrix){const n=matrix.length,a=matrix.map((row,i)=>[...row,...row.map((_,j)=>Number(i===j))]);for(let i=0;i<n;i++){const p=a[i][i];assert.notEqual(p,0);a[i]=a[i].map(v=>v/p);for(let j=0;j<n;j++)if(i!==j){const k=a[j][i];a[j]=a[j].map((v,c)=>v-k*a[i][c]);}}return a.map(row=>row.slice(n));}
function voltages(inductances,signs,k,dt,driven,loads){
 const inductance=inductances.map((l,i)=>inductances.map((m,j)=>i===j?l:k*Math.sqrt(l*m)*signs[i]*signs[j]));
 const g=inverse(inductance).map(row=>row.map(v=>v*dt)),unknown=[0,1,2].filter(i=>i!==driven),[a,b]=unknown;
 const x=g[a][a]+1/loads[a],y=g[a][b],z=g[b][a],w=g[b][b]+1/loads[b],u=-g[a][driven]*5,v=-g[b][driven]*5,det=x*w-y*z;
 const result=[0,0,0];result[driven]=5;result[a]=(u*w-y*v)/det;result[b]=(x*v-u*z)/det;return result;
}
for(const integration of ['backwardEuler','trapezoidal'])for(const coupling of [.5,.99])for(const ratio of [.5,1,2]){
 const d=passiveMenuCircuit('tappedTransformer',{integration,coupling,ratio});session.loadDocument(d);const f=session.step(1),l2=4*ratio*ratio/4;
 const v=voltages([4,l2,l2],[1,1,1],coupling,d.simulation.timeStep/(integration==='trapezoidal'?2:1),0,[Infinity,1000,2000]);
 near(f.pinVoltages.part.s1,v[1]);near(f.pinVoltages.part.s2,-v[2]);near(f.pinVoltages.part.tap,0);
}
for(const integration of ['backwardEuler','trapezoidal'])for(const turns of [[1,1,1],[1,2,.5],[1,-1,2]])for(const driven of [0,1,2]){
 const d=passiveMenuCircuit('customTransformer',{integration,turns1:turns[0],turns2:turns[1],turns3:turns[2],coupling:.8},{driven});session.loadDocument(d);const f=session.step(1);
 const v=voltages(turns.map(n=>4*n*n),turns.map(Math.sign),.8,d.simulation.timeStep/(integration==='trapezoidal'?2:1),driven,[1000,2000,3000]);
 for(const [i,pin] of ['p1a','p2a','sa'].entries())near(f.pinVoltages.part[pin],v[i]);
}
// Positive scientific exponents must not be mistaken for the legacy '+' tap separator.
{
 const d=passiveMenuCircuit('customTransformer',{inductance:1e-40,turns1:1e21,turns2:1e21,turns3:1e21});
 const compiled=A.compile(d);assert.ok(!compiled.text.split('\n').find(line=>line.startsWith('406 ')).includes('e+'));
 session.loadDocument(d);assert.ok(Number.isFinite(session.step(2).pinVoltages.part.sa));
}
// Matched line step response and reloading a different timestep on the same engine.
for(const timeStep of [1e-5,2e-5,5e-6])for(const steps of [1,2,10,100]){
 const delay=timeStep*steps,d=passiveMenuCircuit('transmissionLine',{delay},{timeStep});session.loadDocument(d);
 const actualSteps=Math.floor(delay/timeStep);
 for(let i=1;i<=actualSteps+5;i++){
  const f=session.step(1);near(f.pinVoltages.part.left,2.5);near(f.pinVoltages.part.right,i<=actualSteps?0:2.5);
 }
 session.reset();near(session.step(1).pinVoltages.part.right,0);
}
const line=passiveMenuCircuit('transmissionLine');line.electrical.wires=line.electrical.wires.filter(w=>w.from.pinId!=='leftReturn');assert.throws(()=>A.compile(line),/return pins/);
for(const kind of ['tappedTransformer','customTransformer']){
 const d=passiveMenuCircuit(kind),pins=kind==='tappedTransformer'?['p1','p2']:['p1a','p1b'];d.electrical.wires=d.electrical.wires.filter(w=>![w.from,w.to].some(end=>end.componentId==='part'&&pins.includes(end.pinId)));assert.ok(A.compile(d).diagnostics.some(d=>d.code==='FLOATING_NET'));
}
for(const kind of ['pushSwitch','mbbSwitch']){
 const d=passiveMenuCircuit(kind,kind==='pushSwitch'?{normallyClosed:true}:{position:1});d.electrical.wires.push({id:'short',from:{kind:'pin',componentId:'part',pinId:kind==='pushSwitch'?'a':'common'},to:{kind:'pin',componentId:'part',pinId:kind==='pushSwitch'?'b':'a'}});assert.throws(()=>A.compile(d),/ideal .*loop/);
}
for(const [kind,p] of [['pushSwitch',{normallyClosed:1}],['mbbSwitch',{position:4}],['tappedTransformer',{coupling:1}],['customTransformer',{turns1:0}],['customTransformer',{turns2:Infinity}],['customTransformer',{inductance:1e300}],['customTransformer',{inductance:1e300,turns1:1e-200}],['transmissionLine',{delay:1e-9}],['transmissionLine',{delay:2}],['transmissionLine',{impedance:0}]])assert.throws(()=>A.compile(passiveMenuCircuit(kind,p)));
session.loadDocument(passiveMenuCircuit('pushSwitch'));const prior=engine.snapshot();
for(const record of ['s 0 0 0 32 0 0 nope','416 0 32 64 32 0 4 false 0','416 0 32 64 32 0 0 false 1','169 0 32 64 32 0 4 1 0 0 0 1','406 0 32 64 32 0 4 .8 1,1:0 3 0 0 0','406 0 32 64 32 0 4 .8 1:1,1 3 0 0 0','406 0 32 64 32 0 1e-40 .8 1e+21,1e21:1e21 3 0 0 0','171 0 32 64 32 0 1e-9 75 32 0','171 0 32 64 32 0 .001 0 32 0']){assert.throws(()=>engine.load(record,1e-5));assert.deepEqual(engine.snapshot(),prior);}
console.log('Passive menu checks passed: momentary overlay/state/history, four MBB positions, coupled-winding analytic responses, line delay/timestep/reset, graph/projection/orientation, and loader/topology guards.');
