import assert from 'node:assert/strict';
import '../experiments/engine/document-adapter.js';
import {createEngine} from './engine_node_runtime.mjs';
import {expansionKinds,expansionCircuit} from './component_expansion_fixtures.mjs';
const M=CircuitEditorModel,A=CircuitDocumentAdapter,engine=createEngine(),session=A.createSession(engine);
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
for(const kind of expansionKinds){
  const d=expansionCircuit(kind),compiled=A.compile(d);M.validate(d);
  assert.equal(A.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
  for(const rotation of [0,90,180,270])for(const mirror of [false,true]){
    const rotated=structuredClone(d);Object.assign(rotated.layout.components.part,{rotation,mirror});
    for(const pinId of Object.keys(M.definitions[kind].pins)){
      const p=M.pin(rotated,{kind:'pin',componentId:'part',pinId});assert.ok(p.x%16===0&&p.y%16===0);
    }
    assert.equal(A.compile(rotated).canonical,compiled.canonical);
  }
  const model=M.create(d),before=model.document;
  model.transaction('Property edit',next=>{const c=next.electrical.components[0];if('position' in c.parameters)c.parameters.position=1;else if('inductance' in c.parameters)c.parameters.inductance=8;else c.parameters.forwardVoltage+=.1;});
  const after=model.document;model.undo();assert.deepEqual(model.document,before);model.redo();assert.deepEqual(model.document,after);
  const fragment=M.copySelection(d,new Set([M.token('component','part')])),pasted=structuredClone(d),selected=M.pasteSelection(pasted,fragment);
  assert.ok(selected.size);M.validate(pasted);assert.equal(new Set(pasted.electrical.components.map(c=>c.id)).size,pasted.electrical.components.length);
  const bad=structuredClone(d);bad.electrical.components[0].parameters.unrecognized=1;assert.throws(()=>A.compile(bad));
  session.loadDocument(d);const f=session.step(10);session.reset();assert.deepEqual(session.step(10).pinVoltages,f.pinVoltages);
}
for(const kind of ['spdtSwitch','dpdtSwitch'])for(const position of kind==='spdtSwitch'?[0,1,2]:[0,1]){
  session.loadDocument(expansionCircuit(kind,{position}));const f=session.step(3);
  near(f.pinVoltages.aLoad.a,position===0?5:0);near(f.pinVoltages.bLoad.a,position===1?5:0);
  if(kind==='dpdtSwitch'){near(f.pinVoltages.aLoad2.a,position===0?-3:0);near(f.pinVoltages.bLoad2.a,position===1?-3:0);}
  else near(f.componentCurrents.part,position===0?.005:position===1?.0025:0);
}
for(const kind of ['led','zener'])for(const voltage of [5,-2,-10]){
  const d=expansionCircuit(kind,{},voltage);session.loadDocument(d);const f=session.step(20),v=f.pinVoltages.part.anode,i=f.componentCurrents.part;
  // Current law plus the inherited diode model's forward equation, independently evaluated.
  near(i,(voltage-v)/1000,1e-7);
  if(voltage>0){
    const forward=d.electrical.components[0].parameters.forwardVoltage,scale=2*.025865;
    const expected=Math.expm1(v/scale)/Math.expm1(forward/scale);near(i,expected,1e-10);assert.ok(v>0&&v<forward);
  }else if(kind==='zener'&&voltage===-10){assert.ok(v< -5&&v> -6.5);assert.ok(i<-.003);}
  else {assert.ok(Math.abs(i)<1e-6);near(v,voltage,.001);}
}
for(const integration of ['backwardEuler','trapezoidal'])for(const ratio of [.5,1,2])for(const coupling of [.5,.999]){
  const d=expansionCircuit('transformer',{ratio,coupling,integration});session.loadDocument(d);const f=session.step(1);
  const l1=4,l2=l1*ratio*ratio,m=coupling*Math.sqrt(l1*l2),det=l1*l2-m*m,dt=d.simulation.timeStep/(integration==='trapezoidal'?2:1);
  const a3=-m*dt/det,a4=l1*dt/det;
  near(f.pinVoltages.part.s1,-a3*5/(.001+a4));near(f.pinVoltages.part.p1,5);near(f.pinVoltages.part.s2,0);
  // Drive the other winding to verify post order and reciprocal coupling.
  const reverse=structuredClone(d);
  for(const w of reverse.electrical.wires)for(const key of ['from','to'])if(w[key].componentId==='part')w[key].pinId={p1:'s1',p2:'s2',s1:'p1',s2:'p2'}[w[key].pinId];
  session.loadDocument(reverse);near(session.step(1).pinVoltages.part.p1,-a3*5/(.001+l2*dt/det));
}
for(const [kind,parameters] of [['transformer',{coupling:1}],['transformer',{coupling:0}],['transformer',{ratio:0}],['transformer',{inductance:1e300}],['spdtSwitch',{position:3}],['dpdtSwitch',{position:2}],['led',{maxCurrent:0}],['zener',{breakdownVoltage:-1}]])assert.throws(()=>A.compile(expansionCircuit(kind,parameters)));
const isolated=expansionCircuit('transformer');isolated.electrical.wires=isolated.electrical.wires.filter(w=>!(w.from.componentId==='part'&&w.from.pinId==='s2')&&!(w.from.componentId==='load'&&w.from.pinId==='b'));
isolated.electrical.wires.push({id:'isolated-return',from:{kind:'pin',componentId:'load',pinId:'b'},to:{kind:'pin',componentId:'part',pinId:'s2'}});assert.ok(A.compile(isolated).diagnostics.some(d=>d.code==='FLOATING_NET'));
const loop=expansionCircuit('spdtSwitch');loop.electrical.wires.push({id:'short',from:{kind:'pin',componentId:'part',pinId:'common'},to:{kind:'pin',componentId:'part',pinId:'a'}});assert.throws(()=>A.compile(loop),/ideal switch loop/);
// Loader guards fail before replacing the previously loaded engine.
session.loadDocument(expansionCircuit('led'));const prior=engine.snapshot();
for(const record of ['162 0 0 0 32 0 2.1 1 0 0 .01','z 0 0 0 32 1 .8 -5','S 0 32 64 32 1 3 false 0 2','429 0 32 64 32 0 0 false 3','T 0 32 64 64 0 4 1 0 0 1 0']){assert.throws(()=>engine.load(record,1e-5));assert.deepEqual(engine.snapshot(),prior);}
console.log('Expansion checks passed: transformer winding mapping/coupling/integration, SPDT all positions, DPDT independent poles, LED/Zener forward/reverse behavior, grid/history/copy/projection, floating/ideal-loop rejection and raw-loader validation.');
