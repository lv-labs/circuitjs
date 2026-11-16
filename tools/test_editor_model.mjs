import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../experiments/engine/editor-model.js';
import '../experiments/engine/document-adapter.js';
const M=CircuitEditorModel;
const initial=JSON.parse(await readFile(new URL('../docs/new-simulator/examples/voltage-divider.json',import.meta.url)));
const calls=[],model=M.create(initial,(doc,label)=>calls.push({doc,label}));
const canonical=CircuitDocumentAdapter.compile(initial).canonical;
assert.equal(M.hit(initial,initial.layout.components.r1,.2).kind,'component','Zoomed-out pin targets must not swallow the component body');
const selected=new Set([M.token('component','r1'),M.token('component','r2')]);
model.transaction('Move group',d=>M.move(d,selected,32,-16));
assert.equal(calls.length,1);assert.equal(model.document.layout.components.r1.x,initial.layout.components.r1.x+32);
assert.equal(CircuitDocumentAdapter.compile(model.document).canonical,canonical,'Group movement does not reconnect anything');
model.undo();assert.deepEqual(model.document,initial);model.redo();assert.equal(calls.length,3);
const before=model.document;
model.transaction('Rotate',d=>d.layout.components.r1.rotation=90);
const pin=M.pin(model.document,{kind:'pin',componentId:'r1',pinId:'a'}),pose=model.document.layout.components.r1;
assert.ok(Math.abs(pin.x-pose.x)<1e-9);assert.equal(pin.y,pose.y-48);
model.undo();assert.deepEqual(model.document,before);
const camera={x:80,y:-45,scale:.7},cursor={x:344,y:270};
const changed=M.zoom(camera,cursor,1.5);
assert.ok(Math.abs((cursor.x-camera.x)/camera.scale-(cursor.x-changed.x)/changed.scale)<1e-9);
assert.ok(Math.abs((cursor.y-camera.y)/camera.scale-(cursor.y-changed.y)/changed.scale)<1e-9);
assert.equal(M.zoom(camera,cursor,100).scale,4);assert.equal(M.zoom(camera,cursor,.001).scale,.2);
const own=M.create(M.empty());
const a=own.addComponent('resistor',64,64),b=own.addComponent('resistor',256,64),g=own.addComponent('ground',128,192);
assert.notEqual(a,b);assert.equal(own.document.electrical.components[0].reference,'R1');assert.equal(own.document.electrical.components[1].reference,'R2');
const from={kind:'pin',componentId:a,pinId:'b'},to={kind:'pin',componentId:b,pinId:'a'};
own.connect(from,to);const wire=own.document.electrical.wires[0];
assert.equal(own.document.electrical.junctions.length,0);
const center={x:160,y:64};
assert.equal(M.hit(own.document,center).kind,'wire');
const graph=JSON.stringify(own.document.electrical);
own.transaction('Drag segment',d=>M.moveSegment(d,wire.id,0,0,32));
assert.equal(JSON.stringify(own.document.electrical),graph,'Rerouting preserves endpoint graph');
assert.ok(M.route(own.document,wire).some(p=>p.y===96));
const unchangedRoute=own.document;
own.transaction('Along segment',d=>M.moveSegment(d,wire.id,1,0,0));
assert.deepEqual(own.document,unchangedRoute);
own.undo();
const beforeSplit=own.document;
own.connect({kind:'wire',id:wire.id,point:center},{kind:'pin',componentId:g,pinId:'g'});
assert.equal(own.document.electrical.junctions.length,1);assert.equal(own.document.electrical.wires.length,3);
const junction=own.document.electrical.junctions[0].id;
assert.ok(own.document.electrical.wires.every(w=>w.from.junctionId===junction||w.to.junctionId===junction));
own.undo();assert.deepEqual(own.document,beforeSplit,'One undo removes branch and both split changes');
own.redo();
const afterSplit=own.document;
own.remove(new Set([M.token('component',g)]));
assert.equal(own.document.electrical.wires.length,2);assert.equal(own.document.electrical.components.length,2);
assert.ok(own.document.electrical.junctions.some(j=>j.id===junction),'Shared junction identity survives deleting branch');
own.undo();assert.deepEqual(own.document,afterSplit);
// Splitting the same original wire twice must resolve the second point on its new segment.
const twice=M.create(beforeSplit);
twice.connect({kind:'wire',id:wire.id,point:{x:128,y:64}},{kind:'wire',id:wire.id,point:{x:192,y:64}},[{x:128,y:96},{x:192,y:96}]);
assert.equal(twice.document.electrical.junctions.length,2);assert.equal(twice.document.electrical.wires.length,4);
M.validate(twice.document);
// Placement creates explicit pin-contact edges, not runtime geometry inference.
const coincident=M.create(M.empty());coincident.addComponent('resistor',0,0);coincident.addComponent('resistor',0,0);
assert.equal(coincident.document.electrical.wires.length,2);
assert.equal(M.junctionDots(coincident.document).length,0,'Two-way contacts have no junction dots');
for(const [kind,definition] of Object.entries(M.definitions))for(const rotation of [0,90,180,270]) {
 const d=M.empty(),id='test';d.electrical.components.push({id,kind,parameters:structuredClone(definition.parameters),reference:'X1',modelVersion:1});
 d.layout.components[id]=M.placementPose(kind,{x:64,y:96},rotation);
 for(const pinId of Object.keys(definition.pins)) {
  const p=M.pin(d,{kind:'pin',componentId:id,pinId});assert.equal(p.x%16,0);assert.equal(p.y%16,0);
 }
 if(kind==='ground')assert.deepEqual(M.pin(d,{kind:'pin',componentId:id,pinId:'g'}),{x:64,y:96},'Ground pin is its placement anchor');
}
const contact=M.create(M.empty()),resistor=contact.addComponent('resistor',0,0),ground=contact.addComponent('ground',48,0);
assert.deepEqual(M.pin(contact.document,{kind:'pin',componentId:ground,pinId:'g'}),M.pin(contact.document,{kind:'pin',componentId:resistor,pinId:'b'}));
assert.equal(contact.document.electrical.wires.length,1);const touching=contact.document;
assert.equal(M.route(touching,touching.electrical.wires[0]).length,1,'Contact edge is invisible until separated');
const electrical=CircuitDocumentAdapter.compile(touching).canonical;
contact.transaction('Drag ground',d=>{M.move(d,new Set([M.token('component',ground)]),0,64);M.connectContacts(d,new Set([ground]));});
assert.equal(contact.document.electrical.wires.length,1);
assert.deepEqual(M.route(contact.document,contact.document.electrical.wires[0]).map(p=>[p.x,p.y]),[[48,64],[48,0]]);
assert.equal(CircuitDocumentAdapter.compile(contact.document).canonical,electrical,'Dragging the touching ground retains its electrical net');
contact.undo();assert.deepEqual(contact.document,touching);contact.undo();assert.equal(contact.document.electrical.components.length,1);assert.equal(contact.document.electrical.wires.length,0);
// Drop onto a wire interior: split, junction and contact belong to the placement transaction.
const onWire=M.create(beforeSplit),onWireGround=onWire.addComponent('ground',160,64);
assert.equal(onWire.document.electrical.junctions.length,1);assert.equal(onWire.document.electrical.wires.length,3);
assert.equal(M.junctionDots(onWire.document).length,1,'A true three-way branch gets a filled dot');
onWire.undo();assert.deepEqual(onWire.document,beforeSplit);
// Legacy stale waypoints that go past an endpoint must not draw an out-and-back spur.
const backtrack=M.create(M.empty()),left=backtrack.addComponent('resistor',0,0),right=backtrack.addComponent('resistor',160,0);
backtrack.connect({kind:'pin',componentId:left,pinId:'b'},{kind:'pin',componentId:right,pinId:'a'},[{x:112,y:-64}]);
const edge=backtrack.document.electrical.wires[0];
assert.deepEqual(M.route(backtrack.document,edge).map(p=>[p.x,p.y]),[[48,0],[112,0]]);
backtrack.transaction('Drag resistor down',d=>M.move(d,new Set([M.token('component',right)]),0,64));
assert.deepEqual(M.route(backtrack.document,edge).map(p=>[p.x,p.y]),[[48,0],[112,0],[112,64]]);
const immutable=own.document;immutable.electrical.components=[];assert.notEqual(own.document.electrical.components.length,0);
const bad=structuredClone(initial);bad.electrical.wires[0].from.pinId='missing';
assert.throws(()=>model.replace(bad),/Invalid wire/);M.validate(model.document);
assert.throws(()=>M.validate({...M.empty(),layout:{}}),/layout maps/);
assert.throws(()=>M.validate({...M.empty(),id:''}),/version 1/);
console.log('Editor model checks passed: identity, transactions, connected moves, rotation, routes, atomic junctions, delete/undo and anchored zoom.');

