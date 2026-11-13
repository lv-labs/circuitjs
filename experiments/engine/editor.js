'use strict';
(async () => {
  const M=CircuitEditorModel,$=id=>document.getElementById(id),svg=$('canvas'),surface=$('surface');
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=value=>structuredClone(value),selection=new Set();
  let model,camera={x:0,y:0,scale:1},size={width:0,height:0},tool='select',rotation=0,mouse={x:0,y:0},hover=null;
  let gesture=null,preview=null,wireDraft=null,space=false,scheduled=false,ready=false,syncToken=0,simState=null;
  let lastBodyClick=null;
  let compiled=null,compileDocument=null;
  const keys={resistor:'R',capacitor:'C',voltageSource:'V',switch:'S',ground:'G'};
  const icons={resistor:'⊟',capacitor:'⊣',voltageSource:'⊕',switch:'⤴',ground:'⏚'};
  $('parts').innerHTML=Object.entries(M.definitions).map(([kind,def])=>`<button data-tool="${kind}"><span>${icons[kind]}</span>${def.name}<kbd>${keys[kind]}</kbd></button>`).join('');
  function symbol(c) {
    const leads='<path d="M-48 0H-24M24 0H48"/>';
    if(c.kind==='resistor')return leads+'<path d="M-24-8H24V8H-24Z"/>';
    if(c.kind==='capacitor')return '<path d="M-48 0H-5M5 0H48M-5-16V16M5-16V16"/>';
    if(c.kind==='switch')return '<path d="M-48 0H-20M20 0H48"/><circle cx="-20" cy="0" r="2.5"/><circle cx="20" cy="0" r="2.5"/>'+`<path d="M-18 0L18 ${c.parameters.closed?0:-18}"/>`;
    if(c.kind==='voltageSource')return '<circle r="24"/><path d="M0-48V-24M0 24V48M-6-9H6M0-15V-3M-6 10H6"/>';
    return '<path d="M0-32V0M-18 0H18M-12 7H12M-5 14H5"/>';
  }
  function format(n,unit='') {
    if(!Number.isFinite(n))return '—';
    if(Math.abs(n)<1e-15)n=0;
    const scale=[[1e9,'G'],[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'µ'],[1e-9,'n'],[1e-12,'p']].find(([s])=>Math.abs(n)>=s)||[1,''];
    return `${Number((n/scale[0]).toPrecision(4))} ${scale[1]}${unit}`.trim();
  }
  function value(c) {
    if(c.kind==='resistor')return format(c.parameters.resistance,'Ω');
    if(c.kind==='capacitor')return format(c.parameters.capacitance,'F');
    if(c.kind==='voltageSource')return format(c.parameters.waveform.voltage,'V');
    if(c.kind==='switch')return c.parameters.closed?'Closed':'Open';return '';
  }
  function local(event) {const r=svg.getBoundingClientRect();return {x:event.clientX-r.left,y:event.clientY-r.top};}
  function world(p) {return {x:(p.x-camera.x)/camera.scale,y:(p.y-camera.y)/camera.scale};}
  function selected(kind,id) {return selection.has(M.token(kind,id));}
  function requestRender() {if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;render();});}}
  function message(text) {$('notice').textContent=text;}
  function friendly(error) {
    const text=error?.message||String(error);
    if(/ground is required/i.test(text))return 'Add a ground connection to simulate.';
    if(/floating circuit/i.test(text))return 'Connect the remaining parts to a ground-referenced circuit.';
    if(/must contain components/i.test(text))return 'Choose a component to start building.';
    if(/ideal .*loop/i.test(text))return 'This connection creates an unsupported ideal loop. Undo or change the wiring.';
    return text;
  }
  function updateReadings() {
    const host=$('readings');if(!host)return;
    const c=model.document.electrical.components.find(c=>selected('component',c.id));
    if(!c)return;
    const frame=simState?.frame,pins=frame?.pinVoltages[c.id];
    host.innerHTML=Object.keys(M.definitions[c.kind].pins).map(p=>`<div class="reading"><span>Pin ${esc(p)}</span><span>${pins?format(pins[p],'V'):'—'}</span></div>`).join('')+
      (c.kind!=='ground'?`<div class="reading"><span>Current</span><span>${frame?format(frame.componentCurrents[c.id],'A'):'—'}</span></div>`:'');
  }
  function inspector() {
    const d=model.document,components=d.electrical.components.filter(c=>selected('component',c.id));
    const host=$('inspector');
    if(selection.size!==1||components.length!==1) {
      const only=selection.size===1?JSON.parse([...selection][0]):null;
      host.innerHTML=only?.[0]==='wire'?'<h2>Wire</h2><p class="subtle">Drag a segment to reroute it. Endpoint connections stay attached.<br><br>Use the Wire tool to add a branch. Delete removes this wire.</p>':
        only?.[0]==='junction'?'<h2>Junction</h2><p class="subtle">A shared electrical connection.<br><br>Drag to move it. Delete removes the attached wire segments.</p>':selection.size?`<h2>${selection.size} selected</h2><p class="subtle">Drag components together. Wires stay connected.<br><br>Q rotates selected parts.<br>Delete removes selected items.</p>`:
        '<h2>Your workspace</h2><p class="subtle">Select a component to edit its value and inspect voltages.<br><br>Click a pin to start a wire. Click another pin or an existing wire to connect.<br><br>Double-click a switch to open or close it.</p>';
      return;
    }
    const c=components[0];
    host.innerHTML=`<h2>${esc(c.reference)}</h2><p class="subtle">${M.definitions[c.kind].name}</p><form id="properties"><label for="reference">Reference</label><input id="reference" name="reference" value="${esc(c.reference)}" maxlength="80">`+
      (['resistor','capacitor','voltageSource'].includes(c.kind)?`<label for="value">${{resistor:'Resistance · Ω',capacitor:'Capacitance · F',voltageSource:'DC voltage · V'}[c.kind]}</label><input id="value" name="value" value="${c.kind==='resistor'?c.parameters.resistance:c.kind==='capacitor'?c.parameters.capacitance:c.parameters.waveform.voltage}" placeholder="e.g. 4.7k">`:'')+
      '<button type="submit">Apply changes</button></form>'+(c.kind==='switch'?`<button class="wide" id="toggle-switch">${c.parameters.closed?'Open':'Close'} switch</button>`:'')+'<div class="readings" id="readings"></div>';
    $('properties').onsubmit=event=>{
      event.preventDefault();
      try {
        const reference=$('reference').value.trim();if(!reference)throw new Error('Enter a component reference.');
        let number;
        if($('value')) {
          const input=$('value').value.trim();const match=/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([pnuµmkMG]?)$/i.exec(input);
          if(!match)throw new Error('Use a number, optionally followed by p, n, u, m, k, M or G.');
          const multipliers={p:1e-12,n:1e-9,u:1e-6,'µ':1e-6,m:1e-3,k:1e3,M:1e6,G:1e9,'':1};
          number=Number(match[1])*multipliers[match[2]];
          if(!Number.isFinite(number)||(c.kind!=='voltageSource'&&number<=0))throw new Error('Enter a finite, positive component value.');
        }
        model.transaction('Edit '+c.reference,next=>{
          const item=next.electrical.components.find(item=>item.id===c.id);item.reference=reference;
          if(c.kind==='resistor')item.parameters.resistance=number;
          if(c.kind==='capacitor')item.parameters.capacitance=number;
          if(c.kind==='voltageSource')item.parameters.waveform.voltage=number;
        });
      } catch(error){message(friendly(error));}
    };
    if($('toggle-switch'))$('toggle-switch').onclick=()=>toggle(c.id);
    updateReadings();
  }
  const simulation=CircuitSimulation.create({batchSteps:10,intervalMs:16,onFrame:()=>requestRender(),onState:state=>{
    simState=state;
    const label=state.status==='error'?'Editing':state.status==='stepping'?(state.runRequested?'Running':'Stepping'):state.status[0].toUpperCase()+state.status.slice(1);
    $('sim-state').textContent=label;$('sim-state').className='state'+(state.runRequested?' running':'');
    $('run').textContent=state.runRequested?'Ⅱ Pause':'▶ Run';$('run').classList.toggle('running',state.runRequested);
    $('run').disabled=!ready||['empty','loading','error','disposed'].includes(state.status);
    $('step').disabled=$('run').disabled||state.runRequested||['updating','stepping','pausing'].includes(state.status);
    $('reset').disabled=!ready||!state.accepted||state.status==='loading';
    if(state.error)message(friendly(state.error));
    updateReadings();requestRender();
  }});
  async function sync(d,label) {
    const token=++syncToken;compiled=null;compileDocument=null;
    try {
      const result=await simulation.setDocument(d);
      if(token!==syncToken)return;
      compiled=CircuitDocumentAdapter.compile(d);compileDocument=JSON.stringify(d.electrical);
      if(result.activated&&!simulation.getState().runRequested)await simulation.step(1);
      if(label)message(result.reused?label+' · connections unchanged':result.appliedAtTime!==undefined?label+' · simulation state preserved':label+' · simulation restarted');
    } catch(error){if(token===syncToken)message(friendly(error));}
    requestRender();
  }
  function changed(d,label) {
    preview=null;hover=null;wireDraft=null;lastBodyClick=null;
    const valid=new Set([...d.electrical.components.map(c=>M.token('component',c.id)),...d.electrical.wires.map(w=>M.token('wire',w.id)),...d.electrical.junctions.map(j=>M.token('junction',j.id))]);
    for(const key of selection)if(!valid.has(key))selection.delete(key);
    try {localStorage.setItem('circuit-editor-prototype.v1',JSON.stringify(d));$('save-status').textContent='Saved locally';}catch{$('save-status').textContent='Save JSON to keep your work';}
    $('project-title').textContent=d.title;inspector();controls();sync(d,label);requestRender();
  }
  function controls() {$('undo').disabled=!model?.canUndo;$('redo').disabled=!model?.canRedo;$('rotate').disabled=![...selection].some(k=>JSON.parse(k)[0]==='component');$('delete').disabled=!selection.size;}
  function setTool(next) {
    tool=next;wireDraft=null;gesture=null;preview=null;lastBodyClick=null;
    document.querySelectorAll('[data-tool]').forEach(button=>button.classList.toggle('active',button.dataset.tool===tool));
    $('tool-hint').textContent=tool==='select'?'Select · Shift adds · drag empty space for box selection':tool==='wire'?'Click a pin or wire to begin · click empty space for bends · Escape cancels':tool==='pan'?'Drag to pan the workspace':`Place ${M.definitions[tool].name.toLowerCase()} · Q rotates · Escape finishes`;
    svg.style.cursor=tool==='pan'?'grab':tool==='select'?'default':'crosshair';requestRender();
  }
  function fit() {
    if(!model||!size.width)return;
    const d=model.document,points=[];
    for(const c of d.electrical.components){const b=M.bounds(d,c);points.push({x:b.x,y:b.y},{x:b.right,y:b.bottom});}
    for(const j of d.electrical.junctions)points.push(d.layout.junctions[j.id]);
    for(const w of d.electrical.wires)points.push(...M.route(d,w));
    if(!points.length){camera={x:size.width/2,y:size.height/2,scale:1};requestRender();return;}
    const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
    const scale=Math.max(.2,Math.min(1.3,(size.width-150)/(right-left+50),(size.height-150)/(bottom-top+50)));
    camera={scale,x:size.width/2-(left+right)/2*scale,y:size.height/2-(top+bottom)/2*scale};requestRender();
  }
  function endpointPoint(target,d) {return target.kind==='wire'?target.point:M.pin(d,target);}
  function toggle(id) {model.transaction('Toggle switch',d=>{const c=d.electrical.components.find(c=>c.id===id);c.parameters.closed=!c.parameters.closed;});}
  function rotate(amount=90) {
    if(M.definitions[tool]){rotation=(rotation+amount+360)%360;requestRender();return;}
    model.transaction('Rotate selection',d=>M.reshape(d,new Set(d.electrical.components.filter(c=>selected('component',c.id)).map(c=>c.id)),()=>{
      for(const c of d.electrical.components)if(selected('component',c.id))d.layout.components[c.id].rotation=(d.layout.components[c.id].rotation+amount+360)%360;
    }));
  }
  function target(hit) {return hit&&['pin','junction','wire'].includes(hit.kind)?hit:null;}
  function render() {
    if(!model)return;const d=preview||model.document,frame=simState?.frame;
    const scale=camera.scale,grid=M.grid*scale;
    const parts=[`<defs><pattern id="dots" width="${grid}" height="${grid}" patternUnits="userSpaceOnUse" x="${camera.x%grid}" y="${camera.y%grid}"><circle cx="0" cy="0" r=".7" fill="#34404f"/></pattern></defs><rect width="100%" height="100%" fill="#11151c"/><rect width="100%" height="100%" fill="url(#dots)"/><g transform="translate(${camera.x} ${camera.y}) scale(${scale})">`];
    let terminalValues=new Map();
    if(frame&&compiled&&compileDocument===JSON.stringify(d.electrical))for(const net of compiled.nets) {
      const [id,p]=net.terminals[0],voltage=frame.pinVoltages[id]?.[p];
      for(const [cid,pid] of net.terminals)terminalValues.set(JSON.stringify(['pin',cid,pid]),voltage);
    }
    function voltage(ref) {
      if(ref.kind==='pin')return terminalValues.get(JSON.stringify(['pin',ref.componentId,ref.pinId]));
      const visited=new Set(),queue=[ref];
      for(let i=0;i<queue.length;i++) {
        const r=queue[i],k=M.referenceKey(r);if(visited.has(k))continue;visited.add(k);
        if(r.kind==='pin')return voltage(r);
        for(const w of d.electrical.wires)if(M.referenceKey(w.from)===k)queue.push(w.to);else if(M.referenceKey(w.to)===k)queue.push(w.from);
      }
    }
    const tint=v=>!Number.isFinite(v)?'#bbc9db':Math.abs(v)<1e-6?'#8f9fb3':v>0?'#91d6ba':'#e8b17b';
    for(const w of d.electrical.wires) {
      const points=M.route(d,w),path=points.map(p=>`${p.x},${p.y}`).join(' '),active=selected('wire',w.id);
      parts.push(`<polyline data-wire="${esc(w.id)}" points="${path}" fill="none" stroke="${active?'#91e8c1':tint(voltage(w.from))}" stroke-width="${active?3:2}" stroke-linejoin="round" stroke-linecap="round"/>`);
    }
    for(const c of d.electrical.components) {
      const p=d.layout.components[c.id],active=selected('component',c.id),def=M.definitions[c.kind];
      if(active){const b=M.bounds(d,c);parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.right-b.x}" height="${b.bottom-b.y}" rx="7" fill="#91e8c10b" stroke="#91e8c1" stroke-width="${1/scale}" stroke-dasharray="4 3"/>`);}
      parts.push(`<g data-component="${esc(c.id)}" transform="translate(${p.x} ${p.y}) rotate(${p.rotation}) scale(${p.mirror?-1:1} 1)" stroke="${active?'#91e8c1':'#e0e9f6'}" stroke-width="2" fill="#11151c" stroke-linecap="round" stroke-linejoin="round">${symbol(c)}</g>`);
      const vertical=c.kind==='voltageSource'?p.rotation%180===0:p.rotation%180!==0;
      const side=vertical||c.kind==='ground';
      const x=p.x+(side?31:0),y=p.y+(c.kind==='ground'?5:vertical?-7:-23),anchor=side?'start':'middle';
      if(scale>.45)parts.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#d1dbea" font-family="system-ui,sans-serif" font-size="12">${esc(c.reference)}</text><text x="${x}" y="${vertical?y+18:p.y+31}" text-anchor="${anchor}" fill="#8292a8" font-family="system-ui,sans-serif" font-size="11">${esc(value(c))}</text>`);
      for(const pinId of Object.keys(def.pins)) {
        const ref={kind:'pin',componentId:c.id,pinId},point=M.pin(d,ref);
        parts.push(`<circle data-pin="${esc(c.id+':'+pinId)}" cx="${point.x}" cy="${point.y}" r="3" fill="transparent" stroke="none" pointer-events="none"/>`);
      }
    }
    for(const dot of M.junctionDots(d))parts.push(`<circle data-connection-dot cx="${dot.point.x}" cy="${dot.point.y}" r="3.5" fill="#c5dfd5"/>`);
    for(const j of d.electrical.junctions)if(selected('junction',j.id)) {
      const p=d.layout.junctions[j.id];parts.push(`<rect data-junction="${esc(j.id)}" x="${p.x-6}" y="${p.y-6}" width="12" height="12" fill="none" stroke="#91e8c1"/>`);
    }
    if(target(hover)) {
      const p=endpointPoint(hover,d);parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${10/scale}" stroke="#91e8c1" stroke-width="${1/scale}" fill="#91e8c11a"/>`);
    }
    if(M.definitions[tool]) {
      const p=M.placementPose(tool,world(mouse),rotation),ghost={kind:tool,parameters:M.definitions[tool].parameters};
      parts.push(`<g transform="translate(${p.x} ${p.y}) rotate(${rotation})" stroke="#91e8c1" stroke-width="2" fill="none" opacity=".5" pointer-events="none">${symbol(ghost)}</g>`);
    }
    if(wireDraft) {
      const start=endpointPoint(wireDraft.from,d),end=target(hover)?endpointPoint(hover,d):{x:M.snap(world(mouse).x),y:M.snap(world(mouse).y)};
      const anchors=[start,...wireDraft.bends,end],points=[start];
      for(const p of anchors.slice(1)){const last=points.at(-1);if(last.x!==p.x&&last.y!==p.y)points.push({x:p.x,y:last.y});points.push(p);}
      parts.push(`<polyline points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" stroke="#91e8c1" stroke-width="2" fill="none" stroke-dasharray="5 4"/>`);
    }
    if(gesture?.type==='marquee') {
      const a=gesture.startWorld,b=world(mouse);parts.push(`<rect x="${Math.min(a.x,b.x)}" y="${Math.min(a.y,b.y)}" width="${Math.abs(a.x-b.x)}" height="${Math.abs(a.y-b.y)}" fill="#91e8c110" stroke="#91e8c1" stroke-width="${1/scale}"/>`);
    }
    parts.push('</g>');svg.innerHTML=parts.join('');
    $('zoom-value').textContent=Math.round(camera.scale*100)+'%';$('empty-hint').hidden=d.electrical.components.length>0;
    $('counts').textContent=`${d.electrical.components.length} parts · ${d.electrical.wires.filter(w=>M.route(d,w).length>1).length} wires`;
  }
  function selectHit(found,add) {
    const key=M.token(found.kind,found.id||found.junctionId);
    if(add){if(selection.has(key))selection.delete(key);else selection.add(key);}
    else if(!selection.has(key)){selection.clear();selection.add(key);}
    inspector();controls();requestRender();return selection.has(key);
  }
  svg.addEventListener('pointerdown',event=>{
    if(!ready||event.button===2)return;
    event.preventDefault();svg.focus();mouse=local(event);const p=world(mouse),d=model.document,found=M.hit(d,p,camera.scale);
    if(event.button===1||space||tool==='pan') {
      gesture={type:'pan',start:mouse,camera:{...camera}};svg.setPointerCapture(event.pointerId);svg.style.cursor='grabbing';return;
    }
    if(event.button!==0)return;
    if(M.definitions[tool]) {const id=model.addComponent(tool,p.x,p.y,rotation);selection.clear();selection.add(M.token('component',id));inspector();controls();requestRender();return;}
    if(tool==='wire'||wireDraft||found?.kind==='pin') {
      const endpoint=target(found);
      if(!wireDraft) {if(endpoint)wireDraft={from:clone(endpoint),bends:[]};else message('Start a wire on a pin, junction or existing wire.');}
      else if(endpoint) {
        try {model.connect(wireDraft.from,endpoint,wireDraft.bends);wireDraft=null;message('Wire connected. Crossings without a junction remain separate.');}
        catch(error){message(friendly(error));wireDraft=null;}
      } else wireDraft.bends.push({x:M.snap(p.x),y:M.snap(p.y)});
      requestRender();return;
    }
    if(found) {
      const collapse=!event.shiftKey&&selection.size>1&&selected(found.kind,found.id||found.junctionId);
      if(!selectHit(found,event.shiftKey))return;
      gesture={type:found.kind==='wire'?'wire-route':'move',base:d,startWorld:p,hit:found,dx:0,dy:0,collapse};
    } else {
      const prior=event.shiftKey?new Set(selection):new Set();if(!event.shiftKey)selection.clear();
      gesture={type:'marquee',startWorld:p,prior};inspector();controls();
    }
    svg.setPointerCapture(event.pointerId);requestRender();
  });
  svg.addEventListener('pointermove',event=>{
    if(!ready)return;mouse=local(event);const p=world(mouse);
    if(gesture?.type==='pan'){camera.x=gesture.camera.x+mouse.x-gesture.start.x;camera.y=gesture.camera.y+mouse.y-gesture.start.y;}
    else if(gesture && ['move','wire-route'].includes(gesture.type)) {
      const dx=M.snap(p.x-gesture.startWorld.x),dy=M.snap(p.y-gesture.startWorld.y);
      gesture.dx=dx;gesture.dy=dy;preview=clone(gesture.base);
      if(gesture.type==='move')M.move(preview,selection,dx,dy);else M.moveSegment(preview,gesture.hit.id,gesture.hit.segment,dx,dy);
    }
    hover=gesture?null:M.hit(model.document,p,camera.scale);requestRender();
  });
  svg.addEventListener('pointerup',event=>{
    const operation=gesture;gesture=null;preview=null;
    if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);
    svg.style.cursor=tool==='pan'?'grab':tool==='select'?'default':'crosshair';
    if(operation?.collapse&&!operation.dx&&!operation.dy) {
      selection.clear();selection.add(M.token(operation.hit.kind,operation.hit.id||operation.hit.junctionId));inspector();controls();
    }
    if(operation?.type==='move'&&(operation.dx||operation.dy))model.transaction('Drag selection',d=>{
      M.move(d,selection,operation.dx,operation.dy);
      M.connectContacts(d,new Set(d.electrical.components.filter(c=>selected('component',c.id)).map(c=>c.id)));
    });
    if(operation?.type==='wire-route'&&(operation.dx||operation.dy))model.transaction('Reroute wire',d=>M.moveSegment(d,operation.hit.id,operation.hit.segment,operation.dx,operation.dy));
    if(operation?.type==='move'&&!operation.dx&&!operation.dy&&operation.hit.kind==='component') {
      const now=performance.now(),point=local(event);
      if(lastBodyClick?.id===operation.hit.id&&now-lastBodyClick.time<450&&Math.hypot(point.x-lastBodyClick.x,point.y-lastBodyClick.y)<8) {
        if(model.document.electrical.components.find(c=>c.id===operation.hit.id)?.kind==='switch')toggle(operation.hit.id);
        lastBodyClick=null;
      } else lastBodyClick={id:operation.hit.id,time:now,...point};
    } else lastBodyClick=null;
    if(operation?.type==='marquee') {
      const a=operation.startWorld,b=world(local(event)),rect={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),right:Math.max(a.x,b.x),bottom:Math.max(a.y,b.y)};
      const inside=p=>p.x>=rect.x&&p.x<=rect.right&&p.y>=rect.y&&p.y<=rect.bottom;
      selection.clear();for(const key of operation.prior)selection.add(key);
      const d=model.document;
      for(const c of d.electrical.components){const p=d.layout.components[c.id];if(inside(p))selection.add(M.token('component',c.id));}
      for(const w of d.electrical.wires)if(M.route(d,w).every(inside))selection.add(M.token('wire',w.id));
      for(const j of d.electrical.junctions)if(inside(d.layout.junctions[j.id]))selection.add(M.token('junction',j.id));
      inspector();controls();
    }
    requestRender();
  });
  svg.addEventListener('pointercancel',()=>{gesture=null;preview=null;requestRender();});
  svg.addEventListener('wheel',event=>{
    event.preventDefault();if(gesture&&gesture.type!=='pan')return;
    if(event.ctrlKey||event.metaKey)camera=M.zoom(camera,local(event),Math.exp(-event.deltaY*.008));
    else {camera.x-=event.deltaX;camera.y-=event.deltaY;}
    requestRender();
  },{passive:false});
  svg.addEventListener('contextmenu',event=>event.preventDefault());
  function save() {
    const d=model.document,url=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)+'\n'],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=(d.title||'circuit').replace(/[^\w -]/g,'').trim()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Circuit JSON saved.');
  }
  $('save').onclick=save;$('open').onclick=()=>$('file').click();
  $('file').onchange=async()=>{try{const file=$('file').files[0];if(!file)return;model.replace(JSON.parse(await file.text()));selection.clear();inspector();setTool('select');fit();}catch(error){message(friendly(error));}finally{$('file').value='';}};
  $('new').onclick=()=>{selection.clear();model.replace(M.empty());setTool('select');fit();};
  $('undo').onclick=()=>{wireDraft=null;model.undo();};$('redo').onclick=()=>{wireDraft=null;model.redo();};
  $('delete').onclick=()=>model.remove(selection);$('rotate').onclick=()=>rotate();
  $('zoom-in').onclick=()=>{camera=M.zoom(camera,{x:size.width/2,y:size.height/2},1.2);requestRender();};
  $('zoom-out').onclick=()=>{camera=M.zoom(camera,{x:size.width/2,y:size.height/2},1/1.2);requestRender();};$('fit').onclick=fit;
  document.querySelectorAll('[data-tool]').forEach(button=>button.onclick=()=>setTool(button.dataset.tool));
  async function act(action){try{await action();}catch(error){message(friendly(error));}}
  $('run').onclick=()=>act(()=>simState?.runRequested?simulation.pause():simulation.run());
  $('step').onclick=()=>act(()=>simulation.step(10));$('reset').onclick=()=>act(async()=>{await simulation.reset();await simulation.step(1);});
  document.addEventListener('keydown',event=>{
    if(!ready||event.target.matches('input,textarea,select')||event.target.isContentEditable)return;
    const key=event.key.toLowerCase(),command=event.metaKey||event.ctrlKey;
    if(command&&key==='s'){event.preventDefault();save();return;}
    if(command&&key==='o'){event.preventDefault();$('file').click();return;}
    if(command&&key==='z'){event.preventDefault();wireDraft=null;event.shiftKey?model.redo():model.undo();return;}
    if(command)return;
    if(key===' '){event.preventDefault();space=true;svg.style.cursor='grab';return;}
    if(key==='escape'){gesture=null;preview=null;wireDraft=null;setTool('select');return;}
    if(key==='delete'||key==='backspace'){event.preventDefault();model.remove(selection);return;}
    if(key==='q'){event.preventDefault();rotate(event.shiftKey?-90:90);return;}
    if(key==='0'){fit();return;}
    if(key==='+'||key==='='||key==='-'){camera=M.zoom(camera,{x:size.width/2,y:size.height/2},key==='-'?1/1.2:1.2);requestRender();return;}
    if(key==='1'){setTool('select');return;}
    if(key==='w'||key==='h'){setTool(key==='w'?'wire':'pan');return;}
    const kind=Object.keys(keys).find(kind=>keys[kind].toLowerCase()===key);if(kind)setTool(kind);
  });
  window.addEventListener('keyup',event=>{if(event.key===' '){space=false;svg.style.cursor=tool==='pan'?'grab':tool==='select'?'default':'crosshair';}});
  window.addEventListener('blur',()=>{space=false;gesture=null;preview=null;requestRender();});
  window.addEventListener('pagehide',()=>simulation.dispose());
  new ResizeObserver(()=>{
    const rect=surface.getBoundingClientRect(),previous=size;size={width:rect.width,height:rect.height};
    svg.setAttribute('viewBox',`0 0 ${size.width} ${size.height}`);
    if(!previous.width&&model)fit();else{camera.x+=(size.width-previous.width)/2;camera.y+=(size.height-previous.height)/2;requestRender();}
  }).observe(surface);
  try {
    let initial;
    try {const stored=localStorage.getItem('circuit-editor-prototype.v1');if(stored)initial=M.validate(JSON.parse(stored));}catch{}
    if(!initial) {
      const response=await fetch('examples/switched-rc.json');if(!response.ok)throw new Error('Example circuit unavailable');initial=await response.json();
      initial.layout.components={v1:{x:160,y:240,rotation:0,mirror:false},r1:{x:304,y:192,rotation:0,mirror:false},s1:{x:464,y:192,rotation:0,mirror:false},c1:{x:608,y:272,rotation:90,mirror:false},r2:{x:752,y:272,rotation:90,mirror:false},g1:{x:304,y:400,rotation:0,mirror:false}};
      initial.layout.wires.w3.bends=[{x:608,y:192}];initial.layout.wires.w6.bends=[{x:304,y:320}];initial.layout.wires.w7.bends=[{x:160,y:376}];
    }
    model=M.create(initial,changed);ready=true;setTool('select');changed(model.document);fit();inspector();controls();requestRender();
    document.body.dataset.status='ready';
  } catch(error){message(friendly(error));document.body.dataset.status='failed';simulation.dispose();}
})();
