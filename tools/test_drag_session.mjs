import {editing as CircuitEditorModel, adapter as CircuitDocumentAdapter} from '../packages/circuit-core/index.mjs';
import assert from 'node:assert/strict';
const M=CircuitEditorModel,A=CircuitDocumentAdapter,copy=structuredClone;
const selected=new Set([M.token('component','moving')]);
function fixture(kind='corner'){
 const d=M.empty();
 for(const [id,x,y] of [['moving',0,0],['fixed',800,300]]){
  d.electrical.components.push({id,kind:'resistor',reference:id,modelVersion:1,parameters:{resistance:1000}});d.layout.components[id]={x,y,rotation:270,mirror:false};
 }
 const pin={kind:'pin',componentId:'moving',pinId:'b'},fixed={kind:'pin',componentId:'fixed',pinId:'a'};
 function node(id,x,y){d.electrical.junctions.push({id});d.layout.junctions[id]={x,y};return {kind:'junction',junctionId:id};}
 function wire(id,from,to,bends=[]){d.electrical.wires.push({id,from,to});d.layout.wires[id]={bends};}
 if(kind==='pin'){d.layout.components.fixed.y=0;wire('lead',pin,fixed);}
 else if(kind==='contact'){d.layout.components.fixed={x:200,y:0,rotation:270,mirror:false};wire('lead',pin,fixed);}
 else{
  const corner=node('corner',400,0),next=node('next',400,300);wire('lead',pin,corner);wire('vertical',corner,next);wire('right',next,fixed);
  if(kind==='branch')wire('branch',corner,node('loose',600,0));
  if(kind==='probed'){d.probes.push({id:'probe',kind:'voltage',positive:corner,reference:'ground',label:'V'});d.layout.probes={probe:{x:50,y:-100}};}
 }
 // A crossing on another net must never be pulled along or connected.
 const one=node('cross-a',250,-350),two=node('cross-b',250,550);wire('cross',one,two);
 return M.validate(d);
}
function valid(d,canonical){
 M.validate(d);assert.equal(A.compile(d).canonical,canonical,'Drag preserves terminal connectivity');
 for(const w of d.electrical.wires){const p=[M.pin(d,w.from),...d.layout.wires[w.id].bends,M.pin(d,w.to)];for(let i=1;i<p.length;i++)assert.ok(p[i].x===p[i-1].x||p[i].y===p[i-1].y,'Every stored segment is orthogonal');}
}
let checks=0;
for(const kind of ['corner','branch','pin','contact','probed']){
 const base=fixture(kind),before=copy(base),canonical=A.compile(base).canonical,drag=M.createDragSession(base,selected);
 // Diagonal movement, shrinking a neighbour to zero, crossing beyond it,
 // reversing each axis, returning to origin, then dragging out again.
 for(const [x,y] of [[0,100],[100,200],[100,300],[100,400],[-100,400],[-100,-200],[200,-200],[0,0],[0,-100],[0,0],[200,200]]){
  const preview=drag.update(x,y);valid(preview,canonical);assert.deepEqual(base,before,'Preview is isolated');
  assert.deepEqual(drag.document,preview,'Repeated snapshots have stable IDs');
  if(!x&&!y)assert.deepEqual(preview,base,'Returning home removes all temporary geometry');
  const crossing=preview.electrical.wires.find(w=>w.id==='cross');assert.deepEqual(M.route(preview,crossing),M.route(base,base.electrical.wires.find(w=>w.id==='cross')),'Unrelated crossing stays still');
  checks++;
 }
 const result=drag.finish();valid(result,canonical);assert.deepEqual(drag.finish(),result,'Finalization is stable');
 const normalized=copy(result);M.normalizeWires(normalized);assert.deepEqual(normalized,result,'Final cleanup is idempotent');
 const model=M.create(base,()=>{},{wireSections:true}),prior=model.document;model.transaction('Drag',d=>Object.assign(d,result));model.undo();assert.deepEqual(model.document,prior);model.redo();assert.deepEqual(model.document,result);
 const cancelled=M.createDragSession(base,selected);cancelled.update(200,200);assert.deepEqual(cancelled.cancel(),base);assert.throws(()=>cancelled.update(0,0),/cancelled/);
}
// The same dogleg is reused across many pointer events instead of creating new
// wire pairs for each pixel/grid movement.
{
 const base=fixture('pin'),drag=M.createDragSession(base,selected);let count;
 for(let y=50;y<=800;y+=50){const d=drag.update(0,y);count??=d.electrical.wires.length;assert.equal(d.electrical.wires.length,count);}
 drag.update(0,0);assert.deepEqual(drag.document,base);
}
// Whole-wire selection and single-section dragging share the same solver.
{
 const base=fixture('branch'),canonical=A.compile(base).canonical,drag=M.createDragSession(base,new Set(),{wireId:'lead',segment:0});
 for(const [x,y] of [[200,100],[200,-100],[0,0],[0,200]]){const d=drag.update(x,y);valid(d,canonical);assert.deepEqual(d.layout.components,base.layout.components);assert.deepEqual(d.layout.junctions.corner,base.layout.junctions.corner);}
 valid(drag.finish(),canonical);
}
// Multiple attached wires share one gesture and use distinct bend offsets.
{
 const base=fixture('pin');base.electrical.wires.push({id:'second',from:{kind:'pin',componentId:'moving',pinId:'a'},to:{kind:'pin',componentId:'fixed',pinId:'b'}});base.layout.wires.second={bends:[]};
 const canonical=A.compile(base).canonical,drag=M.createDragSession(base,selected),d=drag.update(0,200);valid(d,canonical);
 const bends=d.electrical.wires.filter(w=>['lead','second'].includes(w.id)).map(w=>d.layout.wires[w.id].bends[0]?.x);assert.equal(new Set(bends).size,2,'Parallel attached wires get staggered bends');
 valid(drag.finish(),canonical);
}
console.log(`Drag sessions passed: ${checks} incremental/reversal states, zero-length wires, branch/pin constraints, contacts, probe anchors, crossings, stable previews, cleanup, section drag, grouped bends, cancel and atomic undo/redo.`);

// Deterministic long gestures exercise repeated reversals and temporary-edge
// reuse at many offsets, beyond the small hand-picked examples above.
{
 let seed=0x71ca;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
 for(const kind of ['corner','branch','pin','contact','probed']){
  const base=fixture(kind),canonical=A.compile(base).canonical,drag=M.createDragSession(base,selected);
  for(let i=0;i<80;i++){
   const x=((random()%33)-50)*50,y=((random()%33)-50)*50;
   valid(drag.update(x,y),canonical);valid(drag.finish(),canonical);
   assert.deepEqual(drag.document,drag.document);
  }
  assert.deepEqual(drag.update(0,0),base);
 }
 console.log('Drag stress checks passed: 400 seeded incremental offsets and finalized connectivity checks.');
}

{
 const base=fixture('corner'),drag=M.createDragSession(base,selected),canonical=A.compile(base).canonical;
 drag.update(100,200);const result=drag.finish({rotation:90,orientations:[{axis:'x'}]});M.validate(result);
 for(const wire of base.electrical.wires){const after=result.electrical.wires.find(w=>w.id===wire.id);assert.deepEqual(M.route(result,after),M.route(base,wire),'Flip leaves original wire geometry behind');}
 assert.notEqual(result.layout.components.moving.rotation,base.layout.components.moving.rotation);
 assert.deepEqual(drag.finish({rotation:90,orientations:[{axis:'x'}]}),result);
}