// Move detaches the selection boundary while preserving stationary routes and IDs.
const movingModel=M.create(initial),one=new Set([M.token('component','r1')]);
const original=movingModel.document;
const incident=original.electrical.wires.filter(w=>[w.from,w.to].some(r=>r.componentId==='r1'));
const stationaryRoutes=new Map(incident.map(w=>[w.id,M.route(original,w)]));
movingModel.transaction('Move selection',d=>M.transformSelection(d,one,64,32,{disconnect:true,contacts:true}));
assert.equal(movingModel.document.layout.components.r1.x,original.layout.components.r1.x+64);
for(const w of incident){const after=movingModel.document.electrical.wires.find(a=>a.id===w.id);assert.deepEqual(M.route(movingModel.document,after),stationaryRoutes.get(w.id));assert.ok(![after.from,after.to].some(r=>r.componentId==='r1'));}
M.validate(movingModel.document);
const detached=movingModel.document;movingModel.undo();assert.deepEqual(movingModel.document,original);movingModel.redo();assert.deepEqual(movingModel.document,detached);
// Drag is layout-only, including the exact graph, and undoes atomically.
const dragging=M.create(initial);dragging.transaction('Drag selection',d=>M.transformSelection(d,one,64,32,{contacts:true}));
assert.deepEqual(dragging.document.electrical,initial.electrical);assert.equal(CircuitDocumentAdapter.compile(dragging.document).canonical,canonical);
dragging.undo();assert.deepEqual(dragging.document,initial);
// A coincident ground contact disappears on Move without leaving an empty stub.
const contacts=M.create(M.empty()),res=contacts.addComponent('resistor',0,0),gnd=contacts.addComponent('ground',48,0),contactBefore=contacts.document;
contacts.transaction('Move ground',d=>M.transformSelection(d,new Set([M.token('component',gnd)]),0,64,{disconnect:true,contacts:true}));
assert.equal(contacts.document.electrical.wires.length,0);assert.equal(contacts.document.electrical.junctions.length,0);
contacts.undo();assert.deepEqual(contacts.document,contactBefore);
// Moving a whole connected pair retains its internal edge, including its ID.
const pair=M.create(M.empty()),pa=pair.addComponent('resistor',0,0),pb=pair.addComponent('resistor',192,0);
pair.connect({kind:'pin',componentId:pa,pinId:'b'},{kind:'pin',componentId:pb,pinId:'a'});
const pairBefore=pair.document;
pair.transaction('Move pair',d=>M.transformSelection(d,new Set([M.token('component',pa),M.token('component',pb)]),32,64,{disconnect:true,contacts:true}));
assert.deepEqual(pair.document.electrical,pairBefore.electrical);
// Moving a selected wire alone leaves the components and a disconnected wire.
const wireMove=M.create(pairBefore),wid=pairBefore.electrical.wires[0].id;
wireMove.transaction('Move wire',d=>M.transformSelection(d,new Set([M.token('wire',wid)]),0,64,{disconnect:true}));
assert.deepEqual(wireMove.document.layout.components,pairBefore.layout.components);
assert.deepEqual(M.route(wireMove.document,wireMove.document.electrical.wires[0]),M.route(pairBefore,pairBefore.electrical.wires[0]).map(p=>({x:p.x,y:p.y+64})));
M.validate(wireMove.document);
// Preview mutations and rotation never modify the base or create history.
const draft=structuredClone(original);M.transformSelection(draft,one,32,16,{disconnect:true,rotation:270});
assert.deepEqual(original,initial);assert.equal(draft.layout.components.r1.rotation,(initial.layout.components.r1.rotation+270)%360);
console.log('Move/Drag checks passed: stationary routes, internal edges, wire moves, contact cleanup, preview isolation and atomic undo/redo.');
// A detached touching pin must not sever the remaining stationary branch.
const branch=M.create(M.empty()),br=branch.addComponent('resistor',0,0),bg=branch.addComponent('ground',48,0),bc=branch.addComponent('capacitor',192,0);
branch.connect({kind:'pin',componentId:bg,pinId:'g'},{kind:'pin',componentId:bc,pinId:'a'});
branch.transaction('Move branch ground',d=>M.transformSelection(d,new Set([M.token('component',bg)]),0,64,{disconnect:true}));
assert.equal(branch.document.electrical.wires.length,1);
assert.ok(branch.document.electrical.wires.some(w=>[w.from,w.to].some(r=>r.componentId===br)&&[w.from,w.to].some(r=>r.componentId===bc)),'Remaining wire stays attached to stationary resistor');
M.validate(branch.document);
// Contacts at the destination join within the same undo step.
const drop=M.create(M.empty()),dr=drop.addComponent('resistor',0,0),dg=drop.addComponent('ground',192,64),dropBefore=drop.document;
drop.transaction('Move onto pin',d=>M.transformSelection(d,new Set([M.token('component',dg)]),-144,-64,{disconnect:true,contacts:true}));
assert.equal(drop.document.electrical.wires.length,1);drop.undo();assert.deepEqual(drop.document,dropBefore);

