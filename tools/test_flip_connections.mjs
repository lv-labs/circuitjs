import assert from 'node:assert/strict';
import '../experiments/engine/editor-model.js';
const M=CircuitEditorModel;
// Compare occupied spans, allowing a final-position contact to split a wire.
const geometry=d=>{
 const spans=new Set();
 for(const w of d.electrical.wires){const path=M.route(d,w);for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],dx=Math.sign(b.x-a.x)*M.grid,dy=Math.sign(b.y-a.y)*M.grid;
  for(let x=a.x,y=a.y;x!==b.x||y!==b.y;x+=dx,y+=dy){const pair=[{x,y},{x:x+dx,y:y+dy}].sort((a,b)=>a.x-b.x||a.y-b.y);spans.add(JSON.stringify(pair));}
 }}
 return [...spans].sort();
};
let checks=0;
for(const kind of ['diode','opamp','npn'])for(const rotation of [0,90,180,270])for(const mirror of [false,true])for(const operation of [{axis:'x'},{axis:'y'},{rotate:90},{rotate:180},{rotate:270}]){
 const d=M.empty(),id='part';d.electrical.components.push({id,kind,reference:'X1',modelVersion:1,parameters:structuredClone(M.definitions[kind].parameters)});d.layout.components[id]={x:256,y:256,rotation,mirror};
 for(const pinId of Object.keys(M.definitions[kind].pins)){
  const ref={kind:'pin',componentId:id,pinId},p=M.pin(d,ref),x=p.x-256,y=p.y-256,point=Math.abs(x)>=Math.abs(y)?{x:p.x+Math.sign(x||1)*128,y:p.y}:{x:p.x,y:p.y+Math.sign(y||1)*128};
  d.electrical.junctions.push({id:pinId});d.layout.junctions[pinId]=point;d.electrical.wires.push({id:pinId,from:ref,to:{kind:'junction',junctionId:pinId}});d.layout.wires[pinId]={bends:[]};
 }
 const model=M.create(d,()=>{},{wireSections:true}),before=model.document,original=geometry(before),selection=new Set([M.token('component',id)]);
 model.transaction('Flip',next=>M.transformSelection(next,selection,0,0,{orientations:[operation]}));
 const flipped=model.document;M.validate(flipped);assert.deepEqual(geometry(flipped),original,'Flip leaves every visible wire segment in place');
 for(const w of flipped.electrical.wires)for(const side of ['from','to'])if(w[side].componentId===id){const p=M.pin(flipped,w[side]);assert.ok(Object.keys(M.definitions[kind].pins).some(pinId=>{const old=M.pin(before,{kind:'pin',componentId:id,pinId});return p.x===old.x&&p.y===old.y;}),'Reattached pins meet an old wire endpoint');}
 model.undo();assert.deepEqual(model.document,before);model.redo();assert.deepEqual(model.document,flipped);
 // Flipping during an existing connected drag must discard its temporary wires.
 const drag=M.createDragSession(before,selection);drag.update(64,64);const result=drag.finish({orientations:[operation]});M.validate(result);assert.deepEqual(geometry(result),original,'Drag then reorient leaves original wiring behind');
 checks++;
}
// Even wires between two selected components stay behind during a flip.
{
 const model=M.create(M.empty(),()=>{},{wireSections:true}),a=model.addComponent('resistor',0,0),b=model.addComponent('resistor',256,0);
 model.connect({kind:'pin',componentId:a,pinId:'b'},{kind:'pin',componentId:b,pinId:'a'});const before=model.document;
 model.transaction('Flip pair',d=>M.transformSelection(d,new Set([M.token('component',a),M.token('component',b)]),0,0,{orientations:[{axis:'x'}]}));assert.deepEqual(geometry(model.document),geometry(before));
}
console.log(`Rotation/flip connections passed: ${checks} kind/rotation/mirror/operation cases, stationary wires, final-position contacts, drag-then-flip, multiple components and exact undo/redo.`);
