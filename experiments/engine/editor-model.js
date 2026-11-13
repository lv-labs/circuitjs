'use strict';
(() => {
  const clone=value=>structuredClone(value), grid=16;
  const definitions={
    resistor:{prefix:'R',name:'Resistor',pins:{a:[-48,0],b:[48,0]},parameters:{resistance:1000}},
    capacitor:{prefix:'C',name:'Capacitor',pins:{a:[-48,0],b:[48,0]},parameters:{capacitance:1e-6,initialVoltage:0,integration:'backwardEuler'}},
    voltageSource:{prefix:'V',name:'DC source (2 terminals)',pins:{p:[0,-48],n:[0,48]},parameters:{waveform:{kind:'dc',voltage:5}}},
    voltageRail:{prefix:'V',name:'DC source (1 terminal)',pins:{p:[0,32]},parameters:{waveform:{kind:'dc',voltage:5}}},
    switch:{prefix:'S',name:'Switch',pins:{a:[-48,0],b:[48,0]},parameters:{closed:true}},
    opamp:{prefix:'U',name:'Op-amp',pins:{minus:[-48,-16],plus:[-48,16],out:[48,0]},parameters:{gain:100000,minOutput:-15,maxOutput:15}},
    ground:{prefix:'G',name:'Ground',pins:{g:[0,-32]},parameters:{}}
  };
  const waveformNames={dc:'DC',sine:'Sine',square:'Square',triangle:'Triangle',sawtooth:'Sawtooth',pulse:'Pulse'};
  const placementDefinitions={...definitions,
    acSource:{...definitions.voltageSource,kind:'voltageSource',name:'AC source (2 terminals)',parameters:{waveform:{kind:'sine',amplitude:1,frequency:1000,offset:0}}},
    acRail:{...definitions.voltageRail,kind:'voltageRail',name:'AC source (1 terminal)',parameters:{waveform:{kind:'sine',amplitude:1,frequency:1000,offset:0}}}
  };
  function validWaveform(w) {
    return w?.kind==='dc'?Number.isFinite(w.voltage):['sine','square','triangle','sawtooth','pulse'].includes(w?.kind)&&
      Number.isFinite(w.amplitude)&&w.amplitude>=0&&Number.isFinite(w.frequency)&&w.frequency>0&&Number.isFinite(2*Math.PI*w.frequency)&&
      Number.isFinite(w.offset)&&Number.isFinite(w.offset+w.amplitude)&&Number.isFinite(w.offset-w.amplitude)&&
      (!['square','pulse'].includes(w.kind)||(Number.isFinite(w.dutyCycle)&&w.dutyCycle>0&&w.dutyCycle<1));
  }
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
  function placementPose(kind,point,rotation=0,mirror=false) {
    const def=definitions[kind]||placementDefinitions[kind],pins=Object.values(def.pins);
    const offset=pins.length===1?rotateOffset(pins[0][0]*(mirror?-1:1),pins[0][1],rotation):[0,0];
    return {x:snap(point.x)-offset[0],y:snap(point.y)-offset[1],rotation,mirror};
  }
  function flipPose(pose,axis) {
    pose.rotation=((axis==='x'?-pose.rotation:180-pose.rotation)+360)%360;
    pose.mirror=!pose.mirror;
  }
  function probePoint(document,probe) {
    const anchor=pin(document,probe.positive),offset=document.layout.probes?.[probe.id]||{x:16,y:-32};
    return {x:anchor.x+offset.x,y:anchor.y+offset.y};
  }
  function probeVoltage(document,probe,frame) {
    if(!frame)return undefined;
    function voltage(ref) {
      const queue=[ref],visited=new Set();
      for(let i=0;i<queue.length;i++) {
        const item=queue[i],key=referenceKey(item);if(visited.has(key))continue;visited.add(key);
        if(item.kind==='pin') {
          const value=frame.pinVoltages[item.componentId]?.[item.pinId];if(Number.isFinite(value))return value;
        }
        for(const w of document.electrical.wires)if(referenceKey(w.from)===key)queue.push(w.to);else if(referenceKey(w.to)===key)queue.push(w.from);
      }
    }
    const positive=voltage(probe.positive),negative=probe.reference==='ground'?0:voltage(probe.negative);
    return Number.isFinite(positive)&&Number.isFinite(negative)?positive-negative:undefined;
  }
  function scopeChannels(document) {
    function terminal(start) {
      const queue=[start],seen=new Set(),pins=[];
      for(let i=0;i<queue.length;i++){
        const ref=queue[i],key=referenceKey(ref);if(seen.has(key))continue;seen.add(key);
        if(ref.kind==='pin')pins.push(ref);
        for(const wire of document.electrical.wires)if(referenceKey(wire.from)===key)queue.push(wire.to);else if(referenceKey(wire.to)===key)queue.push(wire.from);
      }
      pins.sort((a,b)=>referenceKey(a)<referenceKey(b)?-1:referenceKey(a)>referenceKey(b)?1:0);
      return pins.length?{componentId:pins[0].componentId,pinId:pins[0].pinId}:null;
    }
    const channels=[],unresolved=[];
    for(const probe of document.probes)if(probe.kind==='voltage'){
      const positive=terminal(probe.positive),negative=probe.reference==='ground'?null:terminal(probe.negative);
      if(!positive||(probe.reference!=='ground'&&!negative)){unresolved.push(probe.id);continue;}
      channels.push({id:probe.id,label:probe.label||probe.id,positive,negative});
    }
    return {channels,unresolved};
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
    for(const probe of document.probes)if(probe.kind==='voltage'&&document.layout.probes?.[probe.id]){
      const p=probePoint(document,probe);if(point.x>=p.x-5&&point.x<=p.x+130&&Math.abs(point.y-p.y)<14/scale)return {kind:'probe',id:probe.id};
    }
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
      if(Math.abs(x)<(c.kind==='ground'?25:34) && Math.abs(y)<(['voltageSource','voltageRail','opamp'].includes(c.kind)?36:24))return {kind:'component',id:c.id};
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
    for(const probe of document.probes)if(selection.has(token('probe',probe.id))&&document.layout.probes?.[probe.id]){
      document.layout.probes[probe.id].x+=dx;document.layout.probes[probe.id].y+=dy;
    }
    for(const w of document.electrical.wires) {
      const movingStart=selected(w.from),movingEnd=selected(w.to);
      if(movingStart&&movingEnd) {
        for(const p of document.layout.wires[w.id].bends){p.x+=dx;p.y+=dy;}
      } else if(movingStart||movingEnd)retarget(document,w,oldRoutes.get(w.id));
    }
  }
  // Split only the selection boundary. Stationary wires keep their old geometry;
  // selected wires keep travelling with the selection. Shared ends share one stub.
  function detach(document,selection) {
    const moving=new Set(selection),stubs=new Map();
    const selected=ref=>moving.has(token(ref.kind==='pin'?'component':'junction',ref.componentId||ref.junctionId));
    const wires=document.electrical.wires;
    const contacts=new Set(wires.filter(w=>selected(w.from)!==selected(w.to)&&route(document,w).length===1).map(w=>w.id));
    for(const wire of wires) {
      const travels=selection.has(token('wire',wire.id))||(selected(wire.from)&&selected(wire.to));
      for(const end of ['from','to'])if(selected(wire[end])!==travels) {
        const original=wire[end],key=referenceKey(original)+':'+travels;
        if(!stubs.has(key)) {
          const id=crypto.randomUUID();document.electrical.junctions.push({id});
          document.layout.junctions[id]=clone(pin(document,original));
          stubs.set(key,{kind:'junction',junctionId:id});
          if(travels)moving.add(token('junction',id));
        }
        wire[end]=clone(stubs.get(key));
      }
    }
    // Collapse a zero-length boundary contact onto its stationary/travelling
    // neighbour, retaining any other branches that used the detached pin.
    const stubIds=new Set([...stubs.values()].map(ref=>ref.junctionId)),removedContacts=new Set();
    for(const contact of wires.filter(w=>contacts.has(w.id))) {
      if(!stubIds.has(contact.from.junctionId)&&!stubIds.has(contact.to.junctionId))continue;
      const stub=stubIds.has(contact.from.junctionId)?contact.from:contact.to;
      removedContacts.add(contact.id);
      const other=stub===contact.from?contact.to:contact.from;
      for(const wire of wires)if(wire!==contact)for(const end of ['from','to'])
        if(referenceKey(wire[end])===referenceKey(stub))wire[end]=clone(other);
      delete document.layout.wires[contact.id];
    }
    document.electrical.wires=wires.filter(w=>!removedContacts.has(w.id));
    for(const ref of stubs.values())if(!document.electrical.wires.some(w=>referenceKey(w.from)===referenceKey(ref)||referenceKey(w.to)===referenceKey(ref))) {
      document.electrical.junctions=document.electrical.junctions.filter(j=>j.id!==ref.junctionId);
      delete document.layout.junctions[ref.junctionId];moving.delete(token('junction',ref.junctionId));
    }
    return moving;
  }
  function transformSelection(document,selection,dx,dy,{disconnect=false,rotation=0,orientations=[],contacts=false}={}) {
    const moving=disconnect?detach(document,selection):selection;
    move(document,moving,dx,dy);
    const ids=new Set(document.electrical.components.filter(c=>selection.has(token('component',c.id))).map(c=>c.id));
    if(rotation||orientations.length)reshape(document,ids,()=>{
      for(const id of ids){const pose=document.layout.components[id];pose.rotation=(pose.rotation+rotation+360)%360;
        for(const operation of orientations)if(operation.axis)flipPose(pose,operation.axis);else pose.rotation=(pose.rotation+operation.rotate+360)%360;
      }
    },false);
    if(contacts)connectContacts(document,ids);
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
  function reshape(document,componentIds,change,contacts=true) {
    const routes=new Map(document.electrical.wires.map(w=>[w.id,route(document,w)]));
    change();
    for(const wire of document.electrical.wires) {
      const old=routes.get(wire.id);
      if(distance(pin(document,wire.from),old[0])>.001||distance(pin(document,wire.to),old.at(-1))>.001)retarget(document,wire,old);
    }
    if(contacts)connectContacts(document,componentIds);
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
      assert(Object.hasOwn(definitions,c.kind)&&c.modelVersion===1,'This editor supports R, C, DC source, switch, op-amp and ground models');
      const p=l.components?.[c.id];assert(point(p)&&[0,90,180,270].includes(p.rotation)&&typeof p.mirror==='boolean','Invalid component pose');
      assert(typeof c.reference==='string'&&c.parameters&&typeof c.parameters==='object','Missing component reference or parameters');
      const v=c.parameters;
      if(c.kind==='resistor')assert(Number.isFinite(v.resistance)&&v.resistance>0,'Resistance must be positive');
      if(c.kind==='capacitor')assert(Number.isFinite(v.capacitance)&&v.capacitance>0&&Number.isFinite(v.initialVoltage)&&['backwardEuler','trapezoidal'].includes(v.integration),'Invalid capacitor parameters');
      if(c.kind==='voltageSource'||c.kind==='voltageRail')assert(validWaveform(v.waveform),'Expected finite source values, nonnegative amplitude, positive AC frequency and duty cycle between 0 and 100%.');
      if(c.kind==='opamp')assert(Number.isFinite(v.gain)&&v.gain>0&&Number.isFinite(v.minOutput)&&Number.isFinite(v.maxOutput)&&v.minOutput<v.maxOutput&&Number.isFinite(v.maxOutput-v.minOutput),'Invalid op-amp gain or output limits');
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
    const probeIds=ids(document.probes);
    for(const p of document.probes)assert(p.kind==='voltage'?endpoint(p.positive)&&(p.reference==='ground'||endpoint(p.negative)):p.kind==='current'&&components.has(p.componentId),'Invalid probe target');
    if(l.probes){assert(typeof l.probes==='object'&&!Array.isArray(l.probes),'Invalid probe layout');for(const [id,pose] of Object.entries(l.probes))assert(probeIds.has(id)&&point(pose),'Invalid probe layout');}
    return document;
  }
  function empty() {return {schemaVersion:1,id:crypto.randomUUID(),title:'Untitled circuit',electrical:{components:[],junctions:[],wires:[]},
    layout:{components:{},junctions:{},wires:{}},probes:[],simulation:{timeStep:1e-5}};}
  function connectionResolver(d) {
    const families=new Map();
    function resolve(target) {
      if(target.kind==='pin')return {kind:'pin',componentId:target.componentId,pinId:target.pinId};
      if(target.kind==='junction')return {kind:'junction',junctionId:target.junctionId};
      if(target.kind==='point'){
        if(!target.point||!Number.isFinite(target.point.x)||!Number.isFinite(target.point.y))throw new Error('Expected a finite wire endpoint');
        const junctionId=crypto.randomUUID();d.electrical.junctions.push({id:junctionId});
        d.layout.junctions[junctionId]={x:snap(target.point.x),y:snap(target.point.y)};return {kind:'junction',junctionId};
      }
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
  function insertInline(document,componentId) {
    const component=document.electrical.components.find(c=>c.id===componentId);
    const pins=Object.keys(definitions[component.kind].pins);
    if(pins.length!==2)return false;
    const refs=pins.map(pinId=>({kind:'pin',componentId,pinId})),points=refs.map(ref=>pin(document,ref));
    const horizontal=points[0].y===points[1].y,axis=horizontal?'x':'y',cross=horizontal?'y':'x';
    const low=Math.min(...points.map(p=>p[axis])),high=Math.max(...points.map(p=>p[axis]));
    const onLine=p=>Math.abs(p[cross]-points[0][cross])<.001;
    // A symbol already wired to this span is being stretched, not inserted.
    const targets=points.map(point=>{
      const found=new Map();
      for(const wire of document.electrical.wires) {
        if([wire.from,wire.to].some(ref=>ref.componentId===componentId))continue;
        const path=route(document,wire);
        if(!path.some((a,i)=>i<path.length-1&&onLine(a)&&onLine(path[i+1])&&distance(closest(point,a,path[i+1]),point)<.001))continue;
        const target=distance(point,path[0])<.001?wire.from:distance(point,path.at(-1))<.001?wire.to:{kind:'wire',id:wire.id,point};
        found.set(target.kind==='wire'?token('wire',target.id):referenceKey(target),target);
      }
      return [...found.values()];
    });
    if(targets.some(items=>!items.length))return false;
    if(targets.some(items=>items.length!==1))throw new Error('Inline insertion is ambiguous here. Use a single wire span without overlapping wires.');
    const next=clone(document),resolve=connectionResolver(next),ends=targets.map(items=>resolve(items[0]));
    const key=referenceKey,eligible=next.electrical.wires.filter(w=>
      ![w.from,w.to].some(ref=>ref.componentId===componentId)&&route(next,w).every(p=>onLine(p)&&p[axis]>=low-.001&&p[axis]<=high+.001));
    const queue=[{ref:ends[0],edges:[],nodes:[ends[0]]}],visited=new Set();let path;
    for(let i=0;i<queue.length;i++) {
      const item=queue[i],k=key(item.ref);if(visited.has(k))continue;visited.add(k);
      if(k===key(ends[1])){path=item;break;}
      for(const wire of eligible){let other;if(key(wire.from)===k)other=wire.to;else if(key(wire.to)===k)other=wire.from;else continue;
        queue.push({ref:other,edges:[...item.edges,wire.id],nodes:[...item.nodes,other]});}
    }
    if(!path||!path.edges.length)return false;
    if(ends.some(end=>eligible.filter(w=>key(w.from)===key(end)||key(w.to)===key(end)).length>1))
      throw new Error('Inline insertion is ambiguous here. Remove overlapping or parallel bypass wires first.');
    const interior=path.nodes.slice(1,-1);
    const probed=ref=>next.probes.some(p=>p.kind==='voltage'&&[p.positive,p.negative].some(r=>r&&key(r)===key(ref)));
    if(interior.some(ref=>ref.kind!=='junction'||probed(ref)||next.electrical.wires.filter(w=>key(w.from)===key(ref)||key(w.to)===key(ref)).length!==2))
      throw new Error('Cannot insert across a branch, component pin or probe target. Choose a clear wire span.');
    const removed=new Set(path.edges),oldJunctions=new Set(document.electrical.junctions.map(j=>j.id));
    next.electrical.wires=next.electrical.wires.filter(w=>!removed.has(w.id));
    for(const id of removed)delete next.layout.wires[id];
    const removeJunctions=new Set(interior.map(ref=>ref.junctionId));
    for(let i=0;i<2;i++) {
      const end=ends[i];
      if(end.kind==='junction'&&!oldJunctions.has(end.junctionId)) {
        for(const wire of next.electrical.wires)for(const side of ['from','to'])if(key(wire[side])===key(end))wire[side]=clone(refs[i]);
        removeJunctions.add(end.junctionId);
      } else if(key(end)!==key(refs[i])) {
        const id=crypto.randomUUID();next.electrical.wires.push({id,from:clone(end),to:clone(refs[i])});next.layout.wires[id]={bends:[]};
      }
    }
    next.electrical.junctions=next.electrical.junctions.filter(j=>!removeJunctions.has(j.id));
    for(const id of removeJunctions)delete next.layout.junctions[id];
    Object.assign(document,next);return true;
  }
  function connectContacts(document,componentIds) {
    for(const id of componentIds)insertInline(document,id);
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
      addComponent(kind,x,y,rotation=0,mirror=false) {
        const def=placementDefinitions[kind==='sineSource'?'acSource':kind];if(!def)throw new Error('Unknown component');
        kind=def.kind||kind;
        const componentId=crypto.randomUUID();
        transaction('Place '+def.name,d=>{
          let number=1;while(d.electrical.components.some(c=>c.reference===def.prefix+number))number++;
          d.electrical.components.push({id:componentId,kind,modelVersion:1,reference:def.prefix+number,parameters:clone(def.parameters)});
          d.layout.components[componentId]=placementPose(kind,{x,y},rotation,mirror);
          connectContacts(d,new Set([componentId]));
        });return componentId;
      },
      addProbe(target) {
        const id=crypto.randomUUID();
        transaction('Place voltage probe',d=>{
          const positive=connectionResolver(d)(target);let number=1;while(d.probes.some(p=>p.label==='V'+number))number++;
          d.probes.push({id,kind:'voltage',positive,reference:'ground',label:'V'+number});
          (d.layout.probes||={})[id]={x:16,y:-32};
        });return id;
      },
      connect(from,to,bends=[]) {
        return transaction('Connect wire',d=>{
          if(to.kind==='point'){
            const start=from.kind==='wire'?from.point:pin(d,from),end={x:snap(to.point?.x),y:snap(to.point?.y)};
            if(distance(start,end)<.001&&bends.every(p=>distance(start,p)<.001))return false;
          }
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
          d.probes=d.probes.filter(p=>{const keep=!selection.has(token('probe',p.id))&&(p.kind==='current'?!cs.has(p.componentId):!removed(p.positive)&&(!p.negative||!removed(p.negative)));
            if(!keep&&d.layout.probes)delete d.layout.probes[p.id];return keep;});
        });
      }
    };
  }
  function zoom(camera,point,factor) {
    const scale=Math.max(.2,Math.min(4,camera.scale*factor));
    return {scale,x:point.x-(point.x-camera.x)*scale/camera.scale,y:point.y-(point.y-camera.y)*scale/camera.scale};
  }
  globalThis.CircuitEditorModel={definitions,placementDefinitions,waveformNames,validWaveform,grid,snap,token,pin,route,closest,bounds,hit,move,detach,transformSelection,moveSegment,validate,empty,create,zoom,placementPose,flipPose,probePoint,probeVoltage,scopeChannels,alignGrid,insertInline,connectContacts,junctionDots,reshape,referenceKey};
})();