function inlineFixture(rotation=0) {
 const m=M.create(M.empty()),a=m.addComponent('resistor',0,0,rotation),b=m.addComponent('resistor',384,384,rotation);
 // Use free junction ends to cover rotations without geometry-dependent fixtures.
 m.transaction('Wire span',d=>{
  d.electrical.junctions.push({id:'start'},{id:'end'});
  const vertical=rotation%180!==0;
  d.layout.junctions.start=vertical?{x:160,y:0}:{x:0,y:160};d.layout.junctions.end=vertical?{x:160,y:320}:{x:320,y:160};
  d.electrical.wires.push({id:'span',from:{kind:'junction',junctionId:'start'},to:{kind:'junction',junctionId:'end'}});d.layout.wires.span={bends:[]};
 });return m;
}
for(const rotation of [0,90,180,270])for(const kind of ['resistor','capacitor','switch','voltageSource']) {
 const effective=kind==='voltageSource'?(rotation+90)%360:rotation,m=inlineFixture(effective),before=m.document;
 const id=m.addComponent(kind,160,160,rotation),after=m.document;
 assert.equal(after.electrical.wires.length,2,`${kind}/${rotation}: bypass removed`);
 const pins=Object.keys(M.definitions[kind].pins);
 assert.ok(!after.electrical.wires.some(w=>w.from.junctionId==='start'&&w.to.junctionId==='end'));
 for(const p of pins)assert.equal(after.electrical.wires.filter(w=>[w.from,w.to].some(ref=>ref.componentId===id&&ref.pinId===p)).length,1);
 assert.equal(after.electrical.junctions.length,2,'No redundant cut junctions');M.validate(after);
 m.undo();assert.deepEqual(m.document,before);m.redo();assert.deepEqual(m.document,after);
}
// A multi-wire span with a two-way junction is cut and its unused middle removed.
const chain=inlineFixture(),chainBefore=chain.document;
chain.transaction('Subdivide',d=>{
 const w=d.electrical.wires[0];w.to={kind:'junction',junctionId:'mid'};
 d.electrical.junctions.push({id:'mid'});d.layout.junctions.mid={x:160,y:160};
 d.electrical.wires.push({id:'tail',from:{kind:'junction',junctionId:'mid'},to:{kind:'junction',junctionId:'end'}});d.layout.wires.tail={bends:[]};
});
const subdivided=chain.document;chain.addComponent('resistor',160,160);
assert.ok(!chain.document.electrical.junctions.some(j=>j.id==='mid'));assert.equal(chain.document.electrical.wires.length,2);chain.undo();assert.deepEqual(chain.document,subdivided);
// A branch within the cut span is rejected atomically, including history.
const guarded=M.create(subdivided),gid=guarded.addComponent('ground',160,256);
guarded.connect({kind:'junction',junctionId:'mid'},{kind:'pin',componentId:gid,pinId:'g'});
const guardedBefore=guarded.document;assert.throws(()=>guarded.addComponent('capacitor',160,160),/branch/);assert.deepEqual(guarded.document,guardedBefore);
guarded.undo();assert.equal(guarded.document.electrical.wires.length,2,'Failed insertion adds no undo item');
const probed=M.create(subdivided);probed.transaction('Probe',d=>d.probes.push({id:'middle-probe',kind:'voltage',positive:{kind:'junction',junctionId:'mid'},negative:{kind:'junction',junctionId:'start'}}));
assert.throws(()=>probed.addComponent('resistor',160,160),/probe/);
// An unconnected crossing is left untouched.
const crossing=inlineFixture();crossing.transaction('Crossing',d=>{
 d.electrical.junctions.push({id:'north'},{id:'south'});d.layout.junctions.north={x:160,y:64};d.layout.junctions.south={x:160,y:256};
 d.electrical.wires.push({id:'cross',from:{kind:'junction',junctionId:'north'},to:{kind:'junction',junctionId:'south'}});d.layout.wires.cross={bends:[]};
});const crossBefore=crossing.document.electrical.wires.find(w=>w.id==='cross');crossing.addComponent('resistor',160,160);
assert.deepEqual(crossing.document.electrical.wires.find(w=>w.id==='cross'),crossBefore);
// Off-axis, undersized and one-pin contacts do not trigger insertion.
const off=inlineFixture();off.addComponent('capacitor',160,176);assert.equal(off.document.electrical.wires.length,1);
const short=inlineFixture();short.transaction('Shorten',d=>{d.layout.junctions.start.x=144;d.layout.junctions.end.x=176;});short.addComponent('resistor',160,160);assert.equal(short.document.electrical.wires.length,1);
// Move into a span performs the cut atomically, preserving undo of the original placement.
const movingInline=inlineFixture(),movingId=movingInline.addComponent('resistor',160,256),movingBefore=movingInline.document;
movingInline.transaction('Move into wire',d=>M.transformSelection(d,new Set([M.token('component',movingId)]),0,-96,{disconnect:true,contacts:true}));
assert.equal(movingInline.document.electrical.wires.length,2);movingInline.undo();assert.deepEqual(movingInline.document,movingBefore);
console.log('Inline checks passed: all two-pin models/rotations, multi-wire cleanup, protected branches/probes, crossings, Move and undo/redo.');
// Duplicate spans cannot leave a hidden parallel bypass after insertion.
const overlap=inlineFixture();overlap.transaction('Duplicate span',d=>{d.electrical.wires.push({...structuredClone(d.electrical.wires[0]),id:'parallel'});d.layout.wires.parallel={bends:[]};});
const overlapBefore=overlap.document;assert.throws(()=>overlap.addComponent('resistor',160,160),/ambiguous/);assert.deepEqual(overlap.document,overlapBefore);
// A branch at the cut boundary is retained, rather than treated as an interior branch.
const boundary=inlineFixture();boundary.transaction('Boundary branch',d=>{
 d.electrical.junctions.push({id:'cut'},{id:'branch-end'});d.layout.junctions.cut={x:112,y:160};d.layout.junctions['branch-end']={x:112,y:256};
 d.electrical.wires[0].to={kind:'junction',junctionId:'cut'};
 d.electrical.wires.push({id:'rest',from:{kind:'junction',junctionId:'cut'},to:{kind:'junction',junctionId:'end'}},{id:'branch-wire',from:{kind:'junction',junctionId:'cut'},to:{kind:'junction',junctionId:'branch-end'}});
 d.layout.wires.rest={bends:[]};d.layout.wires['branch-wire']={bends:[]};
});const branchWire=boundary.document.electrical.wires.find(w=>w.id==='branch-wire');boundary.addComponent('resistor',160,160);
assert.deepEqual(boundary.document.electrical.wires.find(w=>w.id==='branch-wire'),branchWire);M.validate(boundary.document);

