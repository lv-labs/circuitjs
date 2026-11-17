import {editing as CircuitEditorModel, adapter as CircuitDocumentAdapter} from '../packages/circuit-core/index.mjs';
import assert from 'node:assert/strict';
import {createEngine} from './engine_node_runtime.mjs';
import {passiveSwitchKinds,passiveSwitchCircuit} from './passive_switch_fixtures.mjs';
const M=CircuitEditorModel,A=CircuitDocumentAdapter,engine=createEngine(),session=A.createSession(engine);
const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
for(const kind of passiveSwitchKinds){
  const d=passiveSwitchCircuit(kind),compiled=A.compile(d);M.validate(d);
  assert.equal(A.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
  assert.deepEqual(JSON.parse(JSON.stringify(d)),d);M.validate(JSON.parse(JSON.stringify(d)));
  for(const rotation of [0,90,180,270])for(const mirror of [false,true]){
    const rotated=structuredClone(d);Object.assign(rotated.layout.components.part,{rotation,mirror});
    for(const pinId of Object.keys(M.definitions[kind].pins)){
      const point=M.pin(rotated,{kind:'pin',componentId:'part',pinId});assert.equal(point.x%M.grid,0);assert.equal(Math.abs(point.y%M.grid),0);
    }
    assert.equal(A.compile(rotated).canonical,compiled.canonical);
  }
  const model=M.create(d),before=model.document;
  model.transaction('Edit',next=>{const p=next.electrical.components[0].parameters;if(kind==='polarizedCapacitor')p.maxReverseVoltage=2;else p.inverted=true;});
  const after=model.document;model.undo();assert.deepEqual(model.document,before);model.redo();assert.deepEqual(model.document,after);
  const pasted=structuredClone(d),fragment=M.copySelection(d,new Set([M.token('component','part')]));
  assert.ok(M.pasteSelection(pasted,fragment).size);M.validate(pasted);
  assert.equal(new Set(pasted.electrical.components.map(c=>c.id)).size,pasted.electrical.components.length);
  const bad=structuredClone(d);bad.electrical.components[0].parameters.unrecognized=1;assert.throws(()=>A.compile(bad));
  session.loadDocument(d);const first=session.step(10);session.reset();assert.deepEqual(session.step(10),first);
}
// The polarized model must reproduce ordinary capacitor integration below its reverse limit.
for(const integration of ['backwardEuler','trapezoidal'])for(const initialVoltage of [0,.5,-.2]){
  const d=passiveSwitchCircuit('polarizedCapacitor',{integration,initialVoltage}),ordinary=structuredClone(d);
  ordinary.electrical.components[0].kind='capacitor';delete ordinary.electrical.components[0].parameters.maxReverseVoltage;
  for(const wire of ordinary.electrical.wires)for(const end of ['from','to'])if(wire[end].componentId==='part')wire[end].pinId=wire[end].pinId==='positive'?'a':'b';
  const reference=A.createSession(createEngine());reference.loadDocument(ordinary);session.loadDocument(d);
  for(let step=1;step<=20;step++){
    const f=session.step(1),expected=reference.step(1);
    near(f.pinVoltages.part.positive,expected.pinVoltages.part.a,1e-12);near(f.componentCurrents.part,expected.componentCurrents.part,1e-12);
    if(integration==='backwardEuler')near(f.pinVoltages.part.positive,5+(initialVoltage-5)*Math.pow(1/(1+d.simulation.timeStep/.001),step),1e-12);
  }
}
// Reverse bias below the threshold runs; exceeding it stops with the legacy diagnostic.
for(const integration of ['backwardEuler','trapezoidal']){
  session.loadDocument(passiveSwitchCircuit('polarizedCapacitor',{integration},-.5));assert.ok(session.step(100).pinVoltages.part.positive<0);
  session.loadDocument(passiveSwitchCircuit('polarizedCapacitor',{integration},-5));
  assert.throws(()=>session.step(1000),/capacitor exceeded max reverse voltage/);
  assert.throws(()=>session.snapshot(),/faulted/);
  session.loadDocument(passiveSwitchCircuit('polarizedCapacitor',{integration},-5));assert.ok(Number.isFinite(session.step(1).pinVoltages.part.positive));
}
for(const parameters of [{maxReverseVoltage:0},{initialVoltage:-2}]){
  session.loadDocument(passiveSwitchCircuit('polarizedCapacitor',parameters,-.5));
  assert.throws(()=>session.step(1),/capacitor exceeded max reverse voltage/);
}
// Control is ground-referenced and draws no current. Independently solve each resistor network.
for(const values of [{onResistance:20,offResistance:1e10,threshold:2.5},{onResistance:100,offResistance:1e6,threshold:.75}])for(const kind of ['analogSwitch','analogSpdtSwitch'])for(const pulldown of [false,true])for(const inverted of [false,true])for(const control of [-1,2.5,5]){
  const d=passiveSwitchCircuit(kind,{...values,pulldown,inverted},5,control);session.loadDocument(d);const f=session.step(3),on=(control>=values.threshold)!==inverted;
  const {onResistance:ron,offResistance:roff}=values;
  near(f.pinVoltages.part.control,control);near(f.componentCurrents.ctl,0);
  if(kind==='analogSwitch'){
    const r=on?ron:roff,expected=pulldown&&!on?0:5/(1+r*(1/1000+(pulldown?1/roff:0)));
    near(f.pinVoltages.load.a,expected);near(f.componentCurrents.part,pulldown&&!on?0:(5-expected)/r);
  }else{
    const ra=on?ron:roff,rb=on?roff:ron;
    const va=pulldown&&!on?0:5/(1+ra*(1/1000+(pulldown?1/roff:0)));
    const vb=pulldown&&on?0:5/(1+rb*(1/2000+(pulldown?1/roff:0)));
    near(f.pinVoltages.load.a,va);near(f.pinVoltages.loadB.a,vb);near(f.componentCurrents.part,on?(5-va)/ron:(5-vb)/ron);
  }
}
// Dynamic control switches within one run; capture every step, including both transitions.
for(const kind of ['analogSwitch','analogSpdtSwitch']){
  const d=passiveSwitchCircuit(kind,{},5,{kind:'square',amplitude:5,frequency:1000,offset:0,dutyCycle:.5});session.loadDocument(d);
  const states=new Set();let previousControl=0;
  for(let i=0;i<250;i++){
    // Legacy doStep reads the previously solved control voltage, before this solve.
    const f=session.step(1),on=previousControl>=2.5;states.add(on);previousControl=f.pinVoltages.part.control;
    near(f.pinVoltages.load.a,on?5/(1+20*(.001+1e-10)):0);
    if(kind==='analogSpdtSwitch')near(f.pinVoltages.loadB.a,on?0:5/(1+20*(.0005+1e-10)));
  }
  assert.equal(states.size,2);
}
for(const [kind,parameters] of [
  ['polarizedCapacitor',{maxReverseVoltage:-1}],['polarizedCapacitor',{maxReverseVoltage:Infinity}],['polarizedCapacitor',{capacitance:0}],
  ['analogSwitch',{onResistance:0}],['analogSwitch',{offResistance:-1}],['analogSwitch',{onResistance:Number.MIN_VALUE}],
  ['analogSpdtSwitch',{threshold:NaN}],['analogSpdtSwitch',{inverted:1}],['analogSwitch',{pulldown:'true'}]
]){const d=passiveSwitchCircuit(kind,parameters);assert.throws(()=>M.validate(d));assert.throws(()=>A.compile(d));}
const floating=passiveSwitchCircuit('analogSwitch');floating.electrical.wires=floating.electrical.wires.filter(w=>w.from.componentId!=='ctl');assert.ok(A.compile(floating).diagnostics.some(d=>d.code==='FLOATING_NET'));
const loop=passiveSwitchCircuit('polarizedCapacitor');loop.electrical.wires.push({id:'short',from:{kind:'pin',componentId:'part',pinId:'positive'},to:{kind:'pin',componentId:'g',pinId:'g'}});assert.throws(()=>A.compile(loop),/capacitor\/source loop/);
// Finite-resistance switches allow tied signal terminals; they are not ideal-switch loops.
const tied=passiveSwitchCircuit('analogSwitch');tied.electrical.wires.push({id:'tie',from:{kind:'pin',componentId:'part',pinId:'a'},to:{kind:'pin',componentId:'part',pinId:'b'}});session.loadDocument(tied);near(session.step(2).pinVoltages.load.a,5);
session.loadDocument(passiveSwitchCircuit('analogSwitch'));const prior=engine.snapshot();
for(const record of ['209 0 0 0 32 0 .000001 0 0 -1','209 0 0 0 32 4 .000001 0 0 1','209 0 0 0 32 0 0 0 0 1','159 0 32 64 32 0 0 1e10 2.5','160 0 32 64 32 0 20 -1 2.5','159 0 32 32 32 0 20 1e10 2.5','159 0 32 64 32 4 20 1e10 2.5','160 0 32 64 32 0 20 1e10 NaN']){
  assert.throws(()=>engine.load(record,1e-5));assert.deepEqual(engine.snapshot(),prior);
}
console.log('Passive/controlled-switch checks passed: polarized RC integration/reset/reverse stop, SPST/SPDT networks and dynamic controls, geometry/history/copy/save, projection, floating/loop guards and loader validation.');
