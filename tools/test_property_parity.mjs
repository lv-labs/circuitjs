import assert from 'node:assert/strict';
import {catalog,editing,adapter,document as documents,geometry} from '../packages/circuit-core/index.mjs';
import {createEngine} from './engine_node_runtime.mjs';
const session=adapter.createSession(createEngine());
function make(){
 const d=editing.empty();d.id='properties';
 function add(id,kind,parameters={}){d.electrical.components.push({id,kind,modelVersion:1,parameters:{...structuredClone(catalog.definitions[kind].parameters),...parameters}});d.layout.components[id]={x:d.electrical.components.length*500,y:0,rotation:0,mirror:false};return id;}
 function connect(a,ap,b,bp){const id='w'+d.electrical.wires.length;d.electrical.wires.push({id,from:{kind:'pin',componentId:a,pinId:ap},to:{kind:'pin',componentId:b,pinId:bp}});d.layout.wires[id]={bends:[]};}
 return {d,add,connect};
}
const custom={name:'RF transistor',...catalog.resolveTransistorModel('default'),saturationCurrent:1e-15,beCapacitance:4.5e-12,bcCapacitance:3.6e-12,forwardTransitTime:.3e-9,reverseTransitTime:239e-9};
for(const kind of ['npn','pnp']){
 const results={};
 for(const model of [undefined,'default','spice-default',custom]){
  const {d,add,connect}=make();add('q',kind,{beta:100,...(model?{model}:{})});if(model===undefined)delete d.electrical.components[0].parameters.model;
  const sign=kind==='pnp'?-1:1;
  add('base','voltageRail',{waveform:{kind:'dc',voltage:.55*sign}});add('v','voltageRail',{waveform:{kind:'dc',voltage:5*sign}});add('r','resistor',{resistance:1000});add('g','ground');
  connect('base','p','q','base');connect('q','emitter','g','g');connect('v','p','r','a');connect('r','b','q','collector');
  documents.validate(d);const compiled=adapter.compile(d);assert.equal(adapter.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
  session.loadDocument(d);const f=session.step(50);assert.ok(Number.isFinite(f.pinVoltages.q.collector));results[typeof model==='object'?'custom':model??'legacy']=f.pinVoltages.q.collector;
  const next=structuredClone(d);next.electrical.components[0].parameters.model={...custom,saturationCurrent:2e-14};next.electrical.components[0].parameters.drawCircle=true;
  session.updateProjection(JSON.parse(adapter.compile(next).canonical),d.id);const after=session.step(100);
  const fresh=adapter.createSession(createEngine());fresh.loadDocument(next);const expected=fresh.step(100);
  assert.ok(Math.abs(after.pinVoltages.q.collector-expected.pinVoltages.q.collector)<1e-3,`Live transistor model update ${kind} ${JSON.stringify(model)}: ${after.pinVoltages.q.collector} vs ${expected.pinVoltages.q.collector}`);
  next.electrical.components[0].parameters.model='default';
  session.updateProjection(JSON.parse(adapter.compile(next).canonical),d.id);
  const disabled=session.step(100);fresh.loadDocument(next);const dc=fresh.step(100);
  assert.ok(Math.abs(disabled.pinVoltages.q.collector-dc.pinVoltages.q.collector)<1e-7,'Disabling junction charge clears retained companion stamps');
 }
 assert.ok(Math.abs(results.default-results['spice-default'])>.01,'Built-in transistor model affects collector current');
 assert.ok(Math.abs(results.default-results.legacy)<1e-9,'Legacy BJT model remains the default');
}
for(const key of Object.keys(catalog.transistorModelFields)){
 const bad={...custom,[key]:-1};assert.throws(()=>catalog.resolveTransistorModel(bad),key);
}
const kinds=['andGate','nandGate','orGate','norGate','xorGate','xnorGate'];
for(const kind of kinds)for(const inputCount of [1,2,3,8])for(const invertInputs of [false,true]){
 const {d,add,connect}=make();add('gate',kind,{inputCount,invertInputs,schmittInputs:true});add('v','voltageRail');add('r','resistor',{resistance:1000});add('g','ground');
 const inputs=Object.keys(catalog.componentPins(d.electrical.components[0])).filter(p=>p!=='out');
 for(const pin of inputs)connect('v','p','gate',pin);connect('gate','out','r','a');connect('r','b','g','g');
 documents.validate(d);const compiled=adapter.compile(d);assert.equal(adapter.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
 session.loadDocument(d);const f=session.step(5);
 const value=!invertInputs;
 const expected={andGate:value,nandGate:!value,orGate:value,norGate:!value,xorGate:value&&inputCount%2===1,xnorGate:!(value&&inputCount%2===1)}[kind];
 assert.equal(f.pinVoltages.gate.out>2.5,expected,`${kind} ${inputCount} inverted=${invertInputs}`);
 assert.equal(Object.keys(f.pinVoltages.gate).length,inputCount+1);
}
{
 const {d,add,connect}=make();add('gate','andGate',{propagationDelay:5e-5});add('v','voltageRail');add('r','resistor');add('g','ground');connect('v','p','gate','a');connect('v','p','gate','b');connect('gate','out','r','a');connect('r','b','g','g');
 session.loadDocument(d);assert.ok(session.step(2).pinVoltages.gate.out<.1);assert.ok(session.step(10).pinVoltages.gate.out>4.9,'Propagation delay eventually applies output');
}
{
 const {d,add,connect}=make();add('gate','andGate',{inputCount:8});add('g','ground');connect('gate','h','g','g');
 d.probes.push({id:'p',kind:'voltage',positive:{kind:'pin',componentId:'gate',pinId:'h'},reference:'ground'});
 const before=geometry.pin(d,{kind:'pin',componentId:'gate',pinId:'h'});
 editing.replaceParameters(d,'gate',{...d.electrical.components[0].parameters,inputCount:2});documents.validate(d);
 assert.equal(d.electrical.wires[0].from.kind,'junction');assert.deepEqual(d.layout.junctions[d.electrical.wires[0].from.junctionId],before);
 assert.deepEqual(d.probes[0].positive,d.electrical.wires[0].from,'Removed pins leave wire/probe endpoints connected');
}
console.log('BJT models, charge parameters, live edits, gate input counts, Schmitt/inverted inputs, delay and removed-pin migration passed.');
// Dynamic layouts also update while running, without stale node-array indexes.
{
 const {d,add,connect}=make();add('gate','andGate');add('v','voltageRail');add('g','ground');add('r','resistor');
 connect('v','p','gate','a');connect('v','p','gate','b');connect('gate','out','r','a');connect('r','b','g','g');session.loadDocument(d);session.step(5);
 editing.replaceParameters(d,'gate',{...d.electrical.components[0].parameters,inputCount:3});connect('v','p','gate','c');
 session.updateProjection(JSON.parse(adapter.compile(d).canonical),d.id);assert.ok(session.step(5).pinVoltages.gate.out>4.9);
 editing.replaceParameters(d,'gate',{...d.electrical.components[0].parameters,inputCount:1});
 session.updateProjection(JSON.parse(adapter.compile(d).canonical),d.id);assert.ok(session.step(5).pinVoltages.gate.out>4.9);
}
for(const kind of ['nmos','pmos']){
 const reverseVoltages={};
 for(const bodyDiode of [false,true]){
  const {d,add,connect}=make();add('fet',kind,{bodyDiode,bodyTerminal:true,threshold:1.5});add('v','voltageRail',{waveform:{kind:'dc',voltage:kind==='nmos'?-1:1}});add('r','resistor',{resistance:1000});add('g','ground');
  connect('fet','gate','g','g');connect('fet','source','g','g');connect('v','p','r','a');connect('r','b','fet','drain');if(bodyDiode)connect('fet','body','g','g');
  documents.validate(d);const compiled=adapter.compile(d);assert.equal(adapter.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
  session.loadDocument(d);const frame=session.step(40);reverseVoltages[bodyDiode]=Math.abs(frame.pinVoltages.fet.drain);
  if(bodyDiode){assert.ok('body' in frame.pinVoltages.fet);editing.replaceParameters(d,'fet',{...d.electrical.components[0].parameters,bodyTerminal:false});session.updateProjection(JSON.parse(adapter.compile(d).canonical),d.id);assert.ok(!('body' in session.step(40).pinVoltages.fet));}
 }
 assert.ok(reverseVoltages.true<reverseVoltages.false-.1,`${kind} body diode changes reverse conduction: ${JSON.stringify(reverseVoltages)}`);
 for(const options of [{digitalSymbol:true},{showBulk:false},{bodyDiode:false}])assert.ok(!('body' in catalog.componentPins({kind,parameters:{...catalog.definitions[kind].parameters,bodyTerminal:true,...options}})));
}
for(const [kind,pair] of [['npn',['collector','emitter']],['nmos',['source','drain']]]){
 const {d,add,connect}=make();add('q',kind);add('g','ground');connect('q',pair[0],'g','g');
 const before=geometry.pin(d,d.electrical.wires[0].from);
 editing.replaceParameters(d,'q',{...d.electrical.components[0].parameters,swapTerminals:true});documents.validate(d);
 assert.equal(d.electrical.wires[0].from.pinId,pair[1]);assert.deepEqual(geometry.pin(d,d.electrical.wires[0].from),before,'Swapping terminals preserves physical wires');
 session.loadDocument(d);const frame=session.step(5);for(const v of Object.values(frame.pinVoltages.q))assert.ok(Number.isFinite(v));
}
console.log('Live gate layout changes, MOSFET body diodes/terminals and terminal swaps passed.');