// Flips reflect pin geometry in world axes for every rotation/mirror state.
for(const rotation of [0,90,180,270])for(const mirror of [false,true])for(const axis of ['x','y']){
 const m=M.create(M.empty()),id=m.addComponent('opamp',160,160,rotation,mirror),before=m.document;
 const oldPins=Object.keys(M.definitions.opamp.pins).map(pinId=>({pinId,point:M.pin(before,{kind:'pin',componentId:id,pinId})}));
 m.transaction('Flip',d=>M.transformSelection(d,new Set([M.token('component',id)]),0,0,{orientations:[{axis}]}));
 for(const {pinId,point} of oldPins){const p=M.pin(m.document,{kind:'pin',componentId:id,pinId});assert.equal(p.x,axis==='x'?320-point.x:point.x);assert.equal(p.y,axis==='y'?320-point.y:point.y);}
 m.undo();assert.deepEqual(m.document,before);
}
const probeModel=M.create(initial),probeBefore=probeModel.document,probeCanonical=CircuitDocumentAdapter.compile(probeBefore).canonical;
const probeWire=probeBefore.electrical.wires.find(w=>w.id==='w2'),probeRoute=M.route(probeBefore,probeWire),probeAnchor={x:240,y:80};
const probeId=probeModel.addProbe({kind:'wire',id:probeWire.id,point:probeAnchor});
const probeAfter=probeModel.document,marker=probeAfter.probes.find(p=>p.id===probeId);
assert.equal(CircuitDocumentAdapter.compile(probeAfter).canonical,probeCanonical,'Probe is non-loading and graph subdivision preserves projection');
assert.equal(M.probeVoltage(probeAfter,marker,{pinVoltages:{r1:{b:2.5}}}),2.5);
assert.equal(M.probeVoltage(probeAfter,marker,null),undefined);
const movedProbe=M.probePoint(probeAfter,marker);probeModel.transaction('Move probe label',d=>M.move(d,new Set([M.token('probe',probeId)]),32,16));
assert.deepEqual(M.probePoint(probeModel.document,marker),{x:movedProbe.x+32,y:movedProbe.y+16});
assert.deepEqual(probeModel.document.electrical,probeAfter.electrical);
probeModel.undo();probeModel.undo();assert.deepEqual(probeModel.document,probeBefore);probeModel.redo();assert.deepEqual(probeModel.document,probeAfter);
probeModel.remove(new Set([M.token('probe',probeId)]));assert.ok(!probeModel.document.probes.some(p=>p.id===probeId));M.validate(probeModel.document);probeModel.undo();assert.deepEqual(probeModel.document,probeAfter);
assert.throws(()=>M.validate({...probeAfter,layout:{...probeAfter.layout,probes:{unknown:{x:0,y:0}}}}),/probe layout/);
console.log('Op-amp/flip/probe model checks passed: reflected pin identities, non-loading markers, readings, label movement, removal and exact undo.');

