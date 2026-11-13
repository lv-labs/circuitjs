'use strict';
(() => {
  const clone=value=>structuredClone(value), grid=16;
  const definitions={
    resistor:{prefix:'R',name:'Resistor',pins:{a:[-48,0],b:[48,0]},parameters:{resistance:1000}},
    capacitor:{prefix:'C',name:'Capacitor',pins:{a:[-48,0],b:[48,0]},parameters:{capacitance:1e-6,initialVoltage:0,integration:'backwardEuler'}},
    voltageSource:{prefix:'V',name:'DC source',pins:{p:[0,-48],n:[0,48]},parameters:{waveform:{kind:'dc',voltage:5}}},
    switch:{prefix:'S',name:'Switch',pins:{a:[-48,0],b:[48,0]},parameters:{closed:true}},
    ground:{prefix:'G',name:'Ground',pins:{g:[0,-32]},parameters:{}}
  };
  const snap=n=>Math.round(n/grid)*grid;
  const token=(kind,id)=>JSON.stringify([kind,id]);
  const referenceKey=ref=>ref.kind==='pin'?JSON.stringify(['pin',ref.componentId,ref.pinId]):JSON.stringify(['junction',ref.junctionId]);
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function pin(document,ref) {
    if(ref.kind==='junction')return document.layout.junctions[ref.junctionId];
    const component=document.electrical.components.find(c=>c.id===ref.componentId);
    const pose=document.layout.components[component.id],offset=definitions[component.kind].pins[ref.pinId];
    const [rx,ry]=rotateOffset(offset[0]*(pose.mirror?-1:1),offset[1],pose.rotation);
    return {x:pose.x+rx,y:pose.y+ry};
  }
  function rotateOffset(x,y,rotation) {
    return [[x,y],[-y,x],[-x,-y],[y,-x]][((rotation/90)%4+4)%4];
  }
  function placementPose(kind,point,rotation=0) {
    const offset=kind==='ground'?rotateOffset(0,-32,rotation):[0,0];
    return {x:snap(point.x)-offset[0],y:snap(point.y)-offset[1],rotation,mirror:false};
  }
  function alignGrid(document) {
    for(const p of [...Object.values(document.layout.components),...Object.values(document.layout.junctions)]) {
      p.x=snap(p.x);p.y=snap(p.y);
    }
    for(const route of Object.values(document.layout.wires))for(const p of route.bends){p.x=snap(p.x);p.y=snap(p.y);}
    return document;
  }
  function clean(points) {
    const result=[];
    for(const p of points) {
      if(result.length && distance(result.at(-1),p)<0.001)continue;
      result.push({x:p.x,y:p.y});
      while(result.length>=3) {
        const [a,b,c]=result.slice(-3);
        if((Math.abs(a.x-b.x)<.001 && Math.abs(b.x-c.x)<.001)||
           (Math.abs(a.y-b.y)<.001 && Math.abs(b.y-c.y)<.001))result.splice(-2,1);
        else break;
      }
      if(result.length>=2&&distance(result.at(-1),result.at(-2))<.001)result.pop();
    }
    return result;
  }
  function route(document,wire) {
    const anchors=[pin(document,wire.from),...(document.layout.wires[wire.id]?.bends||[]),pin(document,wire.to)];
    const result=[anchors[0]];
    for(const end of anchors.slice(1)) {
      const start=result.at(-1);
      if(Math.abs(start.x-end.x)>.001 && Math.abs(start.y-end.y)>.001)result.push({x:end.x,y:start.y});
      result.push(end);
    }
    return clean(result);
  }

  function closest(point,a,b) {
    const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
    const t=length?Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/length)):0;
    return {x:a.x+t*dx,y:a.y+t*dy};
  }
  function bounds(document,component) {
    const pose=document.layout.components[component.id];
    const points=Object.keys(definitions[component.kind].pins).map(pinId=>pin(document,{kind:'pin',componentId:component.id,pinId}));
    points.push({x:pose.x-24,y:pose.y-24},{x:pose.x+24,y:pose.y+24});
    return {x:Math.min(...points.map(p=>p.x))-8,y:Math.min(...points.map(p=>p.y))-8,
      right:Math.max(...points.map(p=>p.x))+8,bottom:Math.max(...points.map(p=>p.y))+8};
  }
  function hit(document,point,scale=1) {
    let best=null;
    for(const c of document.electrical.components)for(const pinId of Object.keys(definitions[c.kind].pins)) {
      const ref={kind:'pin',componentId:c.id,pinId},d=distance(point,pin(document,ref));
      if(d<Math.min(10/scale,20) && (!best||d<best.distance))best={...ref,distance:d};
    }
    for(const j of document.electrical.junctions) {
      const d=distance(point,document.layout.junctions[j.id]);
      if(d<Math.min(10/scale,20) && (!best||d<best.distance))best={kind:'junction',junctionId:j.id,distance:d};
    }
    if(best)return best;
    for(const c of [...document.electrical.components].reverse()) {
      const pose=document.layout.components[c.id],r=-pose.rotation*Math.PI/180;
      const dx=point.x-pose.x,dy=point.y-pose.y,x=dx*Math.cos(r)-dy*Math.sin(r),y=dx*Math.sin(r)+dy*Math.cos(r);
      if(Math.abs(x)<(c.kind==='ground'?25:34) && Math.abs(y)<(c.kind==='voltageSource'?34:24))return {kind:'component',id:c.id};
    }
    for(const wire of [...document.electrical.wires].reverse()) {
      const points=route(document,wire);
      for(let i=0;i<points.length-1;i++) {
        const projected=closest(point,points[i],points[i+1]);
        if(distance(point,projected)<7/scale) {
          const onGrid=closest({x:snap(projected.x),y:snap(projected.y)},points[i],points[i+1]);
          return {kind:'wire',id:wire.id,point:onGrid,segment:i};
        }
      }
    }
    return null;
  }
  function move(document,selection,dx,dy) {
    const selected=ref=>selection.has(token(ref.kind==='pin'?'component':'junction',ref.componentId||ref.junctionId));
    const oldRoutes=new Map(document.electrical.wires.map(w=>[w.id,route(document,w)]));
    for(const c of document.electrical.components)if(selection.has(token('component',c.id))) {
      const p=document.layout.components[c.id];p.x+=dx;p.y+=dy;
    }
    for(const j of document.electrical.junctions)if(selection.has(token('junction',j.id))) {
      const p=document.layout.junctions[j.id];p.x+=dx;p.y+=dy;
    }
    for(const w of document.electrical.wires) {
      const movingStart=selected(w.from),movingEnd=selected(w.to);
      if(movingStart&&movingEnd) {
        for(const p of document.layout.wires[w.id].bends){p.x+=dx;p.y+=dy;}
      } else if(movingStart||movingEnd)retarget(document,w,oldRoutes.get(w.id));
    }
  }
  function retarget(document,wire,old) {
    if(old.length<=2){document.layout.wires[wire.id].bends=[];return;}
    const start=pin(document,wire.from),end=pin(document,wire.to),points=clone(old),n=points.length;
    const firstHorizontal=Math.abs(old[0].y-old[1].y)<.001;
    const lastHorizontal=Math.abs(old[n-1].y-old[n-2].y)<.001;
    if(distance(start,old[0])>.001){if(firstHorizontal)points[1].y=start.y;else points[1].x=start.x;}
    if(distance(end,old[n-1])>.001){if(lastHorizontal)points[n-2].y=end.y;else points[n-2].x=end.x;}
    points[0]=start;points[n-1]=end;
    document.layout.wires[wire.id].bends=clean(points).slice(1,-1);
  }
  function reshape(document,componentIds,change) {
    const routes=new Map(document.electrical.wires.map(w=>[w.id,route(document,w)]));
    change();
    for(const wire of document.electrical.wires) {
      const old=routes.get(wire.id);
      if(distance(pin(document,wire.from),old[0])>.001||distance(pin(document,wire.to),old.at(-1))>.001)retarget(document,wire,old);
    }
    connectContacts(document,componentIds);
  }

  function moveSegment(document,wireId,segment,dx,dy) {
    const wire=document.electrical.wires.find(w=>w.id===wireId),points=route(document,wire);
    const a=points[segment],b=points[segment+1];
    if(!a||!b)return;
    const horizontal=Math.abs(a.y-b.y)<.001;
    const offset=horizontal?{x:0,y:dy}:{x:dx,y:0};
    if(!offset.x&&!offset.y)return;
    const before=segment===0?[points[0]]:points.slice(0,segment);
    const after=segment+1===points.length-1?[points.at(-1)]:points.slice(segment+2);
    const updated=clean([...before,{x:a.x+offset.x,y:a.y+offset.y},
      {x:b.x+offset.x,y:b.y+offset.y},...after]);
    document.layout.wires[wireId].bends=updated.slice(1,-1);
  }
  function validate(document) {
    const assert=(ok,message)=>{if(!ok)throw new Error(message);};
    assert(document?.schemaVersion===1 && typeof document.id==='string'&&document.id.length>0&&typeof document.title==='string','Expected a version 1 circuit document');
    const e=document.electrical,l=document.layout;
    assert(e&&l&&Array.isArray(e.components)&&Array.isArray(e.junctions)&&Array.isArray(e.wires),'Missing circuit graph or layout');
    for(const map of [l.components,l.junctions,l.wires])assert(map&&typeof map==='object'&&!Array.isArray(map),'Missing layout maps');
    const ids=items=>{const set=new Set();for(const item of items){assert(item&&typeof item.id==='string'&&item.id&&!set.has(item.id),'Missing or duplicate ID');set.add(item.id);}return set;};
    const components=ids(e.components),junctions=ids(e.junctions);ids(e.wires);
    const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
    for(const c of e.components) {
      assert(Object.hasOwn(definitions,c.kind)&&c.modelVersion===1,'This editor supports R, C, DC source, switch and ground models');
      const p=l.components?.[c.id];assert(point(p)&&[0,90,180,270].includes(p.rotation)&&typeof p.mirror==='boolean','Invalid component pose');
      assert(typeof c.reference==='string'&&c.parameters&&typeof c.parameters==='object','Missing component reference or parameters');
      const v=c.parameters;
      if(c.kind==='resistor')assert(Number.isFinite(v.resistance)&&v.resistance>0,'Resistance must be positive');
      if(c.kind==='capacitor')assert(Number.isFinite(v.capacitance)&&v.capacitance>0&&Number.isFinite(v.initialVoltage)&&['backwardEuler','trapezoidal'].includes(v.integration),'Invalid capacitor parameters');
      if(c.kind==='voltageSource')assert(v.waveform?.kind==='dc'&&Number.isFinite(v.waveform.voltage),'Expected a finite DC voltage');
      if(c.kind==='switch')assert(typeof v.closed==='boolean','Invalid switch state');
    }
    for(const j of e.junctions)assert(point(l.junctions?.[j.id]),'Missing junction position');
    const endpoint=ref=>{
      if(ref?.kind==='junction')return junctions.has(ref.junctionId);
      if(ref?.kind!=='pin'||!components.has(ref.componentId))return false;
      const c=e.components.find(c=>c.id===ref.componentId);
      return Object.hasOwn(definitions[c.kind].pins,ref.pinId);
    };
    for(const w of e.wires)assert(endpoint(w.from)&&endpoint(w.to)&&Array.isArray(l.wires?.[w.id]?.bends)&&l.wires[w.id].bends.every(point),'Invalid wire endpoint or route');
    assert(Array.isArray(document.probes)&&document.simulation&&Number.isFinite(document.simulation.timeStep)&&document.simulation.timeStep>0,'Invalid probes or timestep');
    for(const p of document.probes)assert(p.kind==='voltage'?endpoint(p.positive)&&endpoint(p.negative):p.kind==='current'&&components.has(p.componentId),'Invalid probe target');
    return document;
  }
  function empty() {return {schemaVersion:1,id:crypto.randomUUID(),title:'Untitled circuit',electrical:{components:[],junctions:[],wires:[]},
    layout:{components:{},junctions:{},wires:{}},probes:[],simulation:{timeStep:1e-5}};}
  function connectionResolver(d) {
    const families=new Map();
    function resolve(target) {
      if(target.kind==='pin')return {kind:'pin',componentId:target.componentId,pinId:target.pinId};
      if(target.kind==='junction')return {kind:'junction',junctionId:target.junctionId};
      if(target.kind!=='wire')throw new Error('Connect to a pin, junction or wire');
      if(!families.has(target.id))families.set(target.id,[target.id]);
      const family=families.get(target.id);
      let wire,points,index;
      for(const wireId of family) {
        wire=d.electrical.wires.find(w=>w.id===wireId);points=route(d,wire);
        index=points.findIndex((p,i)=>i<points.length-1&&distance(closest(target.point,p,points[i+1]),target.point)<.01);
        if(index>=0)break;
      }
      if(index<0)throw new Error('Wire changed while connecting');
      if(distance(points[0],target.point)<.01)return clone(wire.from);
      if(distance(points.at(-1),target.point)<.01)return clone(wire.to);
      const junctionId=crypto.randomUUID(),wireId=crypto.randomUUID(),end=clone(wire.to);
      const ref={kind:'junction',junctionId};d.electrical.junctions.push({id:junctionId});d.layout.junctions[junctionId]=clone(target.point);
      wire.to=ref;d.layout.wires[wire.id].bends=clean([...points.slice(0,index+1),target.point]).slice(1,-1);
      d.electrical.wires.push({id:wireId,from:ref,to:end});
      d.layout.wires[wireId]={bends:clean([target.point,...points.slice(index+1)]).slice(1,-1)};family.push(wireId);return ref;
    }
    return resolve;
  }
  function connectContacts(document,componentIds) {
    const refKey=referenceKey;
    function connected(a,b) {
      const target=refKey(b),visited=new Set(),queue=[a];
      for(let i=0;i<queue.length;i++) {
        const ref=queue[i],key=refKey(ref);if(key===target)return true;if(visited.has(key))continue;visited.add(key);
        for(const w of document.electrical.wires){if(refKey(w.from)===key)queue.push(w.to);else if(refKey(w.to)===key)queue.push(w.from);}
      }
      return false;
    }
    function attach(from,to) {
      if(connected(from,to))return;
      const wireId=crypto.randomUUID();document.electrical.wires.push({id:wireId,from:clone(from),to:clone(to)});
      document.layout.wires[wireId]={bends:[]};
    }
    const resolve=connectionResolver(document);
    for(const c of document.electrical.components)if(componentIds.has(c.id))for(const pinId of Object.keys(definitions[c.kind].pins)) {
      const from={kind:'pin',componentId:c.id,pinId},point=pin(document,from);
      for(const other of document.electrical.components)if(other.id!==c.id)for(const otherPin of Object.keys(definitions[other.kind].pins)) {
        const to={kind:'pin',componentId:other.id,pinId:otherPin};
        if(distance(point,pin(document,to))<.001)attach(from,to);
      }
      for(const j of document.electrical.junctions)if(distance(point,document.layout.junctions[j.id])<.001)
        attach(from,{kind:'junction',junctionId:j.id});
      for(const wire of [...document.electrical.wires]) {
        if(connected(from,wire.from)||connected(from,wire.to))continue;
        const points=route(document,wire);
        if(points.some((p,i)=>i<points.length-1&&distance(closest(point,p,points[i+1]),point)<.001))
          attach(from,resolve({kind:'wire',id:wire.id,point}));
      }
    }
  }
  function junctionDots(document) {
    const refs=new Map(),parent=new Map(),counts=new Map();
    const key=referenceKey;
    function add(ref,count=0){const k=key(ref);if(!parent.has(k)){parent.set(k,k);refs.set(k,ref);counts.set(k,0);}counts.set(k,counts.get(k)+count);return k;}
    function find(k){while(parent.get(k)!==k)k=parent.get(k);return k;}
    for(const c of document.electrical.components)for(const p of Object.keys(definitions[c.kind].pins))add({kind:'pin',componentId:c.id,pinId:p},1);
    for(const j of document.electrical.junctions)add({kind:'junction',junctionId:j.id});
    for(const w of document.electrical.wires) {
      const a=add(w.from),b=add(w.to),points=route(document,w);
      if(distance(pin(document,w.from),pin(document,w.to))<.001)parent.set(find(a),find(b));
      if(points.length>1){counts.set(a,counts.get(a)+1);counts.set(b,counts.get(b)+1);}
    }
    const groups=new Map();
    for(const k of refs.keys()){const root=find(k);groups.set(root,(groups.get(root)||0)+counts.get(k));}
    return [...groups].filter(([,degree])=>degree>=3).map(([root,degree])=>({point:pin(document,refs.get(root)),degree}));
  }
  function create(initial,onChange=()=>{}) {
    let document=alignGrid(clone(validate(initial))),undo=[],redo=[];
    function transaction(label,change) {
      const next=clone(document);if(change(next)===false||same(next,document))return false;
      validate(next);undo.push({label,document});undo=undo.slice(-100);redo=[];document=next;onChange(clone(document),label);return true;
    }
    function history(from,to) {
      if(!from.length)return false;const item=from.pop();to.push({label:item.label,document});document=item.document;
      onChange(clone(document),item.label);return true;
    }
    return {get document(){return clone(document);},get canUndo(){return undo.length>0;},get canRedo(){return redo.length>0;},transaction,
      undo:()=>history(undo,redo),redo:()=>history(redo,undo),
      replace:next=>transaction('Open circuit',draft=>{for(const key of Object.keys(draft))delete draft[key];Object.assign(draft,alignGrid(clone(validate(next))));}),
      addComponent(kind,x,y,rotation=0) {
        const def=definitions[kind];if(!def)throw new Error('Unknown component');
        const componentId=crypto.randomUUID();
        transaction('Place '+def.name,d=>{
          let number=1;while(d.electrical.components.some(c=>c.reference===def.prefix+number))number++;
          d.electrical.components.push({id:componentId,kind,modelVersion:1,reference:def.prefix+number,parameters:clone(def.parameters)});
          d.layout.components[componentId]=placementPose(kind,{x,y},rotation);
          connectContacts(d,new Set([componentId]));
        });return componentId;
      },
      connect(from,to,bends=[]) {
        return transaction('Connect wire',d=>{
          const resolve=connectionResolver(d);
          const a=resolve(from),b=resolve(to);if(same(a,b))return false;
          const wireId=crypto.randomUUID();d.electrical.wires.push({id:wireId,from:a,to:b});
          d.layout.wires[wireId]={bends:clone(bends)};
        });
      },
      remove(selection) {
        return transaction('Delete selection',d=>{
          const cs=new Set(d.electrical.components.filter(c=>selection.has(token('component',c.id))).map(c=>c.id));
          const js=new Set(d.electrical.junctions.filter(j=>selection.has(token('junction',j.id))).map(j=>j.id));
          const removed=ref=>ref.kind==='pin'?cs.has(ref.componentId):js.has(ref.junctionId);
          d.electrical.wires=d.electrical.wires.filter(w=>{
            const deleted=selection.has(token('wire',w.id))||removed(w.from)||removed(w.to);
            if(deleted)delete d.layout.wires[w.id];return !deleted;
          });
          d.electrical.components=d.electrical.components.filter(c=>!cs.has(c.id));
          d.electrical.junctions=d.electrical.junctions.filter(j=>!js.has(j.id));
          for(const id of cs)delete d.layout.components[id];for(const id of js)delete d.layout.junctions[id];
          d.probes=d.probes.filter(p=>p.kind==='current'?!cs.has(p.componentId):!removed(p.positive)&&!removed(p.negative));
        });
      }
    };
  }
  function zoom(camera,point,factor) {
    const scale=Math.max(.2,Math.min(4,camera.scale*factor));
    return {scale,x:point.x-(point.x-camera.x)*scale/camera.scale,y:point.y-(point.y-camera.y)*scale/camera.scale};
  }
  globalThis.CircuitEditorModel={definitions,grid,snap,token,pin,route,closest,bounds,hit,move,moveSegment,validate,empty,create,zoom,placementPose,alignGrid,connectContacts,junctionDots,reshape,referenceKey};
})();
