'use strict';
// Portable computation module: no DOM, renderer, storage or worker construction.
(() => {
  const registry=globalThis.CircuitCoreModules ||= {};
  const Catalog=typeof module==='object'&&module.exports?require('./catalog.js'):registry.catalog;
  const clone=value=>structuredClone(value),{grid,definitions,placementDefinitions,outputSpecs,graphic}=Catalog;
  const snap = n => Math.round(n / grid) * grid;
  const token = (kind, id) => JSON.stringify([kind, id]);
  const referenceKey = ref => ref.kind === 'pin' ? JSON.stringify(['pin', ref.componentId, ref.pinId]) : JSON.stringify(['junction', ref.junctionId]);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function pin(document, ref) {
    if (ref.kind === 'junction') return document.layout.junctions[ref.junctionId];
    const component = document.electrical.components.find(c => c.id === ref.componentId);
    const pose = document.layout.components[component.id], offset = definitions[component.kind].pins[ref.pinId];
    const [rx, ry] = rotateOffset(offset[0] * (pose.mirror ? -1 : 1), offset[1], pose.rotation);
    return { x: pose.x + rx, y: pose.y + ry };
  }
  function rotateOffset(x, y, rotation) {
    return [[x, y], [-y, x], [-x, -y], [y, -x]][((rotation / 90) % 4 + 4) % 4];
  }
  function placementPose(kind, point, rotation = 0, mirror = false) {
    const def = definitions[kind] || placementDefinitions[kind], pins = Object.values(def.pins);
    const offset = pins.length === 1 ? rotateOffset(pins[0][0] * (mirror ? -1 : 1), pins[0][1], rotation) : [0, 0];
    return { x: snap(point.x) - offset[0], y: snap(point.y) - offset[1], rotation, mirror };
  }
  function flipPose(pose, axis) {
    pose.rotation = ((axis === 'x' ? -pose.rotation : 180 - pose.rotation) + 360) % 360;
    pose.mirror = !pose.mirror;
  }
  function probePoint(document, probe) {
    const anchor = pin(document, probe.positive), offset = document.layout.probes?.[probe.id] || { x: 16, y: -32 };
    return { x: anchor.x + offset.x, y: anchor.y + offset.y };
  }
  function probeVoltage(document, probe, frame) {
    if (!frame) return undefined;
    function voltage(ref) {
      const queue = [ref], visited = new Set();
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i], key = referenceKey(item); if (visited.has(key)) continue; visited.add(key);
        if (item.kind === 'pin') {
          const value = frame.pinVoltages[item.componentId]?.[item.pinId]; if (Number.isFinite(value)) return value;
        }
        for (const w of document.electrical.wires) if (referenceKey(w.from) === key) queue.push(w.to); else if (referenceKey(w.to) === key) queue.push(w.from);
      }
    }
    const positive = voltage(probe.positive), negative = probe.reference === 'ground' ? 0 : voltage(probe.negative);
    return Number.isFinite(positive) && Number.isFinite(negative) ? positive - negative : undefined;
  }
  function scopeChannels(document) {
    function terminal(start) {
      const queue = [start], seen = new Set(), pins = [];
      for (let i = 0; i < queue.length; i++) {
        const ref = queue[i], key = referenceKey(ref); if (seen.has(key)) continue; seen.add(key);
        if (ref.kind === 'pin') pins.push(ref);
        for (const wire of document.electrical.wires) if (referenceKey(wire.from) === key) queue.push(wire.to); else if (referenceKey(wire.to) === key) queue.push(wire.from);
      }
      pins.sort((a, b) => referenceKey(a) < referenceKey(b) ? -1 : referenceKey(a) > referenceKey(b) ? 1 : 0);
      return pins.length ? { componentId: pins[0].componentId, pinId: pins[0].pinId } : null;
    }
    const channels = [], unresolved = [];
    for (const probe of document.probes) if (probe.kind === 'voltage') {
      const positive = terminal(probe.positive), negative = probe.reference === 'ground' ? null : terminal(probe.negative);
      if (!positive || (probe.reference !== 'ground' && !negative)) { unresolved.push(probe.id); continue; }
      channels.push({ id: probe.id, label: probe.label || probe.id, positive, negative });
    }
    return { channels, unresolved };
  }
  function alignGrid(document) {
    for (const p of [...Object.values(document.layout.components), ...Object.values(document.layout.junctions)]) {
      p.x = snap(p.x); p.y = snap(p.y);
    }
    for (const route of Object.values(document.layout.wires)) for (const p of route.bends) { p.x = snap(p.x); p.y = snap(p.y); }
    return document;
  }
  function clean(points, preserveBacktracks = false) {
    const result = [];
    for (const p of points) {
      if (result.length && distance(result.at(-1), p) < 0.001) continue;
      result.push({ x: p.x, y: p.y });
      while (result.length >= 3) {
        const [a, b, c] = result.slice(-3);
        if ((!preserveBacktracks || (b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)>=0) && ((Math.abs(a.x - b.x) < .001 && Math.abs(b.x - c.x) < .001) ||
          (Math.abs(a.y - b.y) < .001 && Math.abs(b.y - c.y) < .001))) result.splice(-2, 1);
        else break;
      }
      if (result.length >= 2 && distance(result.at(-1), result.at(-2)) < .001) result.pop();
    }
    return result;
  }
  function route(document, wire, preserveBacktracks = false) {
    const anchors = [pin(document, wire.from), ...(document.layout.wires[wire.id]?.bends || []), pin(document, wire.to)];
    const result = [anchors[0]];
    for (const end of anchors.slice(1)) {
      const start = result.at(-1);
      if (Math.abs(start.x - end.x) > .001 && Math.abs(start.y - end.y) > .001) result.push({ x: end.x, y: start.y });
      result.push(end);
    }
    return clean(result, preserveBacktracks);
  }

  function closest(point, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length)) : 0;
    return { x: a.x + t * dx, y: a.y + t * dy };
  }
  function graphicSize(c){const p=c.parameters;return c.kind==='text'?{width:Math.max(32,...p.text.split('\n').map(line=>line.length*p.size*.65)),height:Math.max(p.size,p.text.split('\n').length*p.size*1.3)}:{width:p.width,height:Math.max(8,p.height)};}
  function bounds(document, component) {
    const pose = document.layout.components[component.id];
    const points = Object.keys(definitions[component.kind].pins).map(pinId => pin(document, { kind: 'pin', componentId: component.id, pinId }));
    if(graphic(component.kind)){const b=graphicSize(component);for(const [x,y] of [[-b.width/2,-b.height/2],[b.width/2,-b.height/2],[-b.width/2,b.height/2],[b.width/2,b.height/2]]){const [rx,ry]=rotateOffset(x*(pose.mirror?-1:1),y,pose.rotation);points.push({x:pose.x+rx,y:pose.y+ry});}}
    if(component.kind==='ledArray'||['decimalDisplay','instructionDisplay'].includes(component.kind)){const w=component.kind==='ledArray'?128:48,h=component.kind==='ledArray'?128:64;for(const [x,y] of [[-w,-h],[w,-h],[-w,h],[w,h]]){const [rx,ry]=rotateOffset(x,y,pose.rotation);points.push({x:pose.x+rx,y:pose.y+ry});}}
    if(!graphic(component.kind))points.push({ x: pose.x - 24, y: pose.y - 24 }, { x: pose.x + 24, y: pose.y + 24 });
    return {
      x: Math.min(...points.map(p => p.x)) - 8, y: Math.min(...points.map(p => p.y)) - 8,
      right: Math.max(...points.map(p => p.x)) + 8, bottom: Math.max(...points.map(p => p.y)) + 8
    };
  }
  function hit(document, point, scale = 1) {
    for (const probe of document.probes) if (probe.kind === 'voltage' && document.layout.probes?.[probe.id]) {
      const p = probePoint(document, probe); if (point.x >= p.x - 5 && point.x <= p.x + 130 && Math.abs(point.y - p.y) < 14 / scale) return { kind: 'probe', id: probe.id };
    }
    let best = null;
    for (const c of document.electrical.components) for (const pinId of Object.keys(definitions[c.kind].pins)) {
      const ref = { kind: 'pin', componentId: c.id, pinId }, d = distance(point, pin(document, ref));
      if (d < Math.min(10 / scale, 20) && (!best || d < best.distance)) best = { ...ref, distance: d };
    }
    for (const j of document.electrical.junctions) {
      const d = distance(point, document.layout.junctions[j.id]);
      if (d < Math.min(10 / scale, 20) && (!best || d < best.distance)) best = { kind: 'junction', junctionId: j.id, distance: d };
    }
    if (best) return best;
    for (const c of [...document.electrical.components].reverse()) {
      const pose = document.layout.components[c.id], r = -pose.rotation * Math.PI / 180;
      const dx = point.x - pose.x, dy = point.y - pose.y, x = dx * Math.cos(r) - dy * Math.sin(r), y = dx * Math.sin(r) + dy * Math.cos(r);
      if(graphic(c.kind)){const b=graphicSize(c),ux=pose.mirror?-x:x;if(c.kind==='line'){if(distance({x:ux,y},closest({x:ux,y},{x:-b.width/2,y:-c.parameters.height/2},{x:b.width/2,y:c.parameters.height/2}))<8/scale)return {kind:'component',id:c.id};}else if(c.kind==='box'){if(Math.abs(ux)<=b.width/2+8/scale&&Math.abs(y)<=b.height/2+8/scale&&Math.min(Math.abs(Math.abs(ux)-b.width/2),Math.abs(Math.abs(y)-b.height/2))<8/scale)return {kind:'component',id:c.id};}else if(Math.abs(ux)<=b.width/2+6&&Math.abs(y)<=b.height/2+6)return {kind:'component',id:c.id};continue;}
      if(outputSpecs[c.kind]&&Object.keys(definitions[c.kind].pins).length>2){const ps=Object.values(definitions[c.kind].pins);if(Math.abs(x)<Math.max(32,...ps.map(p=>Math.abs(p[0])))&&Math.abs(y)<Math.max(24,...ps.map(p=>Math.abs(p[1])))+16)return {kind:'component',id:c.id};}
      if (Math.abs(x) < (c.kind === 'ground' ? 25 : 34) && Math.abs(y) < (['dFlipFlop','jkFlipFlop','tFlipFlop','counter','latch','halfAdder','fullAdder'].includes(c.kind) ? Math.max(...Object.values(definitions[c.kind].pins).map(p=>Math.abs(p[1])))+16 : c.kind==='pushSwitch'?40:c.kind==='tappedTransformer'?64:c.kind==='customTransformer'?80:c.kind === 'dpdtSwitch' ? 56 : ['voltageSource', 'voltageRail', 'opamp', 'transformer'].includes(c.kind) ? 36 : 24)) return { kind: 'component', id: c.id };
    }
    for (const wire of [...document.electrical.wires].reverse()) {
      const points = route(document, wire);
      for (let i = 0; i < points.length - 1; i++) {
        const projected = closest(point, points[i], points[i + 1]);
        if (distance(point, projected) < 7 / scale) {
          const onGrid = closest({ x: snap(projected.x), y: snap(projected.y) }, points[i], points[i + 1]);
          return { kind: 'wire', id: wire.id, point: onGrid, segment: i };
        }
      }
    }
    return null;
  }
  function boxSelection(d, a, b) {
    const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), right: Math.max(a.x, b.x), bottom: Math.max(a.y, b.y) }, crossing = b.x < a.x, result = new Set();
    const inside = p => p.x >= r.x && p.x <= r.right && p.y >= r.y && p.y <= r.bottom;
    const rectangle = q => crossing ? q.x <= r.right && q.right >= r.x && q.y <= r.bottom && q.bottom >= r.y : inside(q) && inside({ x: q.right, y: q.bottom });
    const segment = (a, b) => {
      // Slab clipping also handles segments whose endpoints are both outside.
      let low = 0, high = 1;
      for (const [axis, min, max] of [['x', r.x, r.right], ['y', r.y, r.bottom]]) {
        const delta = b[axis] - a[axis]; if (!delta) { if (a[axis] < min || a[axis] > max) return false; continue; }
        const t1 = (min - a[axis]) / delta, t2 = (max - a[axis]) / delta; low = Math.max(low, Math.min(t1, t2)); high = Math.min(high, Math.max(t1, t2));
        if (low > high) return false;
      } return true;
    };
    for (const c of d.electrical.components) if (rectangle(bounds(d, c))) result.add(token('component', c.id));
    for (const w of d.electrical.wires) { const points = route(d, w); if (crossing ? points.some((p, i) => inside(p) || (i && segment(points[i - 1], p))) : points.every(inside)) result.add(token('wire', w.id)); }
    for (const j of d.electrical.junctions) if (inside(d.layout.junctions[j.id])) result.add(token('junction', j.id));
    for (const probe of d.probes) if (d.layout.probes?.[probe.id]) { const p = probePoint(d, probe); if (rectangle({ x: p.x - 5, y: p.y - 14, right: p.x + 130, bottom: p.y + 14 })) result.add(token('probe', probe.id)); }
    return result;
  }
  function zoom(camera, point, factor) {
    const scale = Math.max(.2, Math.min(4, camera.scale * factor));
    return { scale, x: point.x - (point.x - camera.x) * scale / camera.scale, y: point.y - (point.y - camera.y) * scale / camera.scale };
  }
  const api=Object.freeze({clone,grid,snap,token,referenceKey,same,distance,pin,rotateOffset,placementPose,flipPose,probePoint,probeVoltage,scopeChannels,alignGrid,clean,route,closest,graphicSize,bounds,hit,boxSelection,zoom});

  registry.geometry=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
