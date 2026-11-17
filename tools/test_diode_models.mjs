import assert from 'node:assert/strict';
import {catalog,editing,adapter,document as documents} from '../packages/circuit-core/index.mjs';
import {createEngine} from './engine_node_runtime.mjs';
const session=adapter.createSession(createEngine());
function circuit(model, kind="diode", reverse=false){
 const s=editing.create(editing.empty());
 for(const [partKind,x] of [['voltageRail',0],['resistor',500],[kind,1000],['ground',1500]])s.execute({type:'addComponent',kind:partKind,x,y:0,rotation:0});
 const d=structuredClone(s.document),[v,r,diode,g]=d.electrical.components;
 diode.parameters=model===null?{}:{model,...(kind==='led'?{maxCurrent:.01,red:.1,green:.8,blue:.4}:{})};
 if(reverse)v.parameters.waveform.voltage=-12;
 const pins=[[v,'p',r,'a'],[r,'b',diode,'anode'],[diode,'cathode',g,'g']];
 for(const [a,ap,b,bp] of pins){const id='w'+d.electrical.wires.length;d.electrical.wires.push({id,from:{kind:'pin',componentId:a.id,pinId:ap},to:{kind:'pin',componentId:b.id,pinId:bp}});d.layout.wires[id]={bends:[]};}
 return {d,diode};
}
const voltages={};
for(const model of [null,...catalog.diodeModels]){
 const {d,diode}=circuit(model);documents.validate(d);
 const compiled=adapter.compile(d);
 if(model)assert.match(compiled.text,new RegExp(' 2 '+model+'(?:\\n|$)'));
 assert.equal(adapter.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
 session.loadDocument(d);const f=session.step(30);const voltage=f.pinVoltages[diode.id].anode;
 assert.ok(Number.isFinite(voltage)&&voltage>0&&voltage<5,`${model}: ${voltage}`);voltages[model]=voltage;
}
assert.ok(voltages.BAT85<voltages['1N4148'],'Schottky model changes solver behavior');
for(const model of ['bogus','1N4148\ntext',3]){const {d}=circuit(model);assert.throws(()=>documents.validate(d));assert.throws(()=>adapter.compile(d));}
console.log('Diode models: legacy documents, all built-ins, projection, validation and solver behavior passed.');

const simple={name:'Custom silicon',mode:'simple',saturationCurrent:1e-12,forwardVoltage:.7,forwardCurrent:.01,breakdownVoltage:5.6};
const advanced={name:'Custom advanced',mode:'advanced',saturationCurrent:1e-12,seriesResistance:8,emissionCoefficient:1.4,breakdownVoltage:6.2};
for(const kind of ['diode','led','zener'])for(const model of [simple,advanced,...catalog.diodeModels.filter(m=>kind!=='zener'||catalog.resolveDiodeModel(m).breakdownVoltage>0)]){
 const {d,diode}=circuit(model,kind);documents.validate(d);const compiled=adapter.compile(d);
 assert.equal(adapter.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
 session.loadDocument(d);const f=session.step(50);assert.ok(Number.isFinite(f.pinVoltages[diode.id].anode));
 if(typeof model==='object'){
  const updated=structuredClone(d);updated.electrical.components.find(c=>c.id===diode.id).parameters.model={...advanced,seriesResistance:100};
  const next=adapter.compile(updated);const time=f.time;
  session.updateProjection(JSON.parse(next.canonical),d.id);const after=session.step(50);assert.ok(after.time>time);
  const fresh=adapter.createSession(createEngine());fresh.loadDocument(updated);const expected=fresh.step(50);
  assert.ok(Math.abs(after.pinVoltages[diode.id].anode-expected.pinVoltages[diode.id].anode)<1e-6,'Live custom model edits match reload');
 }
}
for(const model of [simple,advanced,'default-zener']){
 const {d,diode}=circuit(model,'zener',true);session.loadDocument(d);const f=session.step(50);
 const bv=catalog.resolveDiodeModel(model).breakdownVoltage;
 assert.ok(Math.abs(Math.abs(f.pinVoltages[diode.id].anode)-bv)<1,'Reverse breakdown follows chosen model');
}
for(const kind of ['led','zener']){
 const {d,diode}=circuit(null,kind);diode.parameters=kind==='led'?{forwardVoltage:2.1,maxCurrent:.01}:{forwardVoltage:.805904783,breakdownVoltage:5.6};
 session.loadDocument(d);const before=session.step(50).pinVoltages[diode.id].anode;
 diode.parameters=catalog.diodeEditorParameters(kind,diode.parameters);session.loadDocument(d);
 assert.ok(Math.abs(before-session.step(50).pinVoltages[diode.id].anode)<1e-7,'Legacy edit migration preserves the IV curve');
}
for(const change of [{saturationCurrent:0},{seriesResistance:-1},{emissionCoefficient:0},{breakdownVoltage:-1},{name:'default'},{name:''}]){
 const {d}=circuit({...advanced,...change});assert.throws(()=>documents.validate(d));assert.throws(()=>adapter.compile(d));
}
for(const change of [{red:2},{maxCurrent:0},{green:NaN}]){
 const {d,diode}=circuit('default-led','led');Object.assign(diode.parameters,change);assert.throws(()=>documents.validate(d));assert.throws(()=>adapter.compile(d));
}
const {d,diode}=circuit(advanced);const other=structuredClone(diode);other.id='conflict';other.parameters.model.seriesResistance=2;
 d.electrical.components.push(other);d.layout.components[other.id]={x:2000,y:0,rotation:0,mirror:false};
assert.throws(()=>documents.validate(d),/Conflicting/);assert.throws(()=>adapter.compile(d),/Conflicting/);
console.log('Custom simple/advanced diodes, LEDs, zeners, colors, breakdown, live edits, migration, shared-model conflicts passed.');

{
 const {d,diode}=circuit(advanced);const other=structuredClone(diode);other.id='shared';d.electrical.components.push(other);d.layout.components.shared={x:2000,y:0,rotation:0,mirror:false};
 editing.replaceParameters(d,diode.id,{model:{...advanced,seriesResistance:42}});
 assert.equal(other.parameters.model.seriesResistance,42,'Shared model edits propagate');
 editing.replaceParameters(d,diode.id,{model:{...advanced,name:'Independent diode',seriesResistance:7}});
 assert.equal(other.parameters.model.seriesResistance,42,'Renamed model is independent');documents.validate(d);
}