const sinePlacement=M.create(M.empty()),sineId=sinePlacement.addComponent('sineSource',96,96,90,true),sineDoc=sinePlacement.document;
assert.equal(sineDoc.electrical.components[0].kind,'voltageSource');assert.deepEqual(sineDoc.electrical.components[0].parameters.waveform,{kind:'sine',amplitude:1,frequency:1000,offset:0});
assert.deepEqual(M.create(JSON.parse(JSON.stringify(sineDoc))).document,sineDoc,'Sine document save/reopen');sinePlacement.undo();assert.equal(sinePlacement.document.electrical.components.length,0);
const loose=M.create(initial),looseBefore=loose.document,looseWire=looseBefore.electrical.wires.find(w=>w.id==='w2');
loose.connect({kind:'wire',id:looseWire.id,point:{x:240,y:80}},{kind:'point',point:{x:243,y:163}},[{x:240,y:112}]);
const looseAfter=loose.document,looseEnd=looseAfter.electrical.wires.at(-1).to;
assert.equal(looseAfter.electrical.junctions.length,looseBefore.electrical.junctions.length+2,'Wire split and loose junction are explicit');
assert.deepEqual(M.pin(looseAfter,looseEnd),{x:240,y:160},'Loose end snaps to grid');
assert.equal(CircuitDocumentAdapter.compile(looseAfter).canonical,CircuitDocumentAdapter.compile(looseBefore).canonical,'Attached loose wire does not change solver identity');
M.validate(looseAfter);assert.deepEqual(M.create(JSON.parse(JSON.stringify(looseAfter))).document,looseAfter);
loose.undo();assert.deepEqual(loose.document,looseBefore);loose.redo();assert.deepEqual(loose.document,looseAfter);
loose.connect(looseEnd,{kind:'pin',componentId:'r1',pinId:'a'});assert.notEqual(CircuitDocumentAdapter.compile(loose.document).canonical,CircuitDocumentAdapter.compile(looseAfter).canonical,'Loose junction can start a reconnection');
loose.undo();assert.deepEqual(loose.document,looseAfter);
const noStub=M.create(initial),noStubBefore=noStub.document,startPin={kind:'pin',componentId:'r1',pinId:'a'},startPoint=M.pin(noStubBefore,startPin);
assert.equal(noStub.connect(startPin,{kind:'point',point:startPoint}),false);assert.deepEqual(noStub.document,noStubBefore);assert.equal(noStub.canUndo,false,'Zero-length stub is a no-op');
assert.throws(()=>noStub.connect(startPin,{kind:'point',point:{x:NaN,y:0}}),/finite/);assert.deepEqual(noStub.document,noStubBefore);
console.log('Sine/loose-wire model checks passed: preset, save/reopen, atomic split/endpoint, snapping, reconnection, no-op/invalid ends and undo.');

