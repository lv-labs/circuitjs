import assert from 'node:assert/strict';
import '../experiments/engine/editor-model.js';
import '../experiments/engine/document-adapter.js';
const M=CircuitEditorModel,A=CircuitDocumentAdapter;
for(const rotation of [0,90,180,270])for(const reverse of [false,true])for(const motion of ['parallel','perpendicular','diagonal'])for(const attachment of ['loose','corner','branch','pin']){
 const d=M.empty();d.electrical.components.push({id:'r',kind:'resistor',reference:'R1',modelVersion:1,parameters:{resistance:1000}});d.layout.components.r={x:0,y:0,rotation,mirror:false};
 const ref={kind:'pin',componentId:'r',pinId:'b'},a=M.pin(d,ref),horizontal=rotation%180===0,sign=Math.sign(horizontal?a.x:a.y),b=horizontal?{x:a.x+sign*192,y:a.y}:{x:a.x,y:a.y+sign*192};
 let fixed;
 function node(id,p){d.electrical.junctions.push({id});d.layout.junctions[id]=p;return {kind:'junction',junctionId:id};}
 function wire(id,from,to){d.electrical.wires.push({id,from,to});d.layout.wires[id]={bends:[]};}
 if(attachment==='pin'){
  d.electrical.components.push({id:'fixed-part',kind:'resistor',reference:'R2',modelVersion:1,parameters:{resistance:1000}});d.layout.components['fixed-part']={x:b.x+a.x,y:b.y+a.y,rotation,mirror:false};fixed={kind:'pin',componentId:'fixed-part',pinId:'a'};
 }else fixed=node('fixed',b);
 wire('lead',reverse?fixed:ref,reverse?ref:fixed);
 if(['corner','branch'].includes(attachment))wire('neighbour',fixed,node('end',horizontal?{x:b.x,y:b.y+128}:{x:b.x+128,y:b.y}));
 if(attachment==='branch')wire('continuation',fixed,node('beyond',horizontal?{x:b.x+sign*128,y:b.y}:{x:b.x,y:b.y+sign*128}));
 const model=M.create(d,()=>{},{wireSections:true}),before=model.document,canonical=A.compile(before).canonical;
 const along=motion==='perpendicular'?0:32,across=motion==='parallel'?0:32,dx=horizontal?along:across,dy=horizontal?across:along;
 model.transaction('Drag pin',next=>M.move(next,new Set([M.token('component','r')]),dx,dy));
 const after=model.document;M.validate(after);assert.equal(A.compile(after).canonical,canonical);
 const expectedCounts=motion==='parallel'?{loose:1,corner:2,branch:3,pin:1}:{loose:1,corner:2,branch:4,pin:3};
 assert.equal(after.electrical.wires.length,expectedCounts[attachment],attachment+' '+motion+' adds only needed sections');
 const lead=after.electrical.wires.find(w=>[w.from,w.to].some(r=>M.referenceKey(r)===M.referenceKey(ref))),path=M.route(after,lead);
 assert.ok(horizontal?path[0].y===path[1].y:path[0].x===path[1].x,'Wire leaves the pin along its original axis');
 if(['loose','corner'].includes(attachment))assert.deepEqual(after.layout.junctions.fixed,{x:b.x+(horizontal?0:across),y:b.y+(horizontal?across:0)},'Existing corner/loose endpoint slides');
 else assert.deepEqual(M.pin(after,fixed),b,'Branch and fixed pin remain anchored');
 if(attachment==='corner'){
  assert.deepEqual(after.layout.junctions.end,before.layout.junctions.end,'Far end of adjacent wire stays put');
  assert.ok(after.electrical.wires.every(w=>before.electrical.wires.some(old=>old.id===w.id)),'Sliding an existing corner creates no extra wires');
 }
 const normalized=structuredClone(after);M.normalizeWires(normalized);assert.deepEqual(normalized,after);
 model.undo();assert.deepEqual(model.document,before);model.redo();assert.deepEqual(model.document,after);
}
// Both selected endpoints travel together without adding connector geometry.
{
 const model=M.create(M.empty(),()=>{},{wireSections:true});const a=model.addComponent('resistor',0,0),b=model.addComponent('resistor',256,0);
 model.connect({kind:'pin',componentId:a,pinId:'b'},{kind:'pin',componentId:b,pinId:'a'});
 model.transaction('Drag group',d=>M.move(d,new Set([M.token('component',a),M.token('component',b)]),32,64));assert.equal(model.document.electrical.wires.length,1);
}
console.log('Pin drag passed: 96 rotation/direction/motion/attachment cases, sliding corners, fixed branches/pins, connectivity, group drag, idempotence and exact undo/redo.');
