'use strict';
// Portable computation module: no DOM, renderer, storage or worker construction.
(() => {
  const registry=globalThis.CircuitCoreModules ||= {};
  const Catalog=typeof module==='object'&&module.exports?require('./catalog.js'):registry.catalog;
  const Geometry=typeof module==='object'&&module.exports?require('./geometry.js'):registry.geometry;
  const Document=typeof module==='object'&&module.exports?require('./document.js'):registry.document;
  const History=typeof module==='object'&&module.exports?require('./history.js'):registry.history;
  const Drag=typeof module==='object'&&module.exports?require('./drag.js'):registry.drag;
  const {definitions,placementDefinitions,outputSpecs,graphic,waveformNames,validWaveform}=Catalog;
  const {validate,empty}=Document;
  const {clone,grid,snap,token,referenceKey,same,distance,pin,placementPose,flipPose,probePoint,probeVoltage,scopeChannels,alignGrid,clean,route,closest,graphicSize,bounds,hit,boxSelection,zoom}=Geometry;
  function copySelection(d, selection) {
    const fragment = empty(), e = fragment.electrical, l = fragment.layout;
    const selected = ref => selection.has(token(ref.kind === 'pin' ? 'component' : 'junction', ref.componentId || ref.junctionId));
    for (const c of d.electrical.components) if (selection.has(token('component', c.id))) { e.components.push(clone(c)); l.components[c.id] = clone(d.layout.components[c.id]); }
    for (const j of d.electrical.junctions) if (selection.has(token('junction', j.id))) { e.junctions.push(clone(j)); l.junctions[j.id] = clone(d.layout.junctions[j.id]); }
    const stubs = new Map();
    function endpoint(ref) {
      if (selected(ref)) return clone(ref);
      const key = referenceKey(ref);
      if (!stubs.has(key)) { const id = crypto.randomUUID(); e.junctions.push({ id }); l.junctions[id] = clone(pin(d, ref)); stubs.set(key, { kind: 'junction', junctionId: id }); }
      return clone(stubs.get(key));
    }
    for (const w of d.electrical.wires) if (selection.has(token('wire', w.id)) || (selected(w.from) && selected(w.to))) {
      e.wires.push({ ...clone(w), from: endpoint(w.from), to: endpoint(w.to) }); l.wires[w.id] = clone(d.layout.wires[w.id]);
    }
    const included = ref => selected(ref) || stubs.has(referenceKey(ref));
    for (const probe of d.probes) {
      const valid = probe.kind === 'current' ? e.components.some(c => c.id === probe.componentId) : included(probe.positive) && (probe.reference === 'ground' || included(probe.negative));
      if (!valid) continue;
      const p = clone(probe); if (p.kind === 'voltage') { p.positive = endpoint(p.positive); if (p.reference !== 'ground') p.negative = endpoint(p.negative); }
      fragment.probes.push(p); if (d.layout.probes?.[p.id]) { l.probes ||= {}; l.probes[p.id] = clone(d.layout.probes[p.id]); }
    }
    return validate(fragment);
  }
  function pasteSelection(d, fragment, {componentReferences=true}={}) {
    validate(fragment);
    const selection = new Set(), maps = { component: new Map(), junction: new Map(), wire: new Map(), probe: new Map() };
    const groups = [['component', 'components'], ['junction', 'junctions'], ['wire', 'wires'], ['probe', 'probes']];
    for (const [kind, list] of groups) for (const item of kind === 'probe' ? fragment.probes : fragment.electrical[list]) maps[kind].set(item.id, crypto.randomUUID());
    const ref = r => r.kind === 'pin' ? { ...clone(r), componentId: maps.component.get(r.componentId) } : { ...clone(r), junctionId: maps.junction.get(r.junctionId) };
    const references = componentReferences ? new Set(d.electrical.components.map(c => c.reference)) : null;
    for (const [kind, list] of groups) for (const original of kind === 'probe' ? fragment.probes : fragment.electrical[list]) {
      const item = clone(original); item.id = maps[kind].get(original.id); selection.add(token(kind, item.id));
      if (kind === 'component') {
        if (references) {
          const prefix = definitions[item.kind].prefix; let number = 1; while (references.has(prefix + number)) number++; item.reference = prefix + number; references.add(item.reference);
        } else delete item.reference;
      } else if (kind === 'wire') { item.from = ref(item.from); item.to = ref(item.to); }
      else if (kind === 'probe') { if (item.kind === 'current') item.componentId = maps.component.get(item.componentId); else { item.positive = ref(item.positive); if (item.reference !== 'ground') item.negative = ref(item.negative); } }
      if (kind === 'probe') d.probes.push(item); else d.electrical[list].push(item);
      if (fragment.layout[list]?.[original.id]) { d.layout[list] ||= {}; d.layout[list][item.id] = clone(fragment.layout[list][original.id]); }
    }
    return selection;
  }
  function applyDragDocument(document,next){
    // Reconnect/reshape callers can retain references to existing wire objects.
    // Preserve those identities when materializing a session back into a draft.
    for(const list of ['components','junctions','wires']){
      const old=new Map(document.electrical[list].map(item=>[item.id,item]));
      next.electrical[list]=next.electrical[list].map(item=>old.has(item.id)?Object.assign(old.get(item.id),item):item);
    }
    Object.assign(document,next);
  }
  function move(document, selection, dx, dy) {
    if(!dx&&!dy)return;
    const drag=createDragSession(document,selection);drag.update(dx,dy);
    applyDragDocument(document,drag.finish({normalize:false}));
  }
  // Split only the selection boundary. Stationary wires keep their old geometry;
  // selected wires keep travelling with the selection. Shared ends share one stub.
  function detach(document, selection) {
    const moving = new Set(selection), stubs = new Map();
    const selected = ref => moving.has(token(ref.kind === 'pin' ? 'component' : 'junction', ref.componentId || ref.junctionId));
    const wires = document.electrical.wires;
    const contacts = new Set(wires.filter(w => selected(w.from) !== selected(w.to) && route(document, w).length === 1).map(w => w.id));
    for (const wire of wires) {
      const travels = selection.has(token('wire', wire.id)) || (selected(wire.from) && selected(wire.to));
      for (const end of ['from', 'to']) if (selected(wire[end]) !== travels) {
        const original = wire[end], key = referenceKey(original) + ':' + travels;
        if (!stubs.has(key)) {
          const id = crypto.randomUUID(); document.electrical.junctions.push({ id });
          document.layout.junctions[id] = clone(pin(document, original));
          stubs.set(key, { kind: 'junction', junctionId: id });
          if (travels) moving.add(token('junction', id));
        }
        wire[end] = clone(stubs.get(key));
      }
    }
    // Collapse a zero-length boundary contact onto its stationary/travelling
    // neighbour, retaining any other branches that used the detached pin.
    const stubIds = new Set([...stubs.values()].map(ref => ref.junctionId)), removedContacts = new Set();
    for (const contact of wires.filter(w => contacts.has(w.id))) {
      if (!stubIds.has(contact.from.junctionId) && !stubIds.has(contact.to.junctionId)) continue;
      const stub = stubIds.has(contact.from.junctionId) ? contact.from : contact.to;
      removedContacts.add(contact.id);
      const other = stub === contact.from ? contact.to : contact.from;
      for (const wire of wires) if (wire !== contact) for (const end of ['from', 'to'])
        if (referenceKey(wire[end]) === referenceKey(stub)) wire[end] = clone(other);
      delete document.layout.wires[contact.id];
    }
    document.electrical.wires = wires.filter(w => !removedContacts.has(w.id));
    for (const ref of stubs.values()) if (!document.electrical.wires.some(w => referenceKey(w.from) === referenceKey(ref) || referenceKey(w.to) === referenceKey(ref))) {
      document.electrical.junctions = document.electrical.junctions.filter(j => j.id !== ref.junctionId);
      delete document.layout.junctions[ref.junctionId]; moving.delete(token('junction', ref.junctionId));
    }
    return moving;
  }
  // Rotation and flipping are pick-up/put-down operations: wires remain at
  // their old coordinates, including wires between selected components.
  function detachComponentPins(document, componentIds) {
    const stubs=new Map();
    for(const w of document.electrical.wires)for(const side of ['from','to']){
      const ref=w[side];if(ref.kind!=='pin'||!componentIds.has(ref.componentId))continue;
      const key=referenceKey(ref);
      if(!stubs.has(key)){
        const id=crypto.randomUUID();document.electrical.junctions.push({id});document.layout.junctions[id]=clone(pin(document,ref));
        stubs.set(key,{kind:'junction',junctionId:id});
      }
      w[side]=clone(stubs.get(key));
    }
  }
  function transformSelection(document, selection, dx, dy, { disconnect = false, rotation = 0, orientations = [], contacts = false } = {}) {
    const reorienting=rotation!==0||orientations.length>0;
    const componentIds=new Set(document.electrical.components.filter(c=>selection.has(token('component',c.id))).map(c=>c.id));
    if(reorienting)detachComponentPins(document,componentIds);
    const moving = reorienting ? new Set([...selection].filter(item=>!['wire','junction'].includes(JSON.parse(item)[0]))) : disconnect ? detach(document, selection) : selection;
    move(document, moving, dx, dy);
    const ids = new Set(document.electrical.components.filter(c => selection.has(token('component', c.id))).map(c => c.id));
    if (rotation || orientations.length) reshape(document, ids, () => {
      for (const id of ids) {
        const pose = document.layout.components[id]; pose.rotation = (pose.rotation + rotation + 360) % 360;
        for (const operation of orientations) if (operation.axis) flipPose(pose, operation.axis); else pose.rotation = (pose.rotation + operation.rotate + 360) % 360;
      }
    }, false);
    if (contacts || reorienting) connectContacts(document, ids);
  }
  function retarget(document, wire, old) {
    if (old.length <= 2) { document.layout.wires[wire.id].bends = []; return; }
    const start = pin(document, wire.from), end = pin(document, wire.to), points = clone(old), n = points.length;
    const firstHorizontal = Math.abs(old[0].y - old[1].y) < .001;
    const lastHorizontal = Math.abs(old[n - 1].y - old[n - 2].y) < .001;
    if (distance(start, old[0]) > .001) { if (firstHorizontal) points[1].y = start.y; else points[1].x = start.x; }
    if (distance(end, old[n - 1]) > .001) { if (lastHorizontal) points[n - 2].y = end.y; else points[n - 2].x = end.x; }
    points[0] = start; points[n - 1] = end;
    document.layout.wires[wire.id].bends = clean(points).slice(1, -1);
  }
  function reshape(document, componentIds, change, contacts = true) {
    const routes = new Map(document.electrical.wires.map(w => [w.id, route(document, w)]));
    change();
    for (const wire of document.electrical.wires) {
      const old = routes.get(wire.id);
      if (distance(pin(document, wire.from), old[0]) > .001 || distance(pin(document, wire.to), old.at(-1)) > .001) retarget(document, wire, old);
    }
    if (contacts) connectContacts(document, componentIds);
  }

  function moveSegment(document, wireId, segment, dx, dy) {
    if(!dx&&!dy)return;
    const drag=createDragSession(document,new Set(),{wireId,segment});drag.update(dx,dy);
    applyDragDocument(document,drag.finish({normalize:false}));
  }
  function connectionResolver(d) {
    const families = new Map();
    function resolve(target) {
      if (target.kind === 'pin') return { kind: 'pin', componentId: target.componentId, pinId: target.pinId };
      if (target.kind === 'junction') return { kind: 'junction', junctionId: target.junctionId };
      if (target.kind === 'point') {
        if (!target.point || !Number.isFinite(target.point.x) || !Number.isFinite(target.point.y)) throw new Error('Expected a finite wire endpoint');
        const junctionId = crypto.randomUUID(); d.electrical.junctions.push({ id: junctionId });
        d.layout.junctions[junctionId] = { x: snap(target.point.x), y: snap(target.point.y) }; return { kind: 'junction', junctionId };
      }
      if (target.kind !== 'wire') throw new Error('Connect to a pin, junction or wire');
      if (!families.has(target.id)) families.set(target.id, [target.id]);
      const family = families.get(target.id);
      let wire, points, index;
      for (const wireId of family) {
        wire = d.electrical.wires.find(w => w.id === wireId); points = route(d, wire);
        index = points.findIndex((p, i) => i < points.length - 1 && distance(closest(target.point, p, points[i + 1]), target.point) < .01);
        if (index >= 0) break;
      }
      if (index < 0) throw new Error('Wire changed while connecting');
      if (distance(points[0], target.point) < .01) return clone(wire.from);
      if (distance(points.at(-1), target.point) < .01) return clone(wire.to);
      const junctionId = crypto.randomUUID(), wireId = crypto.randomUUID(), end = clone(wire.to);
      const ref = { kind: 'junction', junctionId }; d.electrical.junctions.push({ id: junctionId }); d.layout.junctions[junctionId] = clone(target.point);
      wire.to = ref; d.layout.wires[wire.id].bends = clean([...points.slice(0, index + 1), target.point]).slice(1, -1);
      d.electrical.wires.push({ id: wireId, from: ref, to: end });
      d.layout.wires[wireId] = { bends: clean([target.point, ...points.slice(index + 1)]).slice(1, -1) }; family.push(wireId); return ref;
    }
    return resolve;
  }
  function looseEndpoint(d, id) {
    return d.electrical.wires.filter(w => w.from.junctionId === id || w.to.junctionId === id).length === 1;
  }
  function reconnectTarget(d, id, point, scale = 1) {
    const copy = clone(d);
    copy.electrical.junctions = copy.electrical.junctions.filter(j => j.id !== id);
    copy.electrical.wires = copy.electrical.wires.filter(w => w.from.junctionId !== id && w.to.junctionId !== id);
    copy.probes = [];
    const found = hit(copy, point, scale);
    return found && ['pin', 'junction', 'wire'].includes(found.kind) ? found : null;
  }
  function reconnect(d, id, target) {
    if (!looseEndpoint(d, id)) throw new Error('Only loose wire ends can be reconnected');
    const wire = d.electrical.wires.find(w => w.from.junctionId === id || w.to.junctionId === id);
    if (target.kind === 'wire' && target.id === wire.id) throw new Error('Cannot reconnect a wire to itself');
    const ref = connectionResolver(d)(target);
    if (ref.junctionId === id) return;
    const other = wire.from.junctionId === id ? wire.to : wire.from;
    if (referenceKey(other) === referenceKey(ref)) throw new Error('Cannot join a wire to its own opposite endpoint');
    const point = pin(d, ref), origin = d.layout.junctions[id];
    move(d, new Set([token('junction', id)]), point.x - origin.x, point.y - origin.y);
    if (wire.from.junctionId === id) wire.from = clone(ref); else wire.to = clone(ref);
    for (const probe of d.probes) for (const key of ['positive', 'negative']) if (probe[key]?.junctionId === id) probe[key] = clone(ref);
    d.electrical.junctions = d.electrical.junctions.filter(j => j.id !== id); delete d.layout.junctions[id];
    d.layout.wires[wire.id].bends = route(d, wire).slice(1, -1);
    // Keep existing wire IDs and target junctions: probes and branches may name them.
  }
  function replaceParameters(document,componentId,parameters) {
    const c=document.electrical.components.find(c=>c.id===componentId);
    if(!c)throw new Error('Unknown component');
    const previousPins=Catalog.componentPins(c),nextPins=Catalog.componentPins({...c,parameters});
    if((Catalog.transistorKind(c.kind)||Catalog.mosfetKind(c.kind))&&!!c.parameters.swapTerminals!==!!parameters.swapTerminals){
      const pair=Catalog.transistorKind(c.kind)?['collector','emitter']:['source','drain'];
      const swap=ref=>{if(ref?.kind==='pin'&&ref.componentId===componentId&&pair.includes(ref.pinId))ref.pinId=pair[1-pair.indexOf(ref.pinId)];};
      for(const w of document.electrical.wires){swap(w.from);swap(w.to);}
      for(const p of document.probes){swap(p.positive);swap(p.negative);}
    }
    const refers=ref=>ref?.kind==='pin'&&ref.componentId===componentId;
    for(const pinId of Object.keys(previousPins).filter(k=>!Object.hasOwn(nextPins,k))){
      const refs=[];
      for(const w of document.electrical.wires)for(const key of ['from','to'])if(refers(w[key])&&w[key].pinId===pinId)refs.push([w,key]);
      for(const p of document.probes)for(const key of ['positive','negative'])if(refers(p[key])&&p[key].pinId===pinId)refs.push([p,key]);
      if(!refs.length)continue;
      const id=crypto.randomUUID();document.electrical.junctions.push({id});
      document.layout.junctions[id]=clone(pin(document,{kind:'pin',componentId,pinId}));
      for(const [item,key] of refs)item[key]={kind:'junction',junctionId:id};
    }
    const m=parameters.model;
    if(m&&typeof m==='object'){
      const family=Catalog.diodeKind(c.kind)?Catalog.diodeKind:Catalog.transistorKind(c.kind)?Catalog.transistorKind:null;
      if(family)for(const other of document.electrical.components)
        if(family(other.kind)&&other.parameters.model?.name===m.name)other.parameters.model=clone(m);
    }
    c.parameters=clone(parameters);
  }
  function insertInline(document, componentId) {
    const component = document.electrical.components.find(c => c.id === componentId);
    const pins = Object.keys(Catalog.componentPins(component));
    if (pins.length !== 2) return false;
    const refs = pins.map(pinId => ({ kind: 'pin', componentId, pinId })), points = refs.map(ref => pin(document, ref));
    const horizontal = points[0].y === points[1].y, axis = horizontal ? 'x' : 'y', cross = horizontal ? 'y' : 'x';
    const low = Math.min(...points.map(p => p[axis])), high = Math.max(...points.map(p => p[axis]));
    const onLine = p => Math.abs(p[cross] - points[0][cross]) < .001;
    // A symbol already wired to this span is being stretched, not inserted.
    const targets = points.map(point => {
      const found = new Map();
      for (const wire of document.electrical.wires) {
        if ([wire.from, wire.to].some(ref => ref.componentId === componentId)) continue;
        const path = route(document, wire);
        if (!path.some((a, i) => i < path.length - 1 && onLine(a) && onLine(path[i + 1]) && distance(closest(point, a, path[i + 1]), point) < .001)) continue;
        const target = distance(point, path[0]) < .001 ? wire.from : distance(point, path.at(-1)) < .001 ? wire.to : { kind: 'wire', id: wire.id, point };
        found.set(target.kind === 'wire' ? token('wire', target.id) : referenceKey(target), target);
      }
      return [...found.values()];
    });
    if (targets.some(items => !items.length)) return false;
    if (targets.some(items => items.length !== 1)) throw new Error('Inline insertion is ambiguous here. Use a single wire span without overlapping wires.');
    const next = clone(document), resolve = connectionResolver(next), ends = targets.map(items => resolve(items[0]));
    const key = referenceKey, eligible = next.electrical.wires.filter(w =>
      ![w.from, w.to].some(ref => ref.componentId === componentId) && route(next, w).every(p => onLine(p) && p[axis] >= low - .001 && p[axis] <= high + .001));
    const queue = [{ ref: ends[0], edges: [], nodes: [ends[0]] }], visited = new Set(); let path;
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i], k = key(item.ref); if (visited.has(k)) continue; visited.add(k);
      if (k === key(ends[1])) { path = item; break; }
      for (const wire of eligible) {
        let other; if (key(wire.from) === k) other = wire.to; else if (key(wire.to) === k) other = wire.from; else continue;
        queue.push({ ref: other, edges: [...item.edges, wire.id], nodes: [...item.nodes, other] });
      }
    }
    if (!path || !path.edges.length) return false;
    if (ends.some(end => eligible.filter(w => key(w.from) === key(end) || key(w.to) === key(end)).length > 1))
      throw new Error('Inline insertion is ambiguous here. Remove overlapping or parallel bypass wires first.');
    const interior = path.nodes.slice(1, -1);
    const probed = ref => next.probes.some(p => p.kind === 'voltage' && [p.positive, p.negative].some(r => r && key(r) === key(ref)));
    if (interior.some(ref => ref.kind !== 'junction' || probed(ref) || next.electrical.wires.filter(w => key(w.from) === key(ref) || key(w.to) === key(ref)).length !== 2))
      throw new Error('Cannot insert across a branch, component pin or probe target. Choose a clear wire span.');
    const removed = new Set(path.edges), oldJunctions = new Set(document.electrical.junctions.map(j => j.id));
    next.electrical.wires = next.electrical.wires.filter(w => !removed.has(w.id));
    for (const id of removed) delete next.layout.wires[id];
    const removeJunctions = new Set(interior.map(ref => ref.junctionId));
    for (let i = 0; i < 2; i++) {
      const end = ends[i];
      if (end.kind === 'junction' && !oldJunctions.has(end.junctionId)) {
        for (const wire of next.electrical.wires) for (const side of ['from', 'to']) if (key(wire[side]) === key(end)) wire[side] = clone(refs[i]);
        removeJunctions.add(end.junctionId);
      } else if (key(end) !== key(refs[i])) {
        const id = crypto.randomUUID(); next.electrical.wires.push({ id, from: clone(end), to: clone(refs[i]) }); next.layout.wires[id] = { bends: [] };
      }
    }
    next.electrical.junctions = next.electrical.junctions.filter(j => !removeJunctions.has(j.id));
    for (const id of removeJunctions) delete next.layout.junctions[id];
    Object.assign(document, next); return true;
  }
  // A dropped wire connects to pins on its moved sections. Do not run inline
  // component insertion here: moving a wire across two pins must not remove it.
  function connectWireContacts(document, paths) {
    const on=(p,path)=>distance(closest(p,path[0],path[1]),p)<.001,resolve=connectionResolver(document);
    for(const c of document.electrical.components)for(const pinId of Object.keys(Catalog.componentPins(c))){
      const from={kind:'pin',componentId:c.id,pinId},p=pin(document,from);
      if(!paths.some(path=>on(p,path)))continue;
      for(const wire of [...document.electrical.wires]){
        const points=route(document,wire);
        if(!points.some((a,i)=>i+1<points.length&&on(p,[a,points[i+1]])))continue;
        const to=resolve({kind:'wire',id:wire.id,point:p}),a=referenceKey(from),b=referenceKey(to);
        if(a===b||document.electrical.wires.some(w=>referenceKey(w.from)===a&&referenceKey(w.to)===b||referenceKey(w.from)===b&&referenceKey(w.to)===a))continue;
        const id=crypto.randomUUID();document.electrical.wires.push({id,from:clone(from),to:clone(to)});document.layout.wires[id]={bends:[]};
      }
    }
  }
  function connectContacts(document, componentIds) {
    for (const id of componentIds) insertInline(document, id);
    const refKey = referenceKey;
    function connected(a, b) {
      const target = refKey(b), visited = new Set(), queue = [a];
      for (let i = 0; i < queue.length; i++) {
        const ref = queue[i], key = refKey(ref); if (key === target) return true; if (visited.has(key)) continue; visited.add(key);
        for (const w of document.electrical.wires) { if (refKey(w.from) === key) queue.push(w.to); else if (refKey(w.to) === key) queue.push(w.from); }
      }
      return false;
    }
    function attach(from, to) {
      if (connected(from, to)) return;
      const wireId = crypto.randomUUID(); document.electrical.wires.push({ id: wireId, from: clone(from), to: clone(to) });
      document.layout.wires[wireId] = { bends: [] };
    }
    const resolve = connectionResolver(document);
    for (const c of document.electrical.components) if (componentIds.has(c.id)) for (const pinId of Object.keys(Catalog.componentPins(c))) {
      const from = { kind: 'pin', componentId: c.id, pinId }, point = pin(document, from);
      for (const other of document.electrical.components) if (other.id !== c.id) for (const otherPin of Object.keys(Catalog.componentPins(other))) {
        const to = { kind: 'pin', componentId: other.id, pinId: otherPin };
        if (distance(point, pin(document, to)) < .001) attach(from, to);
      }
      for (const j of document.electrical.junctions) if (distance(point, document.layout.junctions[j.id]) < .001)
        attach(from, { kind: 'junction', junctionId: j.id });
      for (const wire of [...document.electrical.wires]) {
        if (connected(from, wire.from) || connected(from, wire.to)) continue;
        const points = route(document, wire);
        if (points.some((p, i) => i < points.length - 1 && distance(closest(point, p, points[i + 1]), point) < .001))
          attach(from, resolve({ kind: 'wire', id: wire.id, point }));
      }
    }
  }
  function junctionDots(document) {
    const refs = new Map(), parent = new Map(), counts = new Map();
    const key = referenceKey;
    function add(ref, count = 0) { const k = key(ref); if (!parent.has(k)) { parent.set(k, k); refs.set(k, ref); counts.set(k, 0); } counts.set(k, counts.get(k) + count); return k; }
    function find(k) { while (parent.get(k) !== k) k = parent.get(k); return k; }
    for (const c of document.electrical.components) for (const p of Object.keys(Catalog.componentPins(c))) add({ kind: 'pin', componentId: c.id, pinId: p }, 1);
    for (const j of document.electrical.junctions) add({ kind: 'junction', junctionId: j.id });
    for (const w of document.electrical.wires) {
      const a = add(w.from), b = add(w.to), points = route(document, w);
      if (distance(pin(document, w.from), pin(document, w.to)) < .001) parent.set(find(a), find(b));
      if (points.length > 1) { counts.set(a, counts.get(a) + 1); counts.set(b, counts.get(b) + 1); }
    }
    const groups = new Map();
    for (const k of refs.keys()) { const root = find(k); groups.set(root, (groups.get(root) || 0) + counts.get(k)); }
    return [...groups].filter(([, degree]) => degree >= 3).map(([root, degree]) => ({ point: pin(document, refs.get(root)), degree }));
  }
  // Editing representation: one edge per straight section. Two-way collinear
  // nodes are construction history, while corners, branches and probe anchors stay.
  // Split positive-length collinear overlaps at their boundaries, then share
  // references there. Mere crossings and touching unrelated endpoints stay apart.
  function mergeOverlappingSections(d) {
    const key = referenceKey, aliases = new Map(), refs = new Map();
    const root = ref => { while (aliases.has(key(ref))) ref = aliases.get(key(ref)); return ref; };
    function join(a, b) {
      a = root(a); b = root(b);
      if (key(a) === key(b)) return a;
      if (b.kind === 'pin' && a.kind !== 'pin') [a,b] = [b,a];
      aliases.set(key(b), a); refs.set(key(b), b);
      return a;
    }
    // Overlaps may also belong to different electrical nets in imported layouts.
    // Only coalesce paths already joined electrically, so cleanup cannot short a device.
    const nets=new Map(),net=k=>{while(nets.has(k))k=nets.get(k);return k;};
    for(const w of d.electrical.wires){const a=net(key(w.from)),b=net(key(w.to));if(a!==b)nets.set(b,a);}
    const originalDegree=new Map();
    for(const w of d.electrical.wires)for(const ref of [w.from,w.to])originalDegree.set(key(ref),(originalDegree.get(key(ref))||0)+1);
    const sections = d.electrical.wires.map(w => ({w, a:pin(d,w.from), b:pin(d,w.to), cuts:[{p:pin(d,w.from),ref:w.from},{p:pin(d,w.to),ref:w.to}]}));
    const on = (p,s) => distance(closest(p,s.a,s.b),p)<.001;
    function cut(s,p) {
      let item = s.cuts.find(c=>distance(c.p,p)<.001);
      if (!item) {
        const id=crypto.randomUUID(); d.electrical.junctions.push({id}); d.layout.junctions[id]=clone(p);
        item={p,ref:{kind:'junction',junctionId:id}}; s.cuts.push(item);
      }
      return item.ref;
    }
    let changed=false;
    for(let i=0;i<sections.length;i++)for(let j=i+1;j<sections.length;j++) {
      const a=sections[i],b=sections[j];
      if(net(key(a.w.from))!==net(key(b.w.from)))continue;
      if(distance(a.a,a.b)<.001||distance(b.a,b.b)<.001)continue;
      const horizontal=Math.abs(a.a.y-a.b.y)<.001&&Math.abs(b.a.y-b.b.y)<.001&&Math.abs(a.a.y-b.a.y)<.001;
      const vertical=Math.abs(a.a.x-a.b.x)<.001&&Math.abs(b.a.x-b.b.x)<.001&&Math.abs(a.a.x-b.a.x)<.001;
      if(!horizontal&&!vertical)continue;
      const axis=horizontal?'x':'y',lo=Math.max(Math.min(a.a[axis],a.b[axis]),Math.min(b.a[axis],b.b[axis])),hi=Math.min(Math.max(a.a[axis],a.b[axis]),Math.max(b.a[axis],b.b[axis]));
      if(hi-lo<.001)continue;
      changed=true;
      for(const p of [a.a,a.b,b.a,b.b])if(on(p,a)&&on(p,b))join(cut(a,p),cut(b,p));
    }
    if(!changed)return new Set();
    const wires=[];
    for(const s of sections) {
      const axis=Math.abs(s.a.x-s.b.x)>.001?'x':'y',direction=s.b[axis]>=s.a[axis]?1:-1;
      s.cuts.sort((a,b)=>direction*(a.p[axis]-b.p[axis]));
      for(let i=1;i<s.cuts.length;i++) {
        const id=i===1?s.w.id:crypto.randomUUID();
        wires.push({...s.w,id,from:clone(root(s.cuts[i-1].ref)),to:clone(root(s.cuts[i].ref))});d.layout.wires[id]={bends:[]};
      }
    }
    // A pin is a physical terminal: preserve its contact when another pin wins
    // the shared geometric node. Probe targets follow aliases as well.
    for(const [k,ref] of refs)if(ref.kind==='pin') {
      const id=crypto.randomUUID();wires.push({id,from:clone(ref),to:clone(root(ref))});d.layout.wires[id]={bends:[]};
    }
    for(const p of d.probes)for(const side of ['positive','negative'])if(p[side])p[side]=clone(root(p[side]));
    d.electrical.wires=wires;
    // Only nodes which were not loose ends before merging can be routing tails.
    // Preserve deliberate unfinished wires, physical pins and probe anchors.
    const tails=new Set();
    for(const s of sections)for(const c of s.cuts) {
      const ref=root(c.ref);
      if(ref.kind==='junction' && originalDegree.get(key(c.ref))!==1)tails.add(ref.junctionId);
    }
    for(const s of sections)for(const ref of [s.w.from,s.w.to])
      if(originalDegree.get(key(ref))===1)tails.delete(root(ref).junctionId);
    return tails;
  }
  function normalizeWires(d){
    const key=referenceKey,probed=new Set();
    for(const p of d.probes)for(const side of ['positive','negative'])if(p[side]?.kind==='junction')probed.add(p[side].junctionId);
    const split=[];
    for(const wire of d.electrical.wires){
      const points=route(d,wire,true);if(points.length<=2){split.push(wire);d.layout.wires[wire.id]={bends:[]};continue;}
      const refs=[wire.from];
      for(const point of points.slice(1,-1)){const id=crypto.randomUUID();d.electrical.junctions.push({id});d.layout.junctions[id]=clone(point);refs.push({kind:'junction',junctionId:id});}
      refs.push(wire.to);const retained=Math.floor((refs.length-2)/2);
      for(let i=0;i<refs.length-1;i++){const id=i===retained?wire.id:crypto.randomUUID();split.push({id,from:clone(refs[i]),to:clone(refs[i+1])});d.layout.wires[id]={bends:[]};}
    }
    d.electrical.wires=split;
    const tails=mergeOverlappingSections(d);
    probed.clear();
    for(const p of d.probes)for(const side of ['positive','negative'])if(p[side]?.kind==='junction')probed.add(p[side].junctionId);
    // Collapse only explicit zero-length node contacts. Geometric coincidences
    // and crossing interiors alone must never join previously separate nets.
    const aliases=new Map(),root=id=>{while(aliases.has(id))id=aliases.get(id);return id;};
    for(const w of d.electrical.wires)if(w.from.kind==='junction'&&w.to.kind==='junction'&&distance(pin(d,w.from),pin(d,w.to))<.001){const a=root(w.from.junctionId),b=root(w.to.junctionId);if(a!==b)aliases.set(b,a);}
    for(const w of d.electrical.wires)for(const side of ['from','to'])if(w[side].kind==='junction')w[side]={kind:'junction',junctionId:root(w[side].junctionId)};
    for(const p of d.probes)for(const side of ['positive','negative'])if(p[side]?.kind==='junction')p[side]={kind:'junction',junctionId:root(p[side].junctionId)};
    for(const id of [...probed])if(aliases.has(id)){probed.delete(id);probed.add(root(id));}
    const seen=new Set();d.electrical.wires=d.electrical.wires.filter(w=>{const a=key(w.from),b=key(w.to),k=JSON.stringify([a,b].sort());if(a===b||seen.has(k)){delete d.layout.wires[w.id];return false;}seen.add(k);return true;});
    // Overlap removal may expose an old turnaround as a dangling tail. Peel
    // those sections back to the surviving branch, without pruning loose ends.
    const tailNodes=new Set([...tails].map(root));
    let pruned=true;
    while(pruned){
      pruned=false;const incidence=new Map();
      for(const w of d.electrical.wires)for(const ref of [w.from,w.to])if(ref.kind==='junction'){
        if(!incidence.has(ref.junctionId))incidence.set(ref.junctionId,[]);
        incidence.get(ref.junctionId).push(w);
      }
      for(const id of tailNodes){
        const edges=incidence.get(id);
        if(probed.has(id)||edges?.length!==1)continue;
        const wire=edges[0];d.electrical.wires=d.electrical.wires.filter(w=>w!==wire);delete d.layout.wires[wire.id];
        pruned=true;break;
      }
    }
    // Merge one node at a time, rebuilding incidence after each local rewrite.
    let again=true;
    while(again){again=false;const incidence=new Map();
      for(const w of d.electrical.wires)for(const ref of [w.from,w.to])if(ref.kind==='junction'){if(!incidence.has(ref.junctionId))incidence.set(ref.junctionId,[]);incidence.get(ref.junctionId).push(w);}
      for(const [id,edges] of incidence){
        if(edges.length!==2||probed.has(id))continue;
        const [a,b]=edges,other=w=>w.from.junctionId===id?w.to:w.from,left=other(a),right=other(b),p=d.layout.junctions[id],x=pin(d,left),y=pin(d,right);
        const straight=Math.abs(x.x-p.x)<.001&&Math.abs(y.x-p.x)<.001&&(x.y-p.y)*(y.y-p.y)<0||Math.abs(x.y-p.y)<.001&&Math.abs(y.y-p.y)<.001&&(x.x-p.x)*(y.x-p.x)<0;
        if(!straight)continue;
        a.from=clone(left);a.to=clone(right);d.layout.wires[a.id]={bends:[]};d.electrical.wires=d.electrical.wires.filter(w=>w!==b);delete d.layout.wires[b.id];again=true;break;
      }
    }
    const used=new Set(probed);for(const w of d.electrical.wires)for(const ref of [w.from,w.to])if(ref.kind==='junction')used.add(ref.junctionId);
    d.electrical.junctions=d.electrical.junctions.filter(j=>{if(used.has(j.id)&&!aliases.has(j.id))return true;delete d.layout.junctions[j.id];return false;});
    const ids=new Set(d.electrical.wires.map(w=>w.id));for(const id of Object.keys(d.layout.wires))if(!ids.has(id))delete d.layout.wires[id];
    return d;
  }
  function create(initial, onChange = () => { }, {wireSections=false, componentReferences=true}={}) {
    const history=History.create(alignGrid(clone(validate(initial))),onChange,{prepare:next=>{
      if (!componentReferences) for (const component of next.electrical.components) delete component.reference;
      if(wireSections)normalizeWires(next);return validate(next);
    }}),transaction=history.transaction;
    const model={
      get document(){return history.document;},get canUndo(){return history.canUndo;},get canRedo(){return history.canRedo;},transaction,undo:history.undo,redo:history.redo,
      replace: next => transaction('Open circuit', draft => { for (const key of Object.keys(draft)) delete draft[key]; Object.assign(draft, alignGrid(clone(validate(next)))); }),
      addComponent(kind, x, y, rotation = 0, mirror = false) {
        const def = placementDefinitions[kind === 'sineSource' ? 'acSource' : kind]; if (!def) throw new Error('Unknown component');
        kind = def.kind || kind;
        const componentId = crypto.randomUUID();
        transaction('Place ' + def.name, d => {
          const component = { id: componentId, kind, modelVersion: 1, parameters: clone(def.parameters) };
          if (componentReferences) {
            let number = 1; while (d.electrical.components.some(c => c.reference === def.prefix + number)) number++;
            component.reference = def.prefix + number;
          }
          d.electrical.components.push(component);
          d.layout.components[componentId] = placementPose(kind, { x, y }, rotation, mirror);
          connectContacts(d, new Set([componentId]));
        }); return componentId;
      },
      addProbe(target, label) {
        const id = crypto.randomUUID();
        transaction('Place voltage probe', d => {
          const positive = connectionResolver(d)(target);
          if (label === undefined) {
            let number = 1; while (d.probes.some(p => p.label === 'V' + number)) number++;
            label = 'V' + number;
          }
          d.probes.push({ id, kind: 'voltage', positive, reference: 'ground', label });
          (d.layout.probes ||= {})[id] = { x: 50, y: -100 };
        }); return id;
      },
      connect(from, to, bends = []) {
        return transaction('Connect wire', d => {
          if (to.kind === 'point') {
            const start = ['wire','point'].includes(from.kind) ? from.point : pin(d, from), end = { x: snap(to.point?.x), y: snap(to.point?.y) };
            if (distance(start, end) < .001 && bends.every(p => distance(start, p) < .001)) return false;
          }
          const resolve = connectionResolver(d);
          const a = resolve(from), b = resolve(to); if (same(a, b)) return false;
          const wireId = crypto.randomUUID(); d.electrical.wires.push({ id: wireId, from: a, to: b });
          d.layout.wires[wireId] = { bends: clone(bends) };
        });
      },
      remove(selection) {
        return transaction('Delete selection', d => {
          const cs = new Set(d.electrical.components.filter(c => selection.has(token('component', c.id))).map(c => c.id));
          const js = new Set(d.electrical.junctions.filter(j => selection.has(token('junction', j.id))).map(j => j.id));
          const stubs=new Map();
          const keepEnd=ref=>{
            if(ref.kind!=='pin'||!cs.has(ref.componentId))return ref;
            const key=referenceKey(ref);if(!stubs.has(key)){const id=crypto.randomUUID();d.electrical.junctions.push({id});d.layout.junctions[id]=clone(pin(d,ref));stubs.set(key,{kind:'junction',junctionId:id});}return clone(stubs.get(key));
          };
          d.electrical.wires=d.electrical.wires.filter(w=>{
            if(selection.has(token('wire',w.id))||js.has(w.from.junctionId)||js.has(w.to.junctionId)){delete d.layout.wires[w.id];return false;}
            w.from=keepEnd(w.from);w.to=keepEnd(w.to);return true;
          });
          d.probes=d.probes.filter(p=>{
            const keep=!selection.has(token('probe',p.id))&&(p.kind==='current'?!cs.has(p.componentId):!js.has(p.positive?.junctionId)&&!js.has(p.negative?.junctionId));
            if(!keep){if(d.layout.probes)delete d.layout.probes[p.id];return false;}
            if(p.kind==='voltage'){p.positive=keepEnd(p.positive);if(p.negative)p.negative=keepEnd(p.negative);}return true;
          });
          d.electrical.components=d.electrical.components.filter(c=>!cs.has(c.id));d.electrical.junctions=d.electrical.junctions.filter(j=>!js.has(j.id));
          for(const id of cs)delete d.layout.components[id];for(const id of js)delete d.layout.junctions[id];
        });
      }
    };
    model.execute=command=>executeCommand(model,command);
    return model;
  }
  function toggleSwitches(document,id){
    const part=document.electrical.components.find(c=>c.id===id&&Catalog.switchKind(c.kind));
    if(!part)throw new Error('Expected switch');
    const advance=c=>{const p=c.parameters;if(c.kind==='switch')p.closed=!p.closed;else if(c.kind==='pushSwitch')p.normallyClosed=!p.normallyClosed;else p.position=(p.position+1)%Catalog.switchPositionCount(c);};
    advance(part);
    const label=part.parameters.linkLabel;
    if(label)for(const c of document.electrical.components)if(c!==part&&Catalog.switchKind(c.kind)&&c.parameters.linkLabel===label)advance(c);
    if(['spdtSwitch','mbbSwitch'].includes(part.kind)&&part.parameters.group){
      for(const c of document.electrical.components)if(c!==part&&c.kind===part.kind&&c.parameters.group===part.parameters.group&&part.parameters.position<Catalog.switchPositionCount(c))c.parameters.position=part.parameters.position;
    }
  }
  function momentaryDocument(document,id){const result=clone(document);toggleSwitches(result,id);return result;}

  // Frontend-neutral commands use entity references, never DOM events or pixels.
  // execute() records one undo step; applyCommand() is the immutable one-shot API.
  function executeCommand(model,command){
    if(!command||typeof command!=='object'||typeof command.type!=='string')throw new Error('Expected an editing command');
    const selection=()=>new Set((command.selection||[]).map(ref=>{
      if(!ref||!['component','wire','junction','probe'].includes(ref.kind)||typeof ref.id!=='string')throw new Error('Invalid command selection');
      return token(ref.kind,ref.id);
    }));
    switch(command.type){
      case 'addComponent':return model.addComponent(command.kind,command.x,command.y,command.rotation??0,command.mirror??false);
      case 'connect':return model.connect(command.from,command.to,command.bends||[]);
      case 'remove':return model.remove(selection());
      case 'transform':return model.transaction(command.label||'Transform selection',d=>transformSelection(d,selection(),command.dx??0,command.dy??0,{disconnect:command.disconnect??false,rotation:command.rotation??0,orientations:command.orientations||[],contacts:true}));
      case 'moveSegment':return model.transaction(command.label||'Reroute wire',d=>moveSegment(d,command.wireId,command.segment??0,command.dx??0,command.dy??0));
      case 'reconnect':return model.transaction('Reconnect wire end',d=>reconnect(d,command.junctionId,command.target));
      case 'setParameters':return model.transaction('Edit parameters',d=>{
        const c=d.electrical.components.find(c=>c.id===command.componentId);if(!c)throw new Error('Unknown component');
        if(!command.parameters||typeof command.parameters!=='object'||Array.isArray(command.parameters))throw new Error('Expected parameter fields');
        replaceParameters(d,c.id,{...c.parameters,...clone(command.parameters)});
      });
      case 'replace':return model.replace(command.document);
      default:throw new Error('Unknown editing command: '+command.type);
    }
  }
  function applyCommand(document,command,options={wireSections:true}){
    const model=create(document,()=>{},options);executeCommand(model,command);return model.document;
  }
  function retargetProbe(document, id, target) {
    const probe = document.probes.find(p => p.id === id && p.kind === 'voltage');
    if (!probe) throw new Error('Unknown voltage probe');
    probe.positive = connectionResolver(document)(target);
    return document;
  }
  const {createDragSession}=Drag.createTools({normalizeWires,connectContacts,transformSelection,connectWireContacts});
  const api=Object.freeze({ toggleSwitches, replaceParameters, retargetProbe, applyCommand, createDragSession, normalizeWires, outputSpecs, graphic, graphicSize, momentaryDocument, boxSelection, copySelection, pasteSelection, looseEndpoint, reconnectTarget, reconnect, definitions, placementDefinitions, waveformNames, validWaveform, grid, snap, token, pin, route, closest, bounds, hit, move, detach, transformSelection, moveSegment, validate, empty, create, zoom, placementPose, flipPose, probePoint, probeVoltage, scopeChannels, alignGrid, insertInline, connectContacts, junctionDots, reshape, referenceKey });

  registry.commands=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
