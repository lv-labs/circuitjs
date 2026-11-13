'use strict';
(async () => {
  const M=CircuitEditorModel,P=M.placementDefinitions,$=id=>document.getElementById(id),svg=$('canvas'),surface=$('surface');
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=value=>structuredClone(value),selection=new Set();
  let model,camera={x:0,y:0,scale:1},size={width:0,height:0},tool='select',rotation=0,mirror=false,mouse={x:0,y:0},hover=null;
  let gesture=null,preview=null,wireDraft=null,space=false,scheduled=false,ready=false,syncToken=0,simState=null;
  let lastBodyClick=null;
  let compiled=null,compileDocument=null;
  let chooserIndex=0;
  const chooser=$('component-chooser'),search=$('component-search'),propertyDialog=$('component-properties');
  const icons={resistor:'⊟',capacitor:'⊣',voltageSource:'⊕',voltageRail:'⊕',acSource:'∿',acRail:'∿',switch:'⤴',ground:'⏚',opamp:'▷'};
  $('parts').innerHTML=Object.entries(P).map(([kind,def])=>{const name=/^(.*) \((.*)\)$/.exec(def.name);return `<button data-tool="${kind}"><span>${icons[kind]}</span><span class="part-name">${name?esc(name[1])+'<small>'+esc(name[2])+'</small>':esc(def.name)}</span></button>`;}).join('');
  function chooserItems(){return [...$('component-list').querySelectorAll('button')];}
  function chooseComponent(kind){chooser.close();setTool(kind);svg.focus();}
  function filterComponents(){
    const normalize=text=>text.toLowerCase().replace(/[^a-z0-9]/g,'');
    const query=normalize(search.value.trim());
    const entries=[...Object.entries(P),['probe',{name:'Voltage probe',prefix:'V'}]].filter(([kind,def])=>normalize(kind+' '+def.name+' '+def.prefix+' '+(def.parameters?.waveform?.kind||'')).includes(query));
    chooserIndex=0;
    $('component-list').innerHTML=entries.map(([kind,def])=>`<button type="button" data-kind="${kind}">${esc(def.name)} <span>${esc(def.prefix)}</span></button>`).join('')||'<p>No matching components</p>';
    for(const button of chooserItems())button.onclick=()=>chooseComponent(button.dataset.kind);
    markChoice();
  }
  function markChoice(){chooserItems().forEach((button,i)=>{button.classList.toggle('active',i===chooserIndex);button.setAttribute('aria-pressed',String(i===chooserIndex));});}
  function addComponent(){setTool('select');search.value='';filterComponents();chooser.showModal();search.focus();}
  search.oninput=filterComponents;
  chooser.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();chooser.close();}
    else if(['ArrowDown','ArrowUp'].includes(event.key)){
      event.preventDefault();const items=chooserItems();if(items.length)chooserIndex=(chooserIndex+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;markChoice();
    } else if(event.key==='Enter'){event.preventDefault();const button=chooserItems()[chooserIndex];if(button)chooseComponent(button.dataset.kind);}
    event.stopPropagation();
  });
  chooser.addEventListener('close',()=>svg.focus());
  $('close-chooser').onclick=()=>chooser.close();$('add-component').onclick=addComponent;
  function symbol(c) {
    const leads='<path d="M-48 0H-24M24 0H48"/>';
    if(c.kind==='resistor')return leads+'<path d="M-24-8H24V8H-24Z"/>';
    if(c.kind==='capacitor')return '<path d="M-48 0H-5M5 0H48M-5-16V16M5-16V16"/>';
    if(c.kind==='switch')return '<path d="M-48 0H-20M20 0H48"/><circle cx="-20" cy="0" r="2.5"/><circle cx="20" cy="0" r="2.5"/>'+`<path d="M-18 0L18 ${c.parameters.closed?0:-18}"/>`;
    if(c.kind==='opamp')return '<path d="M-48-16H-24M-48 16H-24M32 0H48M-24-32V32L32 0ZM-18-16H-10M-18 16H-10M-14 12V20"/>';
    if(isSource(c)) {
      const w=c.parameters.waveform,shapes={
        sine:'M-16 0C-12-20-4-20 0 0S12 20 16 0',square:'M-16 10V-10H0V10H16V-10',
        triangle:'M-16 10L-8-10L8 10L16-10',sawtooth:'M-16 10L0-10V10L16-10',pulse:'M-16 10H-8V-10H0V10H16'
      };
      return `<circle r="${c.kind==='voltageRail'?20:24}"/><path d="${c.kind==='voltageRail'?'M0 20V32':'M0-48V-24M0 24V48'}${w.kind==='dc'?'M-6-9H6M0-15V-3M-6 10H6':shapes[w.kind]}"/>`;
    }
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
    if(isSource(c)){const w=c.parameters.waveform;return w.kind!=='dc'?`${format(w.amplitude,'V')} pk · ${format(w.frequency,'Hz')} · ${format(w.offset,'V')} offset`:format(w.voltage,'V');}
    if(c.kind==='switch')return c.parameters.closed?'Closed':'Open';
    if(c.kind==='opamp')return `${format(c.parameters.minOutput,'V')} … ${format(c.parameters.maxOutput,'V')}`;return '';
  }
  function isSource(c){return c.kind==='voltageSource'||c.kind==='voltageRail';}
  function componentName(c){return isSource(c)?`${c.parameters.waveform.kind==='dc'?'DC':'AC'} source (${c.kind==='voltageRail'?'1 terminal':'2 terminals'})`:M.definitions[c.kind].name;}
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
  function cancelBodyClick() {if(lastBodyClick?.timer)clearTimeout(lastBodyClick.timer);lastBodyClick=null;}
  function inspector() {
    const d=model.document,components=d.electrical.components.filter(c=>selected('component',c.id)),host=$('inspector');
    if(selection.size===1&&components.length===1) {
      const c=components[0];
      host.innerHTML=`<h2>${esc(c.reference)}</h2><p class="subtle">${componentName(c)}<br>${esc(value(c))}</p><button id="edit-component" class="wide">Edit properties · E</button><div class="readings" id="readings"></div>`;
      $('edit-component').onclick=()=>editComponent(c.id);updateReadings();return;
    }
    const probe=d.probes.find(p=>selected('probe',p.id));
    host.innerHTML=probe?`<h2>${esc(probe.label||'Voltage probe')}</h2><p class="subtle">Voltage probe · plotted in Oscilloscope.<br>Drag the label to reposition it. Delete removes the marker.</p><form id="probe-properties" class="probe-name-form"><label for="probe-label">Probe name</label><input id="probe-label" value="${esc(probe.label||probe.id)}" maxlength="40" required><button type="submit">Rename probe</button></form>`:
      selection.size?`<h2>${selection.size} selected</h2><p class="subtle">M moves · G drags connected wires.<br>R rotates · X/Y flip.<br>Delete removes selected items.</p>`:
      '<h2>Your workspace</h2><p class="subtle">A adds a component or voltage probe.<br><br>Double-click a component or press E to edit its properties.<br><br>Single-click a switch to open or close it. Double-click edits without toggling.</p>';
    if(probe)$('probe-properties').onsubmit=event=>{event.preventDefault();const label=$('probe-label').value.trim();if(!label){message('Enter a probe name.');return;}model.transaction('Rename probe',next=>{next.probes.find(p=>p.id===probe.id).label=label;});};
  }
  function parseNumber(input) {
    const match=/^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([pnuµmkKMG]?)$/.exec(input.trim());
    if(!match)throw new Error('Use a number, optionally followed by p, n, u, m, k, M or G.');
    const number=Number(match[1])*({p:1e-12,n:1e-9,u:1e-6,'µ':1e-6,m:1e-3,k:1e3,K:1e3,M:1e6,G:1e9,'':1}[match[2]]);
    if(!Number.isFinite(number))throw new Error('Enter a finite number.');return number;
  }
  function editComponent(id) {
    cancelBodyClick();setTool('select');
    if(!id){if(!commandSelection())return;id=model.document.electrical.components.find(c=>selected('component',c.id))?.id;}
    const c=model.document.electrical.components.find(c=>c.id===id);if(!c)return;
    selection.clear();selection.add(M.token('component',id));inspector();controls();requestRender();
    const source=isSource(c),wave=c.parameters.waveform;
    const raw=source?{voltage:String(wave.voltage??0),amplitude:String(wave.amplitude??Math.abs(wave.voltage??1)),frequency:String(wave.frequency??1000),offset:String(wave.offset??0),dutyCycle:String((wave.dutyCycle??.5)*100)}:{};
    const sourceFields=kind=>kind==='dc'?[['voltage','DC voltage · V']]:[['amplitude','Amplitude · V peak'],['frequency','Frequency · Hz'],['offset','DC offset · V'],...(['square','pulse'].includes(kind)?[['dutyCycle','Duty cycle · %']]:[])];
    let fields=source?sourceFields(wave.kind):c.kind==='resistor'?[['resistance','Resistance · Ω']]:c.kind==='capacitor'?[['capacitance','Capacitance · F'],['initialVoltage','Initial voltage · V']]:
      c.kind==='opamp'?[['gain','Open-loop gain'],['minOutput','Minimum output · V'],['maxOutput','Maximum output · V']]:[];
    const numericFields=(entries,values)=>entries.map(([key,label],i)=>`<label for="${i===0?'value':key}">${label}</label><input id="${i===0?'value':key}" name="${key}" value="${esc(values[key])}" required>`).join('');
    $('properties-title').textContent=`${c.reference} · ${componentName(c)}`;
    $('property-fields').innerHTML=`<label for="reference">Reference</label><input id="reference" name="reference" value="${esc(c.reference)}" maxlength="80" required>`+
      (source?`<label for="waveform">Waveform</label><select id="waveform" name="waveform">${Object.entries(M.waveformNames).map(([kind,name])=>`<option value="${kind}">${name}</option>`).join('')}</select><div id="waveform-fields">${numericFields(fields,raw)}</div><p id="waveform-note"></p>`:numericFields(fields,c.parameters))+
      (c.kind==='switch'?`<label class="checkbox"><input name="closed" type="checkbox" ${c.parameters.closed?'checked':''}>Closed</label>`:'')+
      (c.kind==='capacitor'?`<label for="integration">Integration</label><select id="integration" name="integration"><option value="backwardEuler">Backward Euler</option><option value="trapezoidal">Trapezoidal</option></select>`:'')+
      (c.kind==='opamp'?'<p>Three-pin model with implicit supply limits. Input current is zero; output is limited by the minimum and maximum above.</p>':'');
    if(source) {
      $('waveform').value=wave.kind;
      const note=()=>{$('waveform-note').textContent=$('waveform').value==='dc'?(c.kind==='voltageRail'?'Voltage is relative to ground.':'Voltage is measured from the negative to positive terminal.'):$('waveform').value==='pulse'?'Pulse ranges from DC offset to offset + amplitude.':'Waveform swings about its DC offset; amplitude is peak volts.';};
      note();$('waveform').onchange=()=>{
        const form=$('properties');for(const [key] of fields)raw[key]=form.elements.namedItem(key).value;
        fields=sourceFields($('waveform').value);$('waveform-fields').innerHTML=numericFields(fields,raw);$('property-error').textContent='';note();$('value').focus();$('value').select();
      };
    }
    if(c.kind==='capacitor')$('integration').value=c.parameters.integration;
    $('property-error').textContent='';
    $('properties').onsubmit=event=>{
      event.preventDefault();try {
        const form=new FormData($('properties')),reference=String(form.get('reference')).trim();if(!reference)throw new Error('Enter a component reference.');
        const parameters=clone(c.parameters);
        if(source){parameters.waveform={kind:form.get('waveform')};for(const [key] of fields)parameters.waveform[key]=parseNumber(String(form.get(key)))/(key==='dutyCycle'?100:1);}
        else for(const [key] of fields)parameters[key]=parseNumber(String(form.get(key)));
        if(c.kind==='switch')parameters.closed=form.get('closed')==='on';
        if(c.kind==='capacitor')parameters.integration=form.get('integration');
        model.transaction('Edit '+c.reference,next=>{const item=next.electrical.components.find(item=>item.id===id);if(!item)throw new Error('Component no longer exists.');item.reference=reference;item.parameters=parameters;});
        propertyDialog.close();
      }catch(error){$('property-error').textContent=friendly(error);}
    };
    propertyDialog.showModal();const primary=$('value')||$('reference');primary.focus();primary.select();
  }
  $('cancel-properties').onclick=()=>propertyDialog.close();
  propertyDialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();propertyDialog.close();}event.stopPropagation();});
  propertyDialog.addEventListener('close',()=>svg.focus());
  const scope=CircuitScopeView.create({onRunToggle:()=>act(()=>simState?.runRequested?simulation.pause():simulation.run())});
  const simulation=CircuitSimulation.create({batchSteps:10,intervalMs:16,onFrame:frame=>{scope.onFrame(frame);requestRender();},onState:state=>{
    scope.onState(state);
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
    preview=null;hover=null;wireDraft=null;cancelBodyClick();
    simulation.setSampleChannels(scope.setDocument(d));
    const valid=new Set([...d.electrical.components.map(c=>M.token('component',c.id)),...d.electrical.wires.map(w=>M.token('wire',w.id)),...d.electrical.junctions.map(j=>M.token('junction',j.id)),...d.probes.map(p=>M.token('probe',p.id))]);
    for(const key of selection)if(!valid.has(key))selection.delete(key);
    try {localStorage.setItem('circuit-editor-prototype.v1',JSON.stringify(d));$('save-status').textContent='Saved locally';}catch{$('save-status').textContent='Save JSON to keep your work';}
    $('project-title').textContent=d.title;inspector();controls();sync(d,label);requestRender();
  }
  function controls() {$('undo').disabled=!model?.canUndo;$('redo').disabled=!model?.canRedo;$('rotate').disabled=![...selection].some(k=>JSON.parse(k)[0]==='component');$('delete').disabled=!selection.size;}
  function setTool(next) {
    tool=next;wireDraft=null;gesture=null;preview=null;cancelBodyClick();
    document.querySelectorAll('[data-tool]').forEach(button=>button.classList.toggle('active',button.dataset.tool===tool));
    $('tool-hint').textContent=tool==='select'?'Select · Shift adds · drag empty space for box selection':tool==='wire'?'Click a pin/wire to start · click for bends · double-click empty space or Enter to finish · Escape cancels':tool==='pan'?'Drag to pan the workspace':tool==='probe'?'Click a wire, pin or junction to place a voltage probe · Escape finishes':`Place ${P[tool].name.toLowerCase()} · R rotates · Escape finishes`;
    svg.style.cursor=tool==='pan'?'grab':tool==='select'?'default':'crosshair';requestRender();
  }
  function fit() {
    if(!model||!size.width)return;
    const d=model.document,points=[];
    for(const c of d.electrical.components){const b=M.bounds(d,c);points.push({x:b.x,y:b.y},{x:b.right,y:b.bottom});}
    for(const j of d.electrical.junctions)points.push(d.layout.junctions[j.id]);
    for(const probe of d.probes)if(d.layout.probes?.[probe.id])points.push(M.probePoint(d,probe));
    for(const w of d.electrical.wires)points.push(...M.route(d,w));
    if(!points.length){camera={x:size.width/2,y:size.height/2,scale:1};requestRender();return;}
    const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
    const scale=Math.max(.2,Math.min(1.3,(size.width-150)/(right-left+50),(size.height-150)/(bottom-top+50)));
    camera={scale,x:size.width/2-(left+right)/2*scale,y:size.height/2-(top+bottom)/2*scale};requestRender();
  }
  function endpointPoint(target,d) {return target.kind==='wire'?target.point:M.pin(d,target);}
  function toggle(id) {model.transaction('Toggle switch',d=>{const c=d.electrical.components.find(c=>c.id===id);c.parameters.closed=!c.parameters.closed;});}
  function commandSelection() {
    if(selection.size)return true;
    const found=M.hit(model.document,world(mouse),camera.scale);
    if(!found)return false;
    const kind=found.kind==='pin'?'component':found.kind,id=found.componentId||found.id||found.junctionId;
    selection.add(M.token(kind,id));inspector();controls();return true;
  }
  function updateTransform(p) {
    gesture.dx=M.snap(p.x-gesture.startWorld.x);gesture.dy=M.snap(p.y-gesture.startWorld.y);
    preview=clone(gesture.base);
    if(gesture.routeHit)M.moveSegment(preview,gesture.routeHit.id,gesture.routeHit.segment,gesture.dx,gesture.dy);
    else M.transformSelection(preview,gesture.selection,gesture.dx,gesture.dy,{disconnect:gesture.disconnect,rotation:gesture.rotation,orientations:gesture.orientations});
    requestRender();
  }
  function beginTransform(disconnect) {
    if(gesture||wireDraft)return;
    setTool('select');if(!commandSelection())return;
    gesture={type:'transform',base:model.document,startWorld:world(mouse),selection:new Set(selection),disconnect,rotation:0,orientations:[],dx:0,dy:0};
    const found=M.hit(model.document,world(mouse),camera.scale);
    if(!disconnect&&selection.size===1&&[...selection].every(k=>JSON.parse(k)[0]==='wire')){
      const id=JSON.parse([...selection][0])[1];gesture.routeHit=found?.kind==='wire'&&found.id===id?found:{id,segment:0};
    }
    updateTransform(world(mouse));message(`${disconnect?'Move · wires stay behind':'Drag · wires stay connected'} · click to place · R rotates · Escape cancels`);
  }
  function commitTransform() {
    const operation=gesture;gesture=null;preview=null;
    try {if(operation&&(operation.dx||operation.dy||operation.rotation||operation.orientations?.length))model.transaction(operation.disconnect?'Move selection':'Drag selection',d=>{
      if(operation.routeHit)M.moveSegment(d,operation.routeHit.id,operation.routeHit.segment,operation.dx,operation.dy);
      else M.transformSelection(d,operation.selection,operation.dx,operation.dy,{disconnect:operation.disconnect,rotation:operation.rotation,orientations:operation.orientations,contacts:!!(operation.dx||operation.dy||operation.disconnect)});
    });
    } catch(error){message(friendly(error));}
    setTool('select');
  }
  function rotate(amount=-90) {
    if(P[tool]){rotation=(rotation+amount+360)%360;requestRender();return;}
    if(gesture?.type==='transform'){if(gesture.routeHit)return;gesture.orientations.push({rotate:amount});updateTransform(world(mouse));return;}
    if(!commandSelection())return;
    try {model.transaction('Rotate selection',d=>M.transformSelection(d,selection,0,0,{rotation:amount,contacts:true}));}catch(error){message(friendly(error));}
  }
  function flip(axis) {
    if(P[tool]){const pose={rotation,mirror};M.flipPose(pose,axis);({rotation,mirror}=pose);requestRender();return;}
    if(gesture?.type==='transform'){if(gesture.routeHit)return;gesture.orientations.push({axis});updateTransform(world(mouse));return;}
    if(gesture||!commandSelection())return;
    try{model.transaction(axis==='x'?'Flip horizontally':'Flip vertically',d=>M.transformSelection(d,selection,0,0,{orientations:[{axis}]}));}catch(error){message(friendly(error));}
  }
  function target(hit) {return hit&&['pin','junction','wire'].includes(hit.kind)?hit:null;}
  function finishWire(endpoint) {
    if(!wireDraft)return;
    const draft=wireDraft,end=endpoint||{kind:'point',point:{x:M.snap(world(mouse).x),y:M.snap(world(mouse).y)}};
    const bends=clone(draft.bends);
    if(end.kind==='point'&&bends.length&&bends.at(-1).x===end.point.x&&bends.at(-1).y===end.point.y)bends.pop();
    try{model.connect(draft.from,end,bends);wireDraft=null;message(end.kind==='point'?'Wire finished with a loose end.':'Wire connected. Crossings without a junction remain separate.');}
    catch(error){message(friendly(error));wireDraft=null;}
    requestRender();
  }
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
      const vertical=isSource(c)?p.rotation%180===0:p.rotation%180!==0;
      const side=vertical||c.kind==='ground';
      const railBelow=c.kind==='voltageRail'&&M.pin(d,{kind:'pin',componentId:c.id,pinId:'p'}).y>=p.y;
      const x=p.x+(side?31:0),y=p.y+(c.kind==='ground'?5:c.kind==='voltageRail'&&vertical?(railBelow?-38:9):vertical?-7:c.kind==='opamp'?-44:-23),anchor=side?'start':'middle';
      const w=c.parameters.waveform,lines=isSource(c)&&w.kind!=='dc'?[format(w.amplitude,'V')+' pk',format(w.frequency,'Hz'),format(w.offset,'V')+' offset']:[value(c)];
      if(scale>.45)parts.push(`<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#d1dbea" font-family="system-ui,sans-serif" font-size="12">${esc(c.reference)}</text><text x="${x}" y="${vertical?y+18:p.y+(c.kind==='opamp'?47:31)}" text-anchor="${anchor}" fill="#8292a8" font-family="system-ui,sans-serif" font-size="11">${lines.map((line,i)=>`<tspan x="${x}" dy="${i?15:0}">${esc(line)}</tspan>`).join('')}</text>`);
      for(const pinId of Object.keys(def.pins)) {
        const ref={kind:'pin',componentId:c.id,pinId},point=M.pin(d,ref);
        parts.push(`<circle data-pin="${esc(c.id+':'+pinId)}" cx="${point.x}" cy="${point.y}" r="3" fill="transparent" stroke="none" pointer-events="none"/>`);
      }
    }
    for(const dot of M.junctionDots(d))parts.push(`<circle data-connection-dot cx="${dot.point.x}" cy="${dot.point.y}" r="3.5" fill="#c5dfd5"/>`);
    for(const j of d.electrical.junctions)if(d.electrical.wires.filter(w=>w.from.junctionId===j.id||w.to.junctionId===j.id).length===1){
      const p=d.layout.junctions[j.id];parts.push(`<rect data-loose-end="${esc(j.id)}" x="${p.x-3}" y="${p.y-3}" width="6" height="6" fill="#11151c" stroke="#bbc9db"/>`);
    }
    for(const j of d.electrical.junctions)if(selected('junction',j.id)) {
      const p=d.layout.junctions[j.id];parts.push(`<rect data-junction="${esc(j.id)}" x="${p.x-6}" y="${p.y-6}" width="12" height="12" fill="none" stroke="#91e8c1"/>`);
    }
    for(const probe of d.probes)if(probe.kind==='voltage'&&d.layout.probes?.[probe.id]) {
      const anchor=M.pin(d,probe.positive),label=M.probePoint(d,probe),active=selected('probe',probe.id);
      const color=CircuitScopeModel.color(probe.id),reading=M.probeVoltage(d,probe,compileDocument===JSON.stringify(d.electrical)?frame:null);
      parts.push(`<g data-probe="${esc(probe.id)}"><path d="M${anchor.x} ${anchor.y}L${label.x} ${label.y+4}" stroke="${color}" fill="none"/><circle cx="${anchor.x}" cy="${anchor.y}" r="3" fill="${color}"/><rect x="${label.x-5}" y="${label.y-14}" width="135" height="28" rx="4" fill="#25271f" stroke="${active?'#91e8c1':color}"/><text x="${label.x}" y="${label.y+4}" fill="${color}" font-size="12" font-family="system-ui,sans-serif">${esc(probe.label||'V')} · ${esc(format(reading,'V'))}</text></g>`);
    }
    if(target(hover)) {
      const p=endpointPoint(hover,d);parts.push(`<circle cx="${p.x}" cy="${p.y}" r="${10/scale}" stroke="#91e8c1" stroke-width="${1/scale}" fill="#91e8c11a"/>`);
    }
    if(P[tool]) {
      const p=M.placementPose(tool,world(mouse),rotation,mirror),ghost={kind:P[tool].kind||tool,parameters:P[tool].parameters};
      parts.push(`<g transform="translate(${p.x} ${p.y}) rotate(${rotation}) scale(${mirror?-1:1} 1)" stroke="#91e8c1" stroke-width="2" fill="none" opacity=".5" pointer-events="none">${symbol(ghost)}</g>`);
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
    if(gesture?.type==='transform'){if(event.button===0)commitTransform();return;}
    if(event.button===1||space||tool==='pan') {
      gesture={type:'pan',start:mouse,camera:{...camera}};svg.setPointerCapture(event.pointerId);svg.style.cursor='grabbing';return;
    }
    if(event.button!==0)return;
    if(P[tool]) {try{const id=model.addComponent(tool,p.x,p.y,rotation,mirror);selection.clear();selection.add(M.token('component',id));inspector();controls();requestRender();}catch(error){message(friendly(error));}return;}
    if(tool==='probe'){const endpoint=target(found);if(endpoint){try{const id=model.addProbe(endpoint);selection.clear();selection.add(M.token('probe',id));inspector();controls();}catch(error){message(friendly(error));}}else message('Place the voltage probe on a wire, pin or junction.');requestRender();return;}
    if(tool==='wire'||wireDraft||found?.kind==='pin') {
      const endpoint=target(found);
      if(!wireDraft) {if(endpoint)wireDraft={from:clone(endpoint),bends:[]};else message('Start a wire on a pin, junction or existing wire.');}
      else if(endpoint)finishWire(endpoint);
      else {
        const now=performance.now(),last=wireDraft.lastClick;
        if(last&&now-last.time<450&&Math.hypot(mouse.x-last.x,mouse.y-last.y)<8)finishWire();
        else {wireDraft.bends.push({x:M.snap(p.x),y:M.snap(p.y)});wireDraft.lastClick={...mouse,time:now};}
      }
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
    if(gesture?.type==='transform'){updateTransform(p);return;}
    if(gesture?.type==='pan'){camera.x=gesture.camera.x+mouse.x-gesture.start.x;camera.y=gesture.camera.y+mouse.y-gesture.start.y;}
    else if(gesture && ['move','wire-route'].includes(gesture.type)) {
      const dx=M.snap(p.x-gesture.startWorld.x),dy=M.snap(p.y-gesture.startWorld.y);
      if(dx||dy)cancelBodyClick();
      gesture.dx=dx;gesture.dy=dy;preview=clone(gesture.base);
      if(gesture.type==='move')M.move(preview,selection,dx,dy);else M.moveSegment(preview,gesture.hit.id,gesture.hit.segment,dx,dy);
    }
    hover=gesture?null:M.hit(model.document,p,camera.scale);requestRender();
  });
  svg.addEventListener('pointerup',event=>{
    if(gesture?.type==='transform')return;
    const operation=gesture;gesture=null;preview=null;
    if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);
    svg.style.cursor=tool==='pan'?'grab':tool==='select'?'default':'crosshair';
    if(operation?.collapse&&!operation.dx&&!operation.dy) {
      selection.clear();selection.add(M.token(operation.hit.kind,operation.hit.id||operation.hit.junctionId));inspector();controls();
    }
    try {if(operation?.type==='move'&&(operation.dx||operation.dy))model.transaction('Drag selection',d=>{
      M.move(d,selection,operation.dx,operation.dy);
      M.connectContacts(d,new Set(d.electrical.components.filter(c=>selected('component',c.id)).map(c=>c.id)));
    });
    } catch(error){message(friendly(error));}
    if(operation?.type==='wire-route'&&(operation.dx||operation.dy))model.transaction('Reroute wire',d=>M.moveSegment(d,operation.hit.id,operation.hit.segment,operation.dx,operation.dy));
    if(operation?.type==='move'&&!operation.dx&&!operation.dy&&operation.hit.kind==='component'&&!event.shiftKey) {
      const now=performance.now(),point=local(event),id=operation.hit.id;
      if(lastBodyClick?.id===id&&now-lastBodyClick.time<450&&Math.hypot(point.x-lastBodyClick.x,point.y-lastBodyClick.y)<8) {
        cancelBodyClick();editComponent(id);
      } else {
        cancelBodyClick();lastBodyClick={id,time:now,...point};
        if(model.document.electrical.components.find(c=>c.id===id)?.kind==='switch')lastBodyClick.timer=setTimeout(()=>{
          lastBodyClick=null;if(model.document.electrical.components.some(c=>c.id===id))toggle(id);
        },450);
      }
    } else cancelBodyClick();
    if(operation?.type==='marquee') {
      const a=operation.startWorld,b=world(local(event)),rect={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),right:Math.max(a.x,b.x),bottom:Math.max(a.y,b.y)};
      const inside=p=>p.x>=rect.x&&p.x<=rect.right&&p.y>=rect.y&&p.y<=rect.bottom;
      selection.clear();for(const key of operation.prior)selection.add(key);
      const d=model.document;
      for(const c of d.electrical.components){const p=d.layout.components[c.id];if(inside(p))selection.add(M.token('component',c.id));}
      for(const w of d.electrical.wires)if(M.route(d,w).every(inside))selection.add(M.token('wire',w.id));
      for(const j of d.electrical.junctions)if(inside(d.layout.junctions[j.id]))selection.add(M.token('junction',j.id));
      for(const probe of d.probes)if(d.layout.probes?.[probe.id]&&inside(M.probePoint(d,probe)))selection.add(M.token('probe',probe.id));
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
  $('undo').onclick=()=>{setTool('select');model.undo();};$('redo').onclick=()=>{setTool('select');model.redo();};
  $('move').onclick=()=>beginTransform(true);$('drag').onclick=()=>beginTransform(false);
  $('flip-horizontal').onclick=()=>flip('x');$('flip-vertical').onclick=()=>flip('y');
  $('delete').onclick=()=>{setTool('select');model.remove(selection);};$('rotate').onclick=()=>rotate();
  $('zoom-in').onclick=()=>{camera=M.zoom(camera,{x:size.width/2,y:size.height/2},1.2);requestRender();};
  $('zoom-out').onclick=()=>{camera=M.zoom(camera,{x:size.width/2,y:size.height/2},1/1.2);requestRender();};$('fit').onclick=fit;
  document.querySelectorAll('[data-tool]').forEach(button=>button.onclick=()=>setTool(button.dataset.tool));
  async function act(action){try{await action();}catch(error){message(friendly(error));}}
  $('run').onclick=()=>act(()=>simState?.runRequested?simulation.pause():simulation.run());
  $('step').onclick=()=>act(()=>simulation.step(10));$('reset').onclick=()=>act(async()=>{await simulation.reset();await simulation.step(1);});
  document.addEventListener('keydown',event=>{
    if(chooser.open||propertyDialog.open)return;
    if(!ready||event.target.matches('input,textarea,select')||event.target.isContentEditable)return;
    const key=event.key.toLowerCase(),command=event.metaKey||event.ctrlKey;
    if(command&&key==='s'){event.preventDefault();save();return;}
    if(command&&key==='o'){event.preventDefault();$('file').click();return;}
    if(command&&key==='z'){event.preventDefault();setTool('select');event.shiftKey?model.redo():model.undo();return;}
    if(command)return;
    if(key===' '){event.preventDefault();space=true;svg.style.cursor='grab';return;}
    if(key==='escape'){gesture=null;preview=null;wireDraft=null;setTool('select');return;}
    if(key==='enter'&&wireDraft){event.preventDefault();finishWire(target(M.hit(model.document,world(mouse),camera.scale)));return;}
    if(key==='delete'||key==='backspace'){event.preventDefault();if(gesture)return;if(commandSelection())model.remove(selection);return;}
    if(event.repeat)return;
    if(key==='a'){event.preventDefault();addComponent();return;}
    if(key==='m'||key==='g'){event.preventDefault();beginTransform(key==='m');return;}
    if(key==='r'){if(gesture&&gesture.type!=='transform')return;event.preventDefault();rotate(event.shiftKey?90:-90);return;}
    if(key==='x'||key==='y'){event.preventDefault();flip(key);return;}
    if(gesture)return;
    if(key==='e'){event.preventDefault();editComponent();return;}
    if(key==='p'){event.preventDefault();setTool('ground');return;}
    if(key==='0'){fit();return;}
    if(key==='+'||key==='='||key==='-'){camera=M.zoom(camera,{x:size.width/2,y:size.height/2},key==='-'?1/1.2:1.2);requestRender();return;}
    if(key==='1'){setTool('select');return;}
    if(key==='w'||key==='h'){setTool(key==='w'?'wire':'pan');return;}

  });
  window.addEventListener('keyup',event=>{if(event.key===' '){space=false;svg.style.cursor=tool==='pan'?'grab':tool==='select'?'default':'crosshair';}});
  window.addEventListener('blur',()=>{space=false;gesture=null;preview=null;cancelBodyClick();requestRender();});
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
