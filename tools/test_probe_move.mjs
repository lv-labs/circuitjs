import assert from 'node:assert/strict';
import core from '../packages/circuit-core/index.mjs';
const d = core.document.empty();
for (const [id,x] of [['a',0],['b',500]]) {
  d.electrical.junctions.push({id});
  d.layout.junctions[id] = {x,y:0};
}
d.electrical.wires.push({id:'w',from:{kind:'junction',junctionId:'a'},to:{kind:'junction',junctionId:'b'}});
d.layout.wires.w = {bends:[]};
d.probes.push({id:'p',kind:'voltage',positive:{kind:'junction',junctionId:'a'},reference:'ground',label:'Input'});
d.layout.probes = {p:{x:50,y:-100}};
assert.deepEqual(core.geometry.hit(d,{x:0,y:0},1),{kind:'probe',id:'p',anchor:true});
assert.equal(core.geometry.hit(d,{x:0,y:0},1,true).kind,'junction');
assert.equal(core.geometry.hit(d,{x:100,y:-100},1).kind,'probe');
const original = structuredClone(d);
core.editing.retargetProbe(d,'p',{kind:'wire',id:'w',point:{x:250,y:0}});
assert.deepEqual(core.geometry.pin(d,d.probes[0].positive),{x:250,y:0});
assert.equal(d.electrical.wires.length,2);
assert.equal(d.probes[0].id,'p');
assert.equal(d.probes[0].label,'Input');
assert.deepEqual(d.layout.probes,original.layout.probes);
core.document.validate(d);
core.editing.retargetProbe(d,'p',{kind:'junction',junctionId:'b'});
assert.deepEqual(core.geometry.pin(d,d.probes[0].positive),{x:500,y:0});
console.log('Probe hit testing and reconnection passed');