for(const preset of ['voltageSource','acSource','voltageRail','acRail'])for(const rotation of [0,90,180,270])for(const mirror of [false,true]){
 const m=M.create(M.empty()),id=m.addComponent(preset,160,160,rotation,mirror),d=m.document,c=d.electrical.components[0];
 assert.equal(c.kind,preset.toLowerCase().includes('rail')?'voltageRail':'voltageSource');
 assert.equal(c.parameters.waveform.kind,preset.startsWith('ac')?'sine':'dc');
 if(c.kind==='voltageRail')assert.deepEqual(M.pin(d,{kind:'pin',componentId:id,pinId:'p'}),{x:160,y:160},'Rail placement is anchored at its single pin');
 assert.deepEqual(M.create(JSON.parse(JSON.stringify(d))).document,d);m.undo();assert.equal(m.document.electrical.components.length,0);
}
for(const kind of Object.keys(M.waveformNames)){
 const w=kind==='dc'?{kind,voltage:5}:{kind,amplitude:1,frequency:1000,offset:-.2,...(['square','pulse'].includes(kind)?{dutyCycle:.3}:{})};
 assert.equal(M.validWaveform(w),true);
}
const railContact=M.create(M.empty()),rr=railContact.addComponent('resistor',160,160),rv=railContact.addComponent('acRail',112,160),railContactBefore=railContact.document;
assert.equal(railContactBefore.electrical.wires.length,1,'Rail contact is explicit');
railContact.transaction('Drag rail',d=>M.transformSelection(d,new Set([M.token('component',rv)]),0,-64));
assert.deepEqual(railContact.document.electrical,railContactBefore.electrical);railContact.undo();assert.deepEqual(railContact.document,railContactBefore);
console.log('AC/rail editor checks passed: all four presets, pin-anchored rotation/mirroring, waveform validation, contact dragging and undo.');

