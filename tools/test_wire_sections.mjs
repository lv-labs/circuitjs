import {editing as CircuitEditorModel, adapter as CircuitDocumentAdapter} from '../packages/circuit-core/index.mjs';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {outputFamilyKinds,outputFamilyCircuit} from './output_family_fixtures.mjs';
import {passiveMenuKinds,passiveMenuCircuit} from './passive_menu_fixtures.mjs';
import {expansionKinds,expansionCircuit} from './component_expansion_fixtures.mjs';
const M=CircuitEditorModel,A=CircuitDocumentAdapter,point=(x,y)=>({kind:'point',point:{x,y}}),endpoint=(m,x,y)=>{const j=m.document.electrical.junctions.find(j=>m.document.layout.junctions[j.id].x===x&&m.document.layout.junctions[j.id].y===y);assert.ok(j);return {kind:'junction',junctionId:j.id};};
const create=d=>M.create(d||M.empty(),()=>{},{wireSections:true});
function valid(m){M.validate(m.document);assert.ok(m.document.electrical.wires.every(w=>M.route(m.document,w).length<=2));const n=structuredClone(m.document);M.normalizeWires(n);assert.deepEqual(n,m.document,'Normalization is idempotent');}
// Several creation gestures become one straight selectable section.
{
 const m=create();m.connect(point(0,0),point(200,0));m.connect(endpoint(m,200,0),point(400,0));m.connect(endpoint(m,400,0),point(600,0));valid(m);assert.equal(m.document.electrical.wires.length,1);assert.equal(m.document.electrical.junctions.length,2);
 const hits=[50,250,500].map(x=>M.hit(m.document,{x,y:0}));assert.ok(hits.every(h=>h.kind==='wire'&&h.id===hits[0].id));
 const before=m.document;m.remove(new Set([M.token('wire',hits[0].id)]));assert.equal(m.document.electrical.wires.length,0);m.undo();assert.deepEqual(m.document,before);m.redo();assert.equal(m.document.electrical.wires.length,0);
}
// One bent creation gesture becomes independent horizontal and vertical sections.
{
 const m=create();m.connect(point(0,0),point(400,300),[{x:400,y:0}]);valid(m);assert.equal(m.document.electrical.wires.length,2);
 const h=M.hit(m.document,{x:200,y:0}),v=M.hit(m.document,{x:400,y:150});assert.equal(h.kind,'wire');assert.equal(v.kind,'wire');assert.notEqual(h.id,v.id);
 const before=m.document;m.remove(new Set([M.token('wire',h.id)]));assert.equal(m.document.electrical.wires.length,1);assert.deepEqual(M.route(m.document,m.document.electrical.wires[0]),M.route(before,before.electrical.wires.find(w=>w.id===v.id)));m.undo();assert.deepEqual(m.document,before);
 m.connect(endpoint(m,400,300),point(400,600));valid(m);assert.equal(m.document.electrical.wires.length,2,'Collinear extension merges beyond old creation boundary');
}
// Branches split the straight run, while crossing interiors stay separate.
{
 const m=create();m.connect(point(0,0),point(600,0));const id=m.document.electrical.wires[0].id;m.connect({kind:'wire',id,point:{x:300,y:0}},point(300,300));valid(m);assert.equal(m.document.electrical.wires.length,3);assert.equal(M.junctionDots(m.document).length,1);
 const hits=[[100,0],[500,0],[300,150]].map(([x,y])=>M.hit(m.document,{x,y}));assert.equal(new Set(hits.map(h=>h.id)).size,3);
 const c=create();c.connect(point(0,200),point(600,200));c.connect(point(300,0),point(300,400));valid(c);assert.equal(c.document.electrical.wires.length,2);assert.equal(M.junctionDots(c.document).length,0);
}
// Reconnecting separate loose ends erases the construction boundary as well.
{
 const m=create();m.connect(point(0,0),point(200,0));m.connect(point(400,0),point(600,0));const end=endpoint(m,200,0),target=endpoint(m,400,0);m.transaction('Reconnect',d=>M.reconnect(d,end.junctionId,target));valid(m);assert.equal(m.document.electrical.wires.length,1);const route=M.route(m.document,m.document.electrical.wires[0]);assert.equal(Math.abs(route[0].x-route[1].x),600);
}
// An isolated section travels with its loose ends, retaining its section ID.
{
 const m=create();m.connect(point(0,0),point(400,0));const id=m.document.electrical.wires[0].id;m.transaction('Reroute section',d=>M.moveSegment(d,id,0,0,100));valid(m);assert.equal(m.document.electrical.wires.length,1);assert.deepEqual(M.route(m.document,m.document.electrical.wires.find(w=>w.id===id)),[{x:0,y:100},{x:400,y:100}]);
}
// Delete only the component: preserve wire geometry/shared pin nets and voltage
// probes at old pins; remove the component's current probe; undo is exact.
{
 const d=M.empty();d.electrical.components.push({id:'r',kind:'resistor',reference:'R',modelVersion:1,parameters:{resistance:1000}});d.layout.components.r={x:200,y:200,rotation:270,mirror:false};
 for(const [id,x,y] of [['left',-100,200],['right',600,200],['branch',100,500]]){d.electrical.junctions.push({id});d.layout.junctions[id]={x,y};}
 for(const [id,pinId,junctionId] of [['wa','a','left'],['wb','b','right'],['wc','a','branch']]){d.electrical.wires.push({id,from:{kind:'pin',componentId:'r',pinId},to:{kind:'junction',junctionId}});d.layout.wires[id]={bends:[]};}
 d.probes.push({id:'voltage',kind:'voltage',positive:{kind:'pin',componentId:'r',pinId:'a'},reference:'ground',label:'V'},{id:'current',kind:'current',componentId:'r',label:'I'});d.layout.probes={voltage:{x:0,y:0},current:{x:0,y:0}};
 const m=create(d),before=m.document,routes=new Map(before.electrical.wires.map(w=>[w.id,M.route(before,w)]));m.remove(new Set([M.token('component','r')]));valid(m);assert.equal(m.document.electrical.components.length,0);assert.equal(m.document.electrical.wires.length,3);
 for(const w of m.document.electrical.wires){assert.deepEqual(M.route(m.document,w),routes.get(w.id));assert.ok(![w.from,w.to].some(r=>r.kind==='pin'));}
 const wa=m.document.electrical.wires.find(w=>w.id==='wa'),wc=m.document.electrical.wires.find(w=>w.id==='wc'),wb=m.document.electrical.wires.find(w=>w.id==='wb');assert.deepEqual(wa.from,wc.from);assert.notDeepEqual(wa.from,wb.from,'The deleted resistor gap is not bridged');assert.equal(m.document.probes.length,1);assert.deepEqual(m.document.probes[0].positive,wa.from);m.undo();assert.deepEqual(m.document,before);m.redo();valid(m);
 m.addComponent('resistor',200,200,270);valid(m);assert.ok(m.document.electrical.wires.some(w=>w.from.kind==='pin'||w.to.kind==='pin'),'A replacement component reconnects loose ends');
}
// Existing document and family networks keep exactly the same electrical nets:
// splitting/merging is geometry cleanup, never automatic crossing connectivity.
for(const [kinds,fixture] of [[outputFamilyKinds,outputFamilyCircuit],[passiveMenuKinds,passiveMenuCircuit],[expansionKinds,expansionCircuit]])for(const kind of kinds){const d=fixture(kind),m=create(d);valid(m);assert.equal(A.compile(m.document).canonical,A.compile(d).canonical,kind+' connectivity unchanged');}
for(const name of ['voltage-divider','switched-rc']){const d=JSON.parse(await readFile(new URL('../docs/new-simulator/examples/'+name+'.json',import.meta.url)));assert.equal(A.compile(create(d).document).canonical,A.compile(d).canonical);}
console.log('Wire sections passed: gesture-independent collinear merge, corner/branch selection, crossings, segment reroute/deletion, component deletion with loose shared ends/probes, exact undo and electrical equivalence.');
// Drag-created backtracking: the old junction is beyond the branch departure.
{
 const d=M.empty();
 for(const [id,x,y] of [['a',0,0],['old',600,0],['branch',200,0],['end',200,300]]){d.electrical.junctions.push({id});d.layout.junctions[id]={x,y};}
 for(const [id,from,to] of [['long','a','old'],['back','old','branch'],['up','branch','end']]){d.electrical.wires.push({id,from:{kind:'junction',junctionId:from},to:{kind:'junction',junctionId:to}});d.layout.wires[id]={bends:[]};}
 const m=create(d);valid(m);
 assert.equal(m.document.electrical.wires.length,2);
 assert.deepEqual(M.junctionDots(m.document),[]);
 assert.equal(m.document.electrical.wires.filter(w=>{const p=M.route(m.document,w);return p.every(p=>p.y===0)&&p.some(p=>p.x===600);}).length,0,'Backtracked tail is removed');
 const before=m.document;m.transaction('Drag branch',d=>M.move(d,new Set([M.token('junction','end')]),200,-300));valid(m);m.undo();assert.deepEqual(m.document,before);m.redo();valid(m);
}
// Contained reverse spans with distinct node IDs and a probe at the moving branch.
{
 const d=M.empty();
 for(const [id,x,y] of [['a',0,0],['b',600,0],['c',400,0],['d',200,0]]){d.electrical.junctions.push({id});d.layout.junctions[id]={x,y};}
 for(const [id,a,b] of [['outer','a','b'],['return','b','c'],['inner','c','d']]){d.electrical.wires.push({id,from:{kind:'junction',junctionId:a},to:{kind:'junction',junctionId:b}});d.layout.wires[id]={bends:[]};}
 d.probes.push({id:'v',kind:'voltage',positive:{kind:'junction',junctionId:'c'},reference:'ground',label:'V'});
 const m=create(d);valid(m);assert.equal(m.document.electrical.wires.length,1,'Turnaround tail is trimmed back to the probe anchor');assert.deepEqual(M.pin(m.document,m.document.probes[0].positive),{x:400,y:0});
}
console.log('Overlap regressions passed: reverse/contained spans, updated junction dots, probes, idempotence and drag undo/redo.');
// Actual component drag reverses the lead across a stationary connected section.
{
 const d=M.empty();d.electrical.components.push({id:'r',kind:'resistor',reference:'R1',modelVersion:1,parameters:{resistance:1000}});d.layout.components.r={x:200,y:200,rotation:270,mirror:false};
 for(const [id,x,y] of [['old',600,200],['branch',200,200],['end',200,500]]){d.electrical.junctions.push({id});d.layout.junctions[id]={x,y};}
 for(const [id,from,to] of [['lead',{kind:'pin',componentId:'r',pinId:'a'},{kind:'junction',junctionId:'old'}],['back',{kind:'junction',junctionId:'old'},{kind:'junction',junctionId:'branch'}],['branchWire',{kind:'junction',junctionId:'branch'},{kind:'junction',junctionId:'end'}]]){d.electrical.wires.push({id,from,to});d.layout.wires[id]={bends:[]};}
 const m=create(d),before=m.document;m.transaction('Drag component',d=>M.move(d,new Set([M.token('component','r')]),300,0));valid(m);
 assert.ok(!Object.values(m.document.layout.junctions).some(p=>p.x===600&&p.y===200),'Old turnaround tail is removed after component drag');
 const spans=m.document.electrical.wires.map(w=>M.route(m.document,w)).filter(p=>p.length===2&&p.every(p=>p.y===200));
 for(let i=0;i<spans.length;i++)for(let j=i+1;j<spans.length;j++){const a=spans[i].map(p=>p.x).sort((a,b)=>a-b),b=spans[j].map(p=>p.x).sort((a,b)=>a-b);assert.ok(Math.min(a[1],b[1])<=Math.max(a[0],b[0]),'Dragged component leaves no overlapping horizontal wire stretches');}
 m.undo();assert.deepEqual(m.document,before);m.redo();valid(m);
}
console.log('Component drag overlap regression passed.');
