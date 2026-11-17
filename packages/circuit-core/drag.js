'use strict';
// Portable computation module: no DOM, renderer, storage or worker construction.
(() => {
  const registry=globalThis.CircuitCoreModules ||= {};
  const Catalog=typeof module==='object'&&module.exports?require('./catalog.js'):registry.catalog;
  const Geometry=typeof module==='object'&&module.exports?require('./geometry.js'):registry.geometry;
  const Document=typeof module==='object'&&module.exports?require('./document.js'):registry.document;
  const {clone,grid,snap,token,referenceKey,pin,route,distance,clean}=Geometry,{definitions}=Catalog,{validate}=Document;
  function createTools({normalizeWires,connectContacts,transformSelection,connectWireContacts}) {
  /**
   * Gesture-local orthogonal drag graph. Rules adapted to our reference-based
   * document model from KiCad SCH_MOVE_TOOL: getConnectedDragItems,
   * performItemMove, orthoLineDrag, migrateHiddenJunctions, trimDanglingLines.
   * https://docs.kicad.org/doxygen/sch__move__tool_8cpp_source.html
   * Temporary vertices/edges and original directions survive pointer updates;
   * previews never mutate the source document or create history entries.
   */
  function createDragSession(initial, selection, { wireId, segment = 0 } = {}) {
    const base=clone(initial), chosen=new Set(selection), nodes=new Map(), edges=[];
    const offset={x:0,y:0}, protectedEnds=new Set(), probeNodes=new Set();
    let cancelled=false, serial=0;
    const finished=new Map();
    const point=n=>({x:n.x,y:n.y}), equal=(a,b)=>distance(a,b)<.001;
    const selected=ref=>chosen.has(token(ref.kind==='pin'?'component':'junction',ref.componentId||ref.junctionId));
    function node(ref) {
      const k=referenceKey(ref);
      if(!nodes.has(k))nodes.set(k,{key:k,ref:clone(ref),...pin(base,ref),temporary:false,driver:selected(ref)});
      return nodes.get(k);
    }
    function temporary(p, options={}) {
      const id=crypto.randomUUID(),n={key:'drag:'+serial++,ref:{kind:'junction',junctionId:id},...point(p),temporary:true,driver:false,...options};
      nodes.set(n.key,n);return n;
    }
    const incident=n=>edges.filter(e=>e.a===n||e.b===n);
    const other=(e,n)=>e.a===n?e.b:e.a;
    const axis=e=>equal(e.a,e.b)?e.axis:Math.abs(e.a.y-e.b.y)<.001?'x':'y';
    function edge(a,b,source,options={}) {
      const e={a,b,source,axis:Math.abs(a.y-b.y)<.001?'x':'y',temporary:false,...options};edges.push(e);return e;
    }
    function replaceEnd(e,old,n){if(e.a===old)e.a=n;else e.b=n;}
    for(const c of base.electrical.components)for(const pinId of Object.keys(Catalog.componentPins(c)))node({kind:'pin',componentId:c.id,pinId});
    for(const j of base.electrical.junctions)node({kind:'junction',junctionId:j.id});
    for(const p of base.probes)for(const side of ['positive','negative'])if(p[side])probeNodes.add(node(p[side]));
    for(const w of base.electrical.wires){
      const path=route(base,w),vertices=[node(w.from),...path.slice(1,-1).map(p=>temporary(p)),node(w.to)];
      for(let i=1;i<vertices.length;i++)edge(vertices[i-1],vertices[i],w,{originalId:i===1?w.id:null,section:i-1});
    }
    for(const n of nodes.values())if(!n.temporary&&n.ref.kind==='junction'&&incident(n).length===1)protectedEnds.add(n.ref.junctionId);

    // Explicitly moving a wire must not pull a fixed pin or a branch with it.
    // Split that boundary once and retain a zero-length connectivity edge.
    const movingEdges=edges.filter(e=>wireId?e.source.id===wireId&&e.section===segment:chosen.has(token('wire',e.source.id)));
    const movingSet=new Set(movingEdges),splitNodes=new Map();
    for(const e of movingEdges)for(const n of [e.a,e.b]){
      if(n.driver)continue;
      const attached=incident(n).some(item=>!movingSet.has(item)),fixedPin=n.ref.kind==='pin';
      if(attached||fixedPin){
        if(!splitNodes.has(n)){
          const moving=temporary(n,{driver:true,exportAnchor:true});splitNodes.set(n,moving);
          const contact=edge(moving,n,e.source,{temporary:true,boundary:true,axis:e.axis==='x'?'y':'x'});
          // A selected section moves perpendicular to its own axis.
          contact.axis=e.axis==='x'?'y':'x';
        }
        replaceEnd(e,n,splitNodes.get(n));
      }else n.driver=true;
    }
    // All internal bends of a selected routed wire travel with it as well.
    for(const e of movingEdges)for(const n of [e.a,e.b])if(n.temporary&&!n.driver&&incident(n).every(item=>movingSet.has(item)))n.driver=true;
    const constrainedAxis=wireId&&movingEdges.length?axis(movingEdges[0])==='x'?'y':'x':null;
    const originalNodes=[...nodes.values()].filter(n=>!n.temporary);
    const pinAxis=n=>{
      if(n.ref.kind!=='pin')return 'x';
      const pose=base.layout.components[n.ref.componentId],p=Catalog.componentPins(base.electrical.components.find(c=>c.id===n.ref.componentId))[n.ref.pinId];
      const horizontal=Math.abs(p[0])>=Math.abs(p[1]);return (pose.rotation%180===0)===horizontal?'x':'y';
    };
    for(const e of edges)if(equal(e.a,e.b))e.axis=e.a.ref.kind==='pin'?pinAxis(e.a):e.b.ref.kind==='pin'?pinAxis(e.b):e.axis;
    function saveState(){return {positions:[...nodes.values()].map(n=>[n,n.x,n.y]),edges:edges.map(e=>({...e}))};}
    function restore(s){
      nodes.clear();for(const [n,x,y] of s.positions){n.x=x;n.y=y;nodes.set(n.key,n);}
      edges.splice(0,edges.length,...s.edges.map(e=>({...e})));
    }
    // Retain the initial graph for exact return to the gesture origin. Axis
    // reversals remerge temporary bends incrementally in applyDelta().
    const originState=saveState();
    const initialPositions=new Map([...nodes.values()].map(n=>[n,point(n)]));

    function collapseTemporary(){
      let again=true;
      while(again){
        again=false;
        for(const e of edges){
          if(!e.temporary||e.boundary||!equal(e.a,e.b))continue;
          let remove=e.a,keep=e.b;
          if(!remove.temporary||remove.driver||probeNodes.has(remove))[remove,keep]=[keep,remove];
          if(!remove.temporary||remove.driver||probeNodes.has(remove))continue;
          edges.splice(edges.indexOf(e),1);
          for(const item of edges)if(item.a===remove||item.b===remove)replaceEnd(item,remove,keep);
          nodes.delete(remove.key);again=true;break;
        }
        if(again)continue;
        for(const n of nodes.values()){
          if(!n.temporary||n.driver||n.exportAnchor||probeNodes.has(n))continue;
          const linked=incident(n);if(linked.length!==2)continue;
          const [a,b]=linked;
          if(axis(a)!==axis(b)||(!a.temporary&&!b.temporary))continue;
          // A temporary bend which straightens is no longer needed. Keep the
          // original edge's identity/direction so it can be extended again.
          const keep=!a.temporary?a:!b.temporary?b:a,drop=keep===a?b:a;
          replaceEnd(keep,n,other(drop,n));edges.splice(edges.indexOf(drop),1);nodes.delete(n.key);
          if(keep.a===keep.b)edges.splice(edges.indexOf(keep),1);
          again=true;break;
        }
      }
    }
    function step(coordinate,amount){
      if(!amount)return;
      // Process an axis at a time. Driver coordinates move once, even when
      // several selected pins/wires share a node.
      const moving=new Set([...nodes.values()].filter(n=>n.driver)),count={x:0,y:0};
      const ordered=[...edges].sort((a,b)=>{
        const pa=a.a.driver?a.a:a.b,pb=b.a.driver?b.a:b.b;
        return (amount>=0?1:-1)*(pa.x-pb.x||pa.y-pb.y)||String(a.source.id).localeCompare(String(b.source.id));
      });
      for(const e of ordered){
        if(!edges.includes(e))continue;
        const ma=moving.has(e.a),mb=moving.has(e.b);
        if(ma===mb)continue;
        const from=ma?e.a:e.b,fixed=ma?e.b:e.a,originalAxis=axis(e);
        if(originalAxis===coordinate)continue;
        const connected=incident(fixed).filter(item=>item!==e);
        // Pins and real branches are anchors. Ordinary bend vertices may slide
        // along a matching neighbour, including one shortened to zero length.
        const anchor=fixed.ref.kind==='pin'||(!fixed.temporary&&incident(fixed).length>=3&&!fixed.driver);
        const neighbour=!anchor&&connected.find(item=>axis(item)===coordinate||equal(item.a,item.b));
        if(neighbour){moving.add(fixed);continue;}
        if(!anchor&&connected.length===0){moving.add(fixed);continue;}
        if(equal(e.a,e.b))continue; // reuse its stored direction as it grows again
        if(fixed.ref.kind==='junction'&&!fixed.temporary&&incident(fixed).length>=3){
          const bend=temporary(fixed);replaceEnd(e,fixed,bend);
          edge(bend,fixed,e.source,{temporary:true,axis:coordinate});moving.add(bend);
        }else{
          // A fixed pin/collinear attachment needs a two-segment bend. Offset
          // successive bends by one grid step, as KiCad's bend counters do.
          const direction=Math.sign(fixed[originalAxis]-from[originalAxis])||1;
          const p=point(from);p[originalAxis]+=direction*grid*(1+count[originalAxis]++);
          const stationary=temporary(p),bend=temporary(p);
          replaceEnd(e,fixed,bend);
          edge(bend,stationary,e.source,{temporary:true,axis:coordinate});
          edge(stationary,fixed,e.source,{temporary:true,axis:originalAxis});moving.add(bend);
        }
      }
      for(const n of moving)n[coordinate]+=amount;
      offset[coordinate]+=amount;
      collapseTemporary();
    }
    function applyDelta(coordinate,amount){
      if(!amount)return;
      // Stop at zero before reversing the drag, so generated bends remerge
      // before a new bend on the other side is considered.
      const current=offset[coordinate],next=current+amount;
      if(current&&current*next<0){step(coordinate,-current);step(coordinate,next);}
      else step(coordinate,amount);
    }
    function serialize(){
      if(!offset.x&&!offset.y)return clone(base);
      const d=clone(base),used=new Set(),newWires=[],layout={};
      for(const c of d.electrical.components)if(chosen.has(token('component',c.id))){d.layout.components[c.id].x+=offset.x;d.layout.components[c.id].y+=offset.y;}
      for(const p of d.probes)if(chosen.has(token('probe',p.id))&&d.layout.probes?.[p.id]){d.layout.probes[p.id].x+=offset.x;d.layout.probes[p.id].y+=offset.y;}
      for(const n of originalNodes)if(n.ref.kind==='junction')d.layout.junctions[n.ref.junctionId]=point(n);
      const anchor=n=>!n.temporary||n.exportAnchor||incident(n).length!==2||probeNodes.has(n);
      const ensure=n=>{
        if(n.temporary&&!d.layout.junctions[n.ref.junctionId]){d.electrical.junctions.push({id:n.ref.junctionId});d.layout.junctions[n.ref.junctionId]=point(n);}
        return clone(n.ref);
      };
      const ids=new Set();
      function emit(start,first){
        const path=[point(start)],chain=[];let n=start,e=first;
        while(e&&!used.has(e)){
          used.add(e);chain.push(e);n=other(e,n);path.push(point(n));
          if(anchor(n))break;
          e=incident(n).find(item=>!used.has(item));
        }
        const representative=chain.find(item=>item.originalId&&!ids.has(item.originalId)),source=representative?.source||chain[0].source;
        const id=representative?.originalId||(chain[0].outputId ||= crypto.randomUUID());ids.add(id);
        let from=start,to=n;
        if(referenceKey(source.from)===referenceKey(n.ref)&&referenceKey(source.to)===referenceKey(start.ref)){from=n;to=start;path.reverse();}
        newWires.push({...clone(source),id,from:ensure(from),to:ensure(to)});layout[id]={bends:clean(path,true).slice(1,-1)};
      }
      for(const e of edges)if(e.originalId&&anchor(e.a)&&!used.has(e))emit(e.a,e);
      for(const n of nodes.values())if(anchor(n))for(const e of incident(n))if(!used.has(e))emit(n,e);
      // Preserve closed loops instead of dropping cycles without a fixed anchor.
      for(const e of edges)if(!used.has(e)){e.a.exportAnchor=true;emit(e.a,e);}
      d.electrical.wires=newWires;d.layout.wires=layout;return d;
    }
    return {
      update(x,y){
        if(cancelled)throw new Error('Drag session was cancelled');
        x=snap(x);y=snap(y);if(constrainedAxis==='x')y=0;if(constrainedAxis==='y')x=0;
        if(x!==offset.x||y!==offset.y)finished.clear();
        applyDelta('x',x-offset.x);applyDelta('y',y-offset.y);
        if(!x&&!y){restore(originState);offset.x=offset.y=0;}
        return serialize();
      },
      get document(){return serialize();},
      finish({normalize=true,contacts=false,rotation=0,orientations=[]}={}){
        if(cancelled)throw new Error('Drag session was cancelled');
        const cacheKey=JSON.stringify({normalize,contacts,rotation,orientations});
        if(finished.has(cacheKey))return clone(finished.get(cacheKey));
        if(rotation||orientations.length){
          const d=clone(base);transformSelection(d,chosen,offset.x,offset.y,{rotation,orientations,contacts:true});
          if(normalize)normalizeWires(d);
          validate(d);finished.set(cacheKey,clone(d));return d;
        }
        const d=serialize();
        if(movingEdges.length&&(offset.x||offset.y)){
          const movedPaths=edges.filter(e=>!equal(e.a,e.b)&&(e.temporary||!initialPositions.has(e.a)||!initialPositions.has(e.b)||!equal(e.a,initialPositions.get(e.a))||!equal(e.b,initialPositions.get(e.b)))).map(e=>[point(e.a),point(e.b)]);
          connectWireContacts(d,movedPaths);
        }
        if(contacts)connectContacts(d,new Set(d.electrical.components.filter(c=>chosen.has(token('component',c.id))).map(c=>c.id)));
        if(normalize && (offset.x||offset.y)){
          normalizeWires(d);
          // Track newly dangling old nodes rather than deleting deliberate loose
          // ends. Probes and explicitly selected wire endpoints are protected.
          const protectedIds=new Set([...protectedEnds,...[...nodes.values()].filter(n=>n.driver||probeNodes.has(n)).map(n=>n.ref.junctionId)]);
          for(const p of d.probes)for(const side of ['positive','negative'])if(p[side]?.junctionId)protectedIds.add(p[side].junctionId);
          let again=true;
          while(again){
            again=false;const incidence=new Map();
            for(const w of d.electrical.wires)for(const ref of [w.from,w.to])if(ref.kind==='junction'){
              if(!incidence.has(ref.junctionId))incidence.set(ref.junctionId,[]);incidence.get(ref.junctionId).push(w);
            }
            for(const [id,items] of incidence)if(items.length===1&&!protectedIds.has(id)){
              const w=items[0];d.electrical.wires=d.electrical.wires.filter(item=>item!==w);delete d.layout.wires[w.id];again=true;break;
            }
          }
          normalizeWires(d);
        }
        validate(d);finished.set(cacheKey,clone(d));return d;
      },
      cancel(){cancelled=true;restore(originState);offset.x=offset.y=0;finished.clear();return clone(base);}
    };
  }
    return {createDragSession};
  }
  const api=Object.freeze({createTools});

  registry.drag=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
