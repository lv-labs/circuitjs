import assert from 'node:assert/strict';
import '../experiments/engine/editor-model.js';
const M=CircuitEditorModel,key=M.referenceKey;
function connected(d,a,b){const seen=new Set(),queue=[a];for(const ref of queue){const k=key(ref);if(k===key(b))return true;if(seen.has(k))continue;seen.add(k);for(const w of d.electrical.wires){if(key(w.from)===k)queue.push(w.to);if(key(w.to)===k)queue.push(w.from);}}return false;}
function fixture(vertical=false,endpoint=false,both=false){
 const d=M.empty();d.electrical.components.push({id:'part',kind:'resistor',reference:'R1',modelVersion:1,parameters:{resistance:1000}});d.layout.components.part={x:128,y:128,rotation:vertical?90:0,mirror:false};
 const a=endpoint?80:16,b=both?240:144;
 for(const [id,n] of [['left',a],['right',b]]){d.electrical.junctions.push({id});d.layout.junctions[id]=vertical?{x:64,y:n}:{x:n,y:64};}
 d.electrical.wires.push({id:'moving',from:{kind:'junction',junctionId:'left'},to:{kind:'junction',junctionId:'right'}});d.layout.wires.moving={bends:[]};return M.validate(d);
}
for(const vertical of [false,true])for(const endpoint of [false,true])for(const grouped of [false,true]){
 const model=M.create(fixture(vertical,endpoint),()=>{},{wireSections:true}),before=model.document,drag=M.createDragSession(before,grouped?new Set([M.token('wire','moving')]):new Set(),grouped?{}:{wireId:'moving',segment:0});
 const ref={kind:'pin',componentId:'part',pinId:'a'},p=M.pin(before,ref);
 drag.update(vertical?64:0,vertical?0:64);assert.deepEqual(model.document,before,'Preview does not create a connection');
 const result=drag.finish();M.validate(result);assert.ok(connected(result,ref,{kind:'junction',junctionId:'left'}),'Dropped wire joins pin');
 assert.equal(M.junctionDots(result).filter(j=>j.point.x===p.x&&j.point.y===p.y).length,endpoint?0:1,'Interior contact has a filled junction; endpoint contact does not');
 assert.deepEqual(result.layout.components,before.layout.components,'Component remains stationary');assert.deepEqual(drag.finish(),result,'Finalization is stable');
 const normalized=structuredClone(result);M.normalizeWires(normalized);assert.deepEqual(normalized,result);
 model.transaction('Drop segment',d=>Object.assign(d,result));model.undo();assert.deepEqual(model.document,before);model.redo();assert.deepEqual(model.document,result);
}
// A near miss and an ordinary wire crossing do not create a pin contact.
{
 const d=fixture(),drag=M.createDragSession(d,new Set(),{wireId:'moving'});drag.update(0,48);const result=drag.finish();assert.ok(!connected(result,{kind:'pin',componentId:'part',pinId:'a'},{kind:'junction',junctionId:'left'}));
}
// Crossing both pins connects both; it must not invoke component insertion and
// remove the span between the pins.
{
 const d=fixture(false,false,true),drag=M.createDragSession(d,new Set(),{wireId:'moving'});drag.update(0,64);const result=drag.finish(),a={kind:'pin',componentId:'part',pinId:'a'},b={kind:'pin',componentId:'part',pinId:'b'};
 assert.ok(connected(result,a,b));assert.equal(M.junctionDots(result).length,2);
 const spans=result.electrical.wires.map(w=>M.route(result,w));assert.ok(spans.some(p=>p.length===2&&p[0].y===128&&p[1].y===128&&Math.min(p[0].x,p[1].x)===80&&Math.max(p[0].x,p[1].x)===176),'Wire between pins remains present');
}
// The one-shot adapter uses the same drop-contact behavior.
{
 const d=fixture();M.moveSegment(d,'moving',0,0,64);M.normalizeWires(d);assert.ok(connected(d,{kind:'pin',componentId:'part',pinId:'a'},{kind:'junction',junctionId:'left'}));
}
console.log('Wire-to-pin drops passed: horizontal/vertical sections, interior junction dots, endpoint contacts, multi-wire selection, preview isolation, near misses, both-pin contacts, stable cleanup and exact undo/redo.');