// Endpoint pickup keeps graph IDs, branches and probe references through one history entry.
{
  const editor=M.create(M.empty()),a=editor.addComponent('resistor',0,0),b=editor.addComponent('resistor',320,0);
  editor.connect({kind:'pin',componentId:a,pinId:'b'},{kind:'point',point:{x:128,y:0}},[{x:96,y:0}]);
  const start=editor.document,wireId=start.electrical.wires[0].id,loose=start.electrical.wires[0].to.junctionId;
  const probeId=editor.addProbe({kind:'junction',junctionId:loose});
  const before=editor.document,target={kind:'pin',componentId:b,pinId:'a'};
  assert.equal(M.reconnectTarget(before,loose,{x:128,y:0}),null,'Own wire cannot be a snap target');
  assert.equal(M.reconnectTarget(before,loose,M.pin(before,target)).componentId,b);
  editor.transaction('Reconnect',d=>M.reconnect(d,loose,target));
  const after=editor.document;
  assert.equal(after.electrical.wires[0].id,wireId);
  assert.deepEqual(after.electrical.wires[0].to,target);
  assert.deepEqual(after.probes.find(p=>p.id===probeId).positive,target);
  assert.equal(after.electrical.junctions.length,0);
  assert.deepEqual(after.layout.wires[wireId].bends,[]);
  editor.undo();assert.deepEqual(editor.document,before);editor.redo();assert.deepEqual(editor.document,after);
  editor.undo();
  editor.connect({kind:'pin',componentId:b,pinId:'a'},{kind:'point',point:{x:272,y:128}});
  const destWire=editor.document.electrical.wires.at(-1),destId=destWire.to.junctionId;
  editor.transaction('Join loose ends',d=>M.reconnect(d,loose,{kind:'junction',junctionId:destId}));
  assert.equal(editor.document.electrical.wires.length,2,'Preserve both wire IDs');
  assert.equal(editor.document.electrical.junctions.length,1,'Remove redundant source junction');
  assert.equal(M.looseEndpoint(editor.document,destId),false);
  editor.undo();
  editor.transaction('Join wire interior',d=>M.reconnect(d,loose,{kind:'wire',id:destWire.id,point:{x:272,y:64}}));
  assert.equal(editor.document.electrical.wires.length,3,'Wire-interior drop splits exactly once');
  assert.equal(M.junctionDots(editor.document).some(dot=>dot.degree===3),true);
  M.validate(editor.document);
}
console.log('Wire-end checks passed: snap exclusion, pin/loose/interior joins, IDs, probes, cleanup and exact undo/redo.');
