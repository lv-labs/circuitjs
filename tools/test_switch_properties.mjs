import assert from 'node:assert/strict';
import {catalog,editing,adapter,document as documents} from '../packages/circuit-core/index.mjs';
import {createEngine} from './engine_node_runtime.mjs';
const session=adapter.createSession(createEngine());
function make(kind,parameters={}){
 const d=editing.empty();d.id='switch-properties';
 function add(id,kind,parameters={}){d.electrical.components.push({id,kind,modelVersion:1,parameters:{...structuredClone(catalog.definitions[kind].parameters),...parameters}});d.layout.components[id]={x:d.electrical.components.length*500,y:0,rotation:0,mirror:false};}
 function connect(a,ap,b,bp){const id='w'+d.electrical.wires.length;d.electrical.wires.push({id,from:{kind:'pin',componentId:a,pinId:ap},to:{kind:'pin',componentId:b,pinId:bp}});d.layout.wires[id]={bends:[]};}
 add('s',kind,parameters);add('v','voltageRail');add('g','ground');
 return {d,add,connect};
}
for(const kind of ['switch','pushSwitch','spdtSwitch','dpdtSwitch','mbbSwitch'])for(const onResistance of [0,100,1000]){
 const {d,add,connect}=make(kind,{onResistance,...(kind==='pushSwitch'?{normallyClosed:true}:kind==='switch'?{closed:true}:{})});
 const part=d.electrical.components[0],pins=Object.keys(catalog.componentPins(part));
 if(pins.length===2){add('r','resistor',{resistance:1000});connect('v','p','s','a');connect('s','b','r','a');connect('r','b','g','g');}
 else if(kind==='dpdtSwitch')for(let i=1;i<=2;i++){add('r'+i,'resistor',{resistance:1000});connect('v','p','s','common'+i);connect('s','a'+i,'r'+i,'a');connect('r'+i,'b','g','g');}
 else{add('r','resistor',{resistance:1000});connect('v','p','s','common');connect('s','a','r','a');connect('r','b','g','g');}
 documents.validate(d);const compiled=adapter.compile(d);assert.equal(adapter.fromProjection(JSON.parse(compiled.canonical),d.id).canonical,compiled.canonical);
 session.loadDocument(d);const f=session.step(10),r=kind==='dpdtSwitch'?'r1':'r';assert.ok(Math.abs(f.pinVoltages[r].a-5*1000/(1000+onResistance))<1e-7,`${kind} ${onResistance}`);
 if(onResistance===100){editing.replaceParameters(d,'s',{...part.parameters,onResistance:2000});session.updateProjection(JSON.parse(adapter.compile(d).canonical),d.id);assert.ok(Math.abs(session.step(10).pinVoltages[r].a-5/3)<1e-7,'Live switch resistance');}
}
{
 const {d}=make('spdtSwitch');
 const part=d.electrical.components[0];
 assert.equal(catalog.switchPositionCount(part),2,'New SPDT switches have two positions');
 editing.toggleSwitches(d,'s');assert.equal(part.parameters.position,1);
 editing.toggleSwitches(d,'s');assert.equal(part.parameters.position,0);
 const legacy=make('spdtSwitch',{centerOff:true}).d;
 assert.equal(catalog.switchPositionCount(legacy.electrical.components[0]),3,'Preserve legacy center-off circuits');
 editing.toggleSwitches(legacy,'s');editing.toggleSwitches(legacy,'s');
 assert.equal(legacy.electrical.components[0].parameters.position,2);
 documents.validate(legacy);adapter.compile(legacy);
}
for(const closed of [false,true]){
 const {d,add,connect}=make('switch',{closed,momentary:true});
 add('r','resistor',{resistance:1000});connect('v','p','s','a');connect('s','b','r','a');connect('r','b','g','g');
 const voltage=document=>{session.loadDocument(document);return session.step(10).pinVoltages.r.a;};
 assert.ok(Math.abs(voltage(d)-(closed?5:0))<1e-7,'Momentary rest contact state');
 assert.ok(Math.abs(voltage(editing.momentaryDocument(d,'s'))-(closed?0:5))<1e-7,'Momentary pressed contact state');
 assert.equal(d.electrical.components[0].parameters.closed,closed,'Press preserves rest state');
 assert.ok(Math.abs(voltage(d)-(closed?5:0))<1e-7,'Release returns to rest state');
}
for(const throwCount of [2,3,10]){
 const {d,add,connect}=make('spdtSwitch',{throwCount,centerOff:false,position:throwCount-1,onResistance:20});
 connect('v','p','s','common');for(let i=0;i<throwCount;i++){add('r'+i,'resistor',{resistance:1000});connect('s',i<2?['a','b'][i]:'throw'+(i+1),'r'+i,'a');connect('r'+i,'b','g','g');}
 session.loadDocument(d);const f=session.step(10);assert.ok(f.pinVoltages['r'+(throwCount-1)].a>4.8);for(let i=0;i<throwCount-1;i++)assert.ok(Math.abs(f.pinVoltages['r'+i].a)<1e-7);
 editing.replaceParameters(d,'s',{...d.electrical.components[0].parameters,throwCount:2,position:0});documents.validate(d);session.updateProjection(JSON.parse(adapter.compile(d).canonical),d.id);assert.ok(session.step(10).pinVoltages.r0.a>4.8);
}
for(const poleCount of [1,2,8]){
 const {d,add,connect}=make('dpdtSwitch',{poleCount,position:1,onResistance:100});
 for(let i=1;i<=poleCount;i++){add('r'+i,'resistor',{resistance:1000});connect('v','p','s','common'+i);connect('s','b'+i,'r'+i,'a');connect('r'+i,'b','g','g');}
 session.loadDocument(d);const f=session.step(10);for(let i=1;i<=poleCount;i++)assert.ok(Math.abs(f.pinVoltages['r'+i].a-50/11)<1e-7);
}
{
 const {d,add}=make('switch',{closed:true,linkLabel:'Shared label',momentary:true});add('linked','switch',{closed:false,linkLabel:'Shared label'});add('other','switch',{closed:true});
 const pressed=editing.momentaryDocument(d,'s');assert.equal(pressed.electrical.components[0].parameters.closed,false);assert.equal(pressed.electrical.components.find(c=>c.id==='linked').parameters.closed,true);assert.equal(d.electrical.components[0].parameters.closed,true,'Momentary preview leaves saved rest state unchanged');
 editing.toggleSwitches(d,'s');assert.equal(d.electrical.components.find(c=>c.id==='other').parameters.closed,true);
}
{
 const {d,add}=make('spdtSwitch',{group:7});add('linked','spdtSwitch',{position:1,group:7});editing.toggleSwitches(d,'s');assert.equal(d.electrical.components.find(c=>c.id==='linked').parameters.position,1);
}
for(const [kind,change] of [['switch',{onResistance:-1}],['spdtSwitch',{throwCount:11}],['dpdtSwitch',{poleCount:0}],['mbbSwitch',{group:-1}]]){const {d}=make(kind,change);assert.throws(()=>documents.validate(d));assert.throws(()=>adapter.compile(d));}
console.log('Switch resistance, live edits, variable throws/poles, linked and momentary operation passed.');
