// Editing contracts on the current authored symbols and 50-unit grid.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {editing as M,adapter as A,catalog} from '../packages/circuit-core/index.mjs';
const saved=JSON.parse(await readFile(new URL('../docs/new-simulator/examples/voltage-divider.json',import.meta.url)));
const calls=[],model=M.create(saved,(doc,label)=>calls.push({doc,label})),initial=model.document;
assert.deepEqual(saved.layout.components.r1,{x:160,y:80,rotation:0,mirror:false},'Loading does not mutate caller data');
assert.deepEqual(initial.layout.components.r1,{x:150,y:100,rotation:0,mirror:false},'Old layouts align to the current grid');
const canonical=A.compile(initial).canonical,selected=new Set([M.token('component','r1'),M.token('component','r2')]);
model.transaction('Move group',d=>M.move(d,selected,50,-50));
assert.equal(calls.length,1);assert.equal(model.document.layout.components.r1.x,200);
assert.equal(A.compile(model.document).canonical,canonical);
model.undo();assert.deepEqual(model.document,initial);model.redo();assert.equal(calls.length,3);model.undo();
const before=model.document;model.transaction('Rotate',d=>d.layout.components.r1.rotation=90);
assert.deepEqual(M.pin(model.document,{kind:'pin',componentId:'r1',pinId:'a'}),{x:250,y:100});
model.undo();assert.deepEqual(model.document,before);
const camera={x:80,y:-45,scale:.7},cursor={x:344,y:270},changed=M.zoom(camera,cursor,1.5);
for(const axis of ['x','y'])assert.ok(Math.abs((cursor[axis]-camera[axis])/camera.scale-(cursor[axis]-changed[axis])/changed.scale)<1e-9);
assert.equal(M.zoom(camera,cursor,100).scale,1.28);assert.equal(M.zoom(camera,cursor,.001).scale,.064);
// Placement and quarter-turn/reflection pin geometry use the current authored catalog.
for(const [kind,definition] of Object.entries(M.definitions))for(const rotation of [0,90,180,270])for(const mirror of [false,true]){
 const editor=M.create(M.empty()),id=editor.addComponent(kind,500,500,rotation,mirror),d=editor.document;
 const pose=d.layout.components[id],angle=rotation*Math.PI/180;
 for(const [pinId,[x,y]] of Object.entries(catalog.componentPins(d.electrical.components[0]))){
  const p=M.pin(d,{kind:'pin',componentId:id,pinId}),localX=x*(mirror?-1:1);
  assert.ok(Math.abs(p.x-(pose.x+localX*Math.cos(angle)-y*Math.sin(angle)))<1e-9,kind);
  assert.ok(Math.abs(p.y-(pose.y+localX*Math.sin(angle)+y*Math.cos(angle)))<1e-9,kind);
 }

 assert.deepEqual(M.create(JSON.parse(JSON.stringify(d))).document,d);editor.undo();assert.equal(editor.document.electrical.components.length,0);
}
// Contacts, detached movement and replacement are one undoable operation each.
const contact=M.create(M.empty()),r=contact.addComponent('resistor',0,0,270),g=contact.addComponent('ground',100,0),touching=contact.document;
assert.equal(touching.electrical.wires.length,1);assert.equal(M.route(touching,touching.electrical.wires[0]).length,1);
contact.transaction('Detach ground',d=>M.transformSelection(d,new Set([M.token('component',g)]),0,200,{disconnect:true,contacts:true}));
assert.equal(contact.document.electrical.wires.length,0);assert.equal(contact.document.electrical.junctions.length,0);contact.undo();assert.deepEqual(contact.document,touching);
// Clipboard clones graph IDs and preserves the selected internal connection.
const pair=M.create(M.empty()),a=pair.addComponent('resistor',0,0,270),b=pair.addComponent('resistor',600,0,270);
pair.connect({kind:'pin',componentId:a,pinId:'b'},{kind:'pin',componentId:b,pinId:'a'});
const original=pair.document,selection=new Set([M.token('component',a),M.token('component',b)]),fragment=M.copySelection(original,selection),copy=structuredClone(original);
const pasted=M.pasteSelection(copy,fragment);M.validate(copy);assert.equal(pasted.size,3);assert.equal(copy.electrical.components.length,4);
assert.equal(new Set(copy.electrical.components.map(c=>c.id)).size,4);assert.deepEqual(pair.document,original);
pair.transaction('Detach pair',d=>M.transformSelection(d,selection,100,200,{disconnect:true,contacts:true}));
assert.deepEqual(pair.document.electrical,original.electrical);pair.undo();assert.deepEqual(pair.document,original);
// Wire and pin voltage probes do not change electrical identity; label moves undo exactly.
const probeId=pair.addProbe({kind:'pin',componentId:a,pinId:'a'}),withProbe=pair.document,probe=withProbe.probes[0];
assert.deepEqual(withProbe.electrical,original.electrical);assert.equal(M.probeVoltage(withProbe,probe,null),undefined);
const p=M.probePoint(withProbe,probe);pair.transaction('Move probe label',d=>M.move(d,new Set([M.token('probe',probeId)]),50,100));
assert.deepEqual(M.probePoint(pair.document,probe),{x:p.x+50,y:p.y+100});assert.deepEqual(pair.document.electrical,original.electrical);pair.undo();assert.deepEqual(pair.document,withProbe);
pair.remove(new Set([M.token('probe',probeId)]));assert.equal(pair.document.probes.length,0);pair.undo();assert.deepEqual(pair.document,withProbe);
const bad=structuredClone(initial);bad.electrical.wires[0].from.pinId='missing';assert.throws(()=>model.replace(bad),/Invalid wire/);assert.deepEqual(model.document,initial);
// Inline placement removes the bypass in every authored two-pin orientation.
function span(kind='resistor',rotation=0,withMiddle=false){
 const d=M.empty(),pins=Object.values(M.definitions[kind].pins),horizontal=(pins[0][1]===pins[1][1])===(rotation%180===0);
 const point=n=>horizontal?{x:n,y:0}:{x:0,y:n};
 for(const [id,n] of [['start',-500],['end',500],...(withMiddle?[['mid',0]]:[])]){d.electrical.junctions.push({id});d.layout.junctions[id]=point(n);}
 const wire=(id,from,to)=>{d.electrical.wires.push({id,from:{kind:'junction',junctionId:from},to:{kind:'junction',junctionId:to}});d.layout.wires[id]={bends:[]};};
 if(withMiddle){wire('span','start','mid');wire('tail','mid','end');}else wire('span','start','end');
 return M.create(d);
}
for(const kind of ['resistor','capacitor','switch','voltageSource'])for(const rotation of [0,90,180,270]){
 const editor=span(kind,rotation),before=editor.document,id=editor.addComponent(kind,0,0,rotation),after=editor.document;
 assert.equal(after.electrical.wires.length,2,kind+'/'+rotation);assert.equal(after.electrical.junctions.length,2);
 for(const pinId of Object.keys(M.definitions[kind].pins))assert.equal(after.electrical.wires.filter(w=>[w.from,w.to].some(ref=>ref.componentId===id&&ref.pinId===pinId)).length,1);
 editor.undo();assert.deepEqual(editor.document,before);editor.redo();assert.deepEqual(editor.document,after);
}
const chain=span('resistor',0,true),chainBefore=chain.document;chain.addComponent('resistor',0,0);
assert.ok(!chain.document.electrical.junctions.some(j=>j.id==='mid'));assert.equal(chain.document.electrical.wires.length,2);chain.undo();assert.deepEqual(chain.document,chainBefore);
for(const protectedBy of ['branch','probe']){
 const editor=span('resistor',0,true);
 if(protectedBy==='probe')editor.addProbe({kind:'junction',junctionId:'mid'});
 else {const ground=editor.addComponent('ground',300,0);editor.connect({kind:'junction',junctionId:'mid'},{kind:'pin',componentId:ground,pinId:'g'});}
 const before=editor.document;assert.throws(()=>editor.addComponent('resistor',0,0),/branch|probe/);assert.deepEqual(editor.document,before);
}
// Crossing geometry remains a different net when inserting into the wire span.
const crossing=span();crossing.transaction('Crossing',d=>{
 for(const [id,x] of [['left',-300],['right',300]]){d.electrical.junctions.push({id});d.layout.junctions[id]={x,y:0};}
 d.electrical.wires.push({id:'cross',from:{kind:'junction',junctionId:'left'},to:{kind:'junction',junctionId:'right'}});d.layout.wires.cross={bends:[]};
});const crossBefore=crossing.document.electrical.wires.find(w=>w.id==='cross');crossing.addComponent('resistor',0,0);assert.deepEqual(crossing.document.electrical.wires.find(w=>w.id==='cross'),crossBefore);
console.log('Editor model passed: current-grid normalization, caller ownership, history, camera, all catalog poses, contacts, clipboard, probes, invalid loads, 16 inline poses, protected branches/probes and disconnected crossings.');
