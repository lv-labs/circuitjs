// Real-time CDP runner: virtual-time fast forwarding can outrun worker messages.
import {writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const [chrome, profile, url, screenshot] = process.argv.slice(2);
const browser = spawn(chrome, ['--headless', '--disable-gpu', '--no-first-run',
  '--no-default-browser-check', '--disable-background-timer-throttling',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  {stdio: ['ignore', 'ignore', 'pipe']});
let socket;
const pending = new Map();
let sequence = 0;
try {
  const endpoint = await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error('Chrome startup timed out: ' + log.slice(-2000))), 10000);
    browser.stderr.on('data', data => {
      log += data.toString();
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(log);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
    browser.on('error', error => { clearTimeout(timer); reject(error); });
    browser.on('exit', code => { clearTimeout(timer); reject(new Error('Chrome exited: ' + code + '\n' + log)); });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  socket.onmessage = ({data}) => {
    const message = JSON.parse(data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(new Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  };
  function command(method, params = {}, sessionId) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 10000);
      pending.set(id, {resolve, reject, timer});
      socket.send(JSON.stringify({id, method, params, ...(sessionId ? {sessionId} : {})}));
    });
  }
  const {targetId} = await command('Target.createTarget', {url});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  async function evaluate(expression) {
    const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
    if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result?.value;
  }
  async function waitFor(expression){const end=Date.now()+12000;while(Date.now()<end){if(await evaluate(expression))return;await delay(40);}throw new Error('Timed out: '+expression);}
  async function reload(){await evaluate("document.body.dataset.status='reloading'");await command('Page.reload',{},sessionId);await waitFor("document.body?.dataset.status==='ready' && !!document.querySelector('[data-component]')");await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
  async function key(key,code=key,modifiers=0){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers},sessionId);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers},sessionId);await delay(40);}
  async function pointer(x,y,type='mouseMoved'){await command('Input.dispatchMouseEvent',{type,x,y,...(type==='mouseMoved'?{}:{button:'left',clickCount:1})},sessionId);await delay(40);}
  async function click(x,y){await pointer(x,y,'mousePressed');await pointer(x,y,'mouseReleased');}
  async function center(selector){await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);return evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);}
  const doc=()=>evaluate("JSON.parse(localStorage.getItem('circuit-editor-prototype.v1'))");
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const checks=[];
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},sessionId);
  await waitFor("document.body?.dataset.status==='ready'");
  const initial=await doc();
  let p=await center('[data-component="r1"]');await pointer(p.x,p.y);
  await key('m','KeyM');await pointer(p.x+64,p.y+32);await key('r','KeyR');
  assert(JSON.stringify(await doc())===JSON.stringify(initial),'Preview must not autosave/commit');
  await key('Escape');assert(JSON.stringify(await doc())===JSON.stringify(initial),'Escape must cancel Move and rotation');
  checks.push('M hover pickup, R preview rotation and Escape cancellation');
  await key('m','KeyM');await pointer(p.x+128,p.y+64);await click(p.x+128,p.y+64);
  const moved=await doc();assert(moved.layout.components.r1.x!==initial.layout.components.r1.x,'M must move');
  assert(!moved.electrical.wires.some(w=>w.from.componentId==='r1'||w.to.componentId==='r1'),'M leaves external wires behind');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(initial),'Move undo restores full document');
  await key('z','KeyZ',10);assert(JSON.stringify(await doc())===JSON.stringify(moved),'Move redo restores exact IDs');
  await key('z','KeyZ',2);checks.push('M commit detaches, single undo and redo restore exact graph');
  p=await center('[data-component="r1"]');await pointer(p.x,p.y);await key('g','KeyG');await pointer(p.x+64,p.y+48);await click(p.x+64,p.y+48);
  const dragged=await doc();assert(JSON.stringify(dragged.electrical)===JSON.stringify(initial.electrical),'G preserves graph');
  assert(dragged.layout.components.r1.x!==initial.layout.components.r1.x,'G moves component');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(initial),'Drag undo');checks.push('G stretches connected wires with atomic undo');
  await key('r','KeyR');const rotated=await doc();assert(rotated.layout.components.r1.rotation===(initial.layout.components.r1.rotation+270)%360,'R rotates selected component');await key('z','KeyZ',2);
  await key('a','KeyA');assert(await evaluate("document.getElementById('component-chooser').open"),'A opens chooser');
  await command('Input.insertText',{text:'capacitor'},sessionId);await delay(40);
  assert(await evaluate("document.querySelectorAll('#component-list button').length===1"),'Chooser filters');
  await key('Enter');assert(!(await evaluate("document.getElementById('component-chooser').open")),'Enter chooses');
  await pointer(950,650);await key('r','KeyR');await click(950,650);await key('Escape');
  const placed=await doc();assert(placed.electrical.components.length===initial.electrical.components.length+1,'Chooser places component');
  assert(placed.electrical.components.at(-1).kind==='capacitor','Chooses capacitor');
  assert(placed.layout.components[placed.electrical.components.at(-1).id].rotation===270,'R rotates placement');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(initial),'Placement undo');
  await key('a','KeyA');await key('Escape');assert(!(await evaluate("document.getElementById('component-chooser').open")),'Escape closes chooser');
  checks.push('R rotation; A searchable chooser, Enter, placement rotation, Escape and undo');
  p=await center('[data-component="r1"]');await pointer(p.x,p.y);
  await key('e','KeyE');assert(await evaluate("document.activeElement.id==='value'"),'E focuses value');
  await command('Input.insertText',{text:'1234'},sessionId);await key('m','KeyM');assert(await evaluate("document.activeElement.id==='value'"),'Hotkeys do not steal inspector typing');
  assert(await evaluate("document.getElementById('component-properties').open"),'E opens properties dialog');
  await key('Escape');assert(JSON.stringify(await doc())===JSON.stringify(initial),'Cancel dialog preserves document');
  checks.push('E modal properties, cancellation and text input shortcut isolation');
  // Load a complete divider with a long top lead, then insert through real A/click input.
  await evaluate(`(async()=>{
    const d=await (await fetch('examples/voltage-divider.json')).json();
    d.layout.components.r1.x=400;d.layout.components.r2.x=560;
    d.layout.junctions['j-out'].x=560;d.layout.wires.w4.bends=[{x:560,y:240}];
    localStorage.setItem('circuit-editor-prototype.v1',JSON.stringify(d));
  })()`);
  await reload();
  const inlineBefore=await doc();
  const position=await evaluate(`(()=>{const m=document.querySelector('#canvas g').getScreenCTM();const p=new DOMPoint(240,80).matrixTransform(m);return {x:p.x,y:p.y}})()`);
  await key('a','KeyA');await command('Input.insertText',{text:'resistor'},sessionId);await key('Enter');
  await pointer(position.x,position.y);await click(position.x,position.y);await key('Escape');
  const inlineAfter=await doc(),inserted=inlineAfter.electrical.components.at(-1);
  assert(inserted.kind==='resistor'&&inlineAfter.electrical.components.length===inlineBefore.electrical.components.length+1,'Inline part placed');
  const solved=await evaluate(`(async()=>{
    const d=JSON.parse(localStorage.getItem('circuit-editor-prototype.v1')),id=d.electrical.components.at(-1).id;
    const simulation=CircuitSimulation.create();try {
      await simulation.setDocument(d);const frame=await simulation.step(1);
      return {output:frame.pinVoltages.r2.a,current:frame.componentCurrents[id]};
    }finally{simulation.dispose();}
  })()`);
  assert(Math.abs(solved.output-5/3)<1e-12,'Inserted resistor changes divider output to 5/3 V (no bypass)');
  assert(Math.abs(solved.current-5/3000)<1e-12,'Inserted resistor carries series current');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(inlineBefore),'Inline undo restores unsplit wire');
  await key('z','KeyZ',10);assert(JSON.stringify(await doc())===JSON.stringify(inlineAfter),'Inline redo restores exact split IDs');
  checks.push('A/click inline resistor, real worker output 5/3 V and 5/3000 A, exact undo/redo');
  await evaluate(`(()=>{
    const m=CircuitEditorModel.create(${JSON.stringify(inlineBefore)});m.addComponent('ground',240,80);
    localStorage.setItem('circuit-editor-prototype.v1',JSON.stringify(m.document));
  })()`);
  await reload();
  const protectedBefore=await doc();
  const branchPosition=await evaluate(`(()=>{const m=document.querySelector('#canvas g').getScreenCTM();const p=new DOMPoint(240,80).matrixTransform(m);return {x:p.x,y:p.y}})()`);
  await key('a','KeyA');await command('Input.insertText',{text:'resistor'},sessionId);await key('Enter');
  await pointer(branchPosition.x,branchPosition.y);await click(branchPosition.x,branchPosition.y);
  assert(JSON.stringify(await doc())===JSON.stringify(protectedBefore),'Rejected insertion must not change autosave');
  assert(await evaluate("document.getElementById('notice').textContent.includes('branch')"),'Branch rejection is explained');
  assert(await evaluate("document.getElementById('undo').disabled"),'Rejected placement creates no history item');await key('Escape');
  checks.push('Branch insertion rejected through pointer input, with explanation and no document/history changes');
  await evaluate(`localStorage.setItem('circuit-editor-prototype.v1',${JSON.stringify(JSON.stringify(inlineAfter))})`);
  await reload();
  // Switch single clicks toggle once; a double-click edits with no electrical event.
  await evaluate(`localStorage.setItem('circuit-editor-prototype.v1',${JSON.stringify(JSON.stringify(initial))})`);
  await reload();
  let sw=await center('[data-component="s1"]');await pointer(sw.x,sw.y);await click(sw.x,sw.y);
  await waitFor("JSON.parse(localStorage.getItem('circuit-editor-prototype.v1')).electrical.components.find(c=>c.id==='s1').parameters.closed===false");
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(initial),'Single switch click is one undo action');
  sw=await center('[data-component="s1"]');await click(sw.x,sw.y);await click(sw.x,sw.y);await delay(500);
  assert(await evaluate("document.getElementById('component-properties').open"),'Switch double-click opens editor');
  assert(JSON.stringify(await doc())===JSON.stringify(initial),'Switch double-click emits no toggle');await key('Escape');
  checks.push('Switch single click toggles once with undo; double-click opens properties without toggling');
  await evaluate(`(async()=>{const d=await (await fetch('examples/opamp-noninverting.json')).json();localStorage.setItem('circuit-editor-prototype.v1',JSON.stringify(d));})()`);
  await reload();
  await waitFor("!document.getElementById('run').disabled");
  const opBase=await doc();
  // Add an op-amp from A, flipping its placement preview, then undo it.
  await key('a','KeyA');await command('Input.insertText',{text:'opamp'},sessionId);await key('Enter');await key('x','KeyX');
  await pointer(1050,720);await click(1050,720);await key('Escape');
  const newOp=await doc(),newOpId=newOp.electrical.components.at(-1).id;
  assert(newOp.electrical.components.at(-1).kind==='opamp'&&newOp.layout.components[newOpId].mirror,'A adds op-amp with flipped preview');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(opBase),'Op-amp placement undo');
  p=await center('[data-component="u1"]');await pointer(p.x,p.y);await key('y','KeyY');
  const flipped=await doc();assert(JSON.stringify(flipped.electrical)===JSON.stringify(opBase.electrical),'Wired flip retains electrical identities');
  assert(flipped.layout.components.u1.rotation===180&&flipped.layout.components.u1.mirror,'Y reflects symbol vertically');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(opBase),'Flip undo');
  checks.push('Op-amp chooser and flipped placement, wired X/Y geometry and graph-preserving undo');
  // Place a non-loading voltage marker on a wire and read the accepted worker frame.
  let probeButton=await center('[data-tool="probe"]');await click(probeButton.x,probeButton.y);
  const outputPoint=await evaluate(`(()=>{const m=document.querySelector('#canvas g').getScreenCTM();const p=new DOMPoint(496,208).matrixTransform(m);return {x:p.x,y:p.y}})()`);
  await pointer(outputPoint.x,outputPoint.y);await click(outputPoint.x,outputPoint.y);await key('Escape');
  await waitFor("document.querySelector('[data-probe]')?.textContent.includes('2 V')");
  const probedDoc=await doc();assert(probedDoc.probes.length===1,'Probe placement saved');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(opBase),'Probe placement/split undo');
  await key('z','KeyZ',10);assert(JSON.stringify(await doc())===JSON.stringify(probedDoc),'Probe redo exact identities');
  checks.push('Probe placement on wire displays live 2 V, saves and undoes without solver loading');
  // Double-click edits values and reference atomically; invalid edits stay in the dialog.
  p=await center('[data-component="u1"]');await click(p.x,p.y);await click(p.x,p.y);
  assert(await evaluate("document.getElementById('component-properties').open"),'Double-click op-amp properties');
  assert(await evaluate("(()=>{const v=document.getElementById('value');return document.activeElement===v&&v.selectionStart===0&&v.selectionEnd===v.value.length})()"),'Double-click selects the entire main value');
  await command('Input.insertText',{text:'150k'},sessionId);assert(await evaluate("document.getElementById('value').value==='150k'"),'Typing immediately replaces the main value');
  async function setField(id,text){await evaluate(`document.getElementById(${JSON.stringify(id)}).focus();document.getElementById(${JSON.stringify(id)}).select()`);await command('Input.insertText',{text},sessionId);}
  await setField('value','0');let apply=await center('#properties button[type="submit"]');await click(apply.x,apply.y);
  assert(await evaluate("document.getElementById('property-error').textContent.includes('op-amp')"),'Invalid gain explained');
  assert(JSON.stringify(await doc())===JSON.stringify(probedDoc),'Invalid edit leaves document intact');
  await setField('value','200k');await setField('reference','U_BUF');await setField('minOutput','-12');await setField('maxOutput','12');await click(apply.x,apply.y);
  assert(!(await evaluate("document.getElementById('component-properties').open")),'Apply closes dialog');
  const edited=await doc(),editedOp=edited.electrical.components.find(c=>c.id==='u1');
  assert(editedOp.reference==='U_BUF'&&editedOp.parameters.gain===200000&&editedOp.parameters.minOutput===-12,'Properties committed together');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(probedDoc),'One undo restores all edited properties');
  await key('e','KeyE');await setField('reference','Cancelled');await key('Escape');assert(JSON.stringify(await doc())===JSON.stringify(probedDoc),'E dialog cancellation');
  checks.push('Double-click/E properties dialog, invalid gain, SI gain/limits/reference apply, one-step undo and cancellation');
  await key('a','KeyA');await command('Input.insertText',{text:'sine'},sessionId);await key('Enter');
  await pointer(1050,720);await click(1050,720);await key('Escape');
  const sinePlaced=await doc(),sinePart=sinePlaced.electrical.components.at(-1),sineId=sinePart.id;
  assert(sinePart.kind==='voltageSource'&&sinePart.parameters.waveform.kind==='sine','Sine preset uses supported source model');
  p=await center(`[data-component="${sineId}"]`);await click(p.x,p.y);await click(p.x,p.y);
  assert(await evaluate("(()=>{const v=document.getElementById('value');return v.selectionStart===0&&v.selectionEnd===v.value.length})()"),'Sine amplitude selected');
  await command('Input.insertText',{text:'2.5'},sessionId);await setField('frequency','0');await setField('offset','-.2');
  apply=await center('#properties button[type="submit"]');await click(apply.x,apply.y);
  assert(await evaluate("document.getElementById('property-error').textContent.length>0"),'Zero sine frequency rejected');
  assert(JSON.stringify(await doc())===JSON.stringify(sinePlaced),'Invalid sine properties remain uncommitted');
  await setField('frequency','2k');apply=await center('#properties button[type="submit"]');await click(apply.x,apply.y);
  const sineEdited=await doc(),sineWave=sineEdited.electrical.components.find(c=>c.id===sineId).parameters.waveform;
  assert(sineWave.amplitude===2.5&&sineWave.frequency===2000&&sineWave.offset===-.2,'Sine amplitude/frequency/offset committed');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(sinePlaced),'Sine properties single undo');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(probedDoc),'Sine placement undo');
  checks.push('Sine chooser, auto-selected amplitude, editable amplitude/frequency/offset, validation and atomic undo');
  async function worldPoint(x,y){return evaluate(`(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('#canvas g').getScreenCTM());return {x:p.x,y:p.y}})()`);}
  const looseBefore=await doc();let start=await worldPoint(432,208),bend=await worldPoint(496,256),end=await worldPoint(640,256);
  await key('w','KeyW');await click(start.x,start.y);await click(bend.x,bend.y);
  assert(JSON.stringify(await doc())===JSON.stringify(looseBefore),'Wire bends stay uncommitted');
  await pointer(end.x,end.y);await key('Enter');
  const looseDoc=await doc(),looseWire=looseDoc.electrical.wires.at(-1),looseJunction=looseWire.to.junctionId;
  assert(looseDoc.electrical.wires.length===looseBefore.electrical.wires.length+1,'Enter finishes one wire');
  assert(looseDoc.layout.junctions[looseJunction].x===640&&looseDoc.layout.junctions[looseJunction].y===256,'Loose endpoint stored on grid');
  await waitFor(`!!document.querySelector('[data-loose-end="${looseJunction}"]')`);
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(looseBefore),'Loose wire one-step undo');
  await key('z','KeyZ',10);assert(JSON.stringify(await doc())===JSON.stringify(looseDoc),'Loose wire redo exact IDs');
  await reload();assert(JSON.stringify(await doc())===JSON.stringify(looseDoc),'Loose wire reload');
  await key('Escape');
  end=await worldPoint(640,256);let drop=await worldPoint(256,304);
  await pointer(end.x,end.y,'mousePressed');await pointer(drop.x,drop.y);await key('Escape');await pointer(drop.x,drop.y,'mouseReleased');
  assert(JSON.stringify(await doc())===JSON.stringify(looseDoc),'Endpoint Escape discards preview');
  end=await worldPoint(640,256);drop=await worldPoint(256,304);
  await pointer(end.x,end.y,'mousePressed');await pointer(drop.x,drop.y);await pointer(drop.x,drop.y,'mouseReleased');
  const joinedDoc=await doc();
  assert(joinedDoc.electrical.wires.length===looseDoc.electrical.wires.length,'Endpoint drag reuses the existing wire');
  assert(!joinedDoc.electrical.junctions.some(j=>j.id===looseJunction),'Endpoint drag removes redundant loose junction');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(looseDoc),'Endpoint drag atomic undo');
  await key('z','KeyZ',10);assert(JSON.stringify(await doc())===JSON.stringify(joinedDoc),'Endpoint drag exact redo');
  await key('z','KeyZ',2);
  checks.push('Dedicated endpoint drag, cancellation, local cleanup and exact undo/redo');

  end=await worldPoint(640,256);let reconnect=await worldPoint(256,304);
  await key('w','KeyW');await click(end.x,end.y);await click(reconnect.x,reconnect.y);
  assert((await doc()).electrical.wires.length===looseDoc.electrical.wires.length+1,'Loose junction can start another wire: '+await evaluate("document.getElementById('notice').textContent"));
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(looseDoc),'Reconnection undo');
  start=await worldPoint(128,224);end=await worldPoint(80,160);
  await key('w','KeyW');await click(start.x,start.y);await click(end.x,end.y);await click(end.x,end.y);
  const doubleLoose=await doc();assert(doubleLoose.electrical.wires.length===looseDoc.electrical.wires.length+1,'Double-click empty space finishes wire');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(looseDoc),'Double-click loose wire undo');
  await key('w','KeyW');await click(start.x,start.y);await click(end.x,end.y);await key('Escape');
  assert(JSON.stringify(await doc())===JSON.stringify(looseDoc),'Escape cancels loose wire preview');
  checks.push('Enter/double-click loose wire endings, preview isolation, marker, undo/redo, reload, reconnection and Escape');
  await evaluate(`(async()=>{const d=await (await fetch('examples/opamp-sine.json')).json();localStorage.setItem('circuit-editor-prototype.v1',JSON.stringify(d));})()`);await reload();
  await waitFor("!document.getElementById('run').disabled");
  p=await center('[data-component="vin"]');await click(p.x,p.y);
  const waveformBefore=await doc();await key('e','KeyE');
  async function chooseWaveform(kind){await evaluate(`(()=>{const select=document.getElementById('waveform');select.value=${JSON.stringify(kind)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);}
  assert(await evaluate("document.querySelectorAll('#waveform option').length===6"),'Waveform choices available');
  await setField('value','.75');await setField('frequency','2k');await setField('offset','-.1');await chooseWaveform('square');
  assert(await evaluate("document.getElementById('value').value==='.75'&&document.getElementById('frequency').value==='2k'"),'Waveform selection preserves unsaved values');
  await setField('dutyCycle','25');await chooseWaveform('triangle');await chooseWaveform('square');
  assert(await evaluate("document.getElementById('dutyCycle').value==='25'"),'Duty draft retained when changing waves');
  assert(JSON.stringify(await doc())===JSON.stringify(waveformBefore),'Waveform choice is a draft');
  apply=await center('#properties button[type="submit"]');await click(apply.x,apply.y);
  const waveApplied=(await doc()).electrical.components.find(c=>c.id==='vin').parameters.waveform;
  assert(waveApplied.kind==='square'&&waveApplied.dutyCycle===.25&&waveApplied.frequency===2000&&waveApplied.amplitude===.75,'Waveform/duty properties apply together');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(waveformBefore),'Waveform change single undo');
  await key('e','KeyE');await chooseWaveform('dc');await setField('value','-2');await key('Escape');
  assert(JSON.stringify(await doc())===JSON.stringify(waveformBefore),'DC conversion draft cancels');
  checks.push('AC/DC waveform selector, six choices, shared/duty draft preservation, percent conversion, cancellation and one-step undo');
  for(const [preset,model,waveform] of [['acSource','voltageSource','sine'],['acRail','voltageRail','sine'],['voltageRail','voltageRail','dc'],['voltageSource','voltageSource','dc']]){
    const before=await doc();await key('a','KeyA');await command('Input.insertText',{text:preset},sessionId);
    assert(!(await evaluate("document.getElementById('component-list').textContent.includes('Sine source')")),'Chooser uses AC source naming');
    await key('Enter');await pointer(1050,750);await click(1050,750);await key('Escape');
    const after=await doc(),source=after.electrical.components.at(-1);
    assert(source.kind===model&&source.parameters.waveform.kind===waveform,'Correct AC/DC terminal-count preset');
    assert(await evaluate(`Object.keys(CircuitEditorModel.definitions[${JSON.stringify(model)}].pins).length===${model==='voltageRail'?1:2}`),'Correct visible terminal count');
    if(model==='voltageRail'){
      p=await center(`[data-component="${source.id}"]`);await click(p.x,p.y);await click(p.x,p.y);
      assert(await evaluate("document.getElementById('properties-title').textContent.includes('1 terminal')"),'Rail properties identify terminal count');
      await chooseWaveform('pulse');await setField('dutyCycle','100');apply=await center('#properties button[type="submit"]');await click(apply.x,apply.y);
      assert(await evaluate("document.getElementById('property-error').textContent.length>0"),'Invalid duty cycle explained');
      assert(JSON.stringify(await doc())===JSON.stringify(after),'Invalid rail duty does not commit');
      await key('Escape');
    }
    await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(before),'Source preset placement undo');
  }
  checks.push('AC source naming, all four AC/DC one/two-terminal presets, rail properties/duty validation and undo');
  await evaluate(`(async()=>{const d=await (await fetch('examples/opamp-ac-rail.json')).json();localStorage.setItem('circuit-editor-prototype.v1',JSON.stringify(d));})()`);await reload();
  await waitFor("!document.getElementById('run').disabled");await waitFor("document.querySelector('[data-probe]')?.textContent.includes('500 mV')");
  p=await center('[data-component="vin"]');await click(p.x,p.y);await key('e','KeyE');await chooseWaveform('square');await setField('dutyCycle','30');
  apply=await center('#properties button[type="submit"]');await click(apply.x,apply.y);
  await waitFor("document.querySelector('[data-probe]')?.textContent.includes('1.5 V')");
  checks.push('One-terminal AC source drives real op-amp/probe; changing waveform updates simulation');
  // Add a second voltage probe through the actual editor, then compare both traces.
  const inputPoint=await worldPoint(224,224);probeButton=await center('[data-tool="probe"]');await click(probeButton.x,probeButton.y);
  await click(inputPoint.x,inputPoint.y);await key('Escape');
  const inputProbe=(await doc()).probes.at(-1);await setField('probe-label','Vin');
  let rename=await center('#probe-properties button');await click(rename.x,rename.y);
  const scopeToggle=await center('#scope-toggle');await click(scopeToggle.x,scopeToggle.y);
  assert(await evaluate("document.getElementById('scope-toggle').getAttribute('aria-expanded')==='true'"),'Scope dock opens');
  assert(await evaluate("document.querySelectorAll('#scope-channels input').length===2"),'Both voltage probes available');
  let scopeRun=await center('#scope-run');await click(scopeRun.x,scopeRun.y);
  await waitFor("Number(document.getElementById('scope-panel').dataset.samples)>=250");
  scopeRun=await center('#scope-run');await click(scopeRun.x,scopeRun.y);await waitFor("document.getElementById('scope-status').textContent.includes('Paused')");
  await waitFor("document.querySelectorAll('[data-scope-trace]').length===2");
  const heldCount=await evaluate("document.getElementById('scope-panel').dataset.samples");await delay(100);
  assert(await evaluate("document.getElementById('scope-panel').dataset.samples")===heldCount,'Pause holds captured data');
  assert(await evaluate(`document.querySelector('[data-probe="${inputProbe.id}"] path').getAttribute('stroke')===document.querySelector('[data-scope-trace="${inputProbe.id}"]').getAttribute('stroke')`),'Probe and trace colors match');
  let checkbox=await center(`#scope-channels input[data-channel="${inputProbe.id}"]`);await click(checkbox.x,checkbox.y);await waitFor("document.querySelectorAll('[data-scope-trace]').length===1");
  await click(checkbox.x,checkbox.y);await waitFor("document.querySelectorAll('[data-scope-trace]').length===2");
  await evaluate("document.getElementById('scope-time').value='0.0005';document.getElementById('scope-time').dispatchEvent(new Event('change'));document.getElementById('scope-volts').value='1';document.getElementById('scope-volts').dispatchEvent(new Event('change'))");
  await waitFor("document.getElementById('scope-info').textContent.startsWith('1 V/div')");
  const plotCenter=await center('#scope-plot');await pointer(plotCenter.x,plotCenter.y);
  await waitFor("document.getElementById('scope-cursor-readings').textContent.includes('Cursor')&&document.getElementById('scope-cursor-readings').textContent.includes('Vin')&&document.getElementById('scope-cursor-readings').textContent.includes('Vout')");
  checks.push('Oscilloscope multi-probe capture, matching colors, pause, channel toggles, time/voltage scales and synchronized cursor');
  let clear=await center('#scope-clear');await click(clear.x,clear.y);await waitFor("document.getElementById('scope-panel').dataset.samples==='0'");
  let stepButton=await center('#step');await click(stepButton.x,stepButton.y);await waitFor("Number(document.getElementById('scope-panel').dataset.samples)>=10");
  let resetButton=await center('#reset');await click(resetButton.x,resetButton.y);await waitFor("document.getElementById('scope-panel').dataset.samples==='1'");
  await waitFor("document.getElementById('scope-cursor-readings').textContent.includes('t=0 s')");
  // Layout/label edits retain history; removing/undoing a channel begins aligned acquisition.
  await setField('probe-label','Vin AC');rename=await center('#probe-properties button');await click(rename.x,rename.y);
  assert(await evaluate("document.getElementById('scope-panel').dataset.samples==='1'"),'Probe rename preserves acquisition');
  await key('Delete');await waitFor("document.getElementById('scope-panel').dataset.channels==='1'");
  await key('z','KeyZ',2);await waitFor("document.getElementById('scope-panel').dataset.channels==='2'");
  assert(await evaluate("document.getElementById('scope-panel').dataset.samples==='0'"),'Changed channel set clears incompatible traces');
  checks.push('Scope Clear/Step/reset, zero-time restart, rename retention, probe removal/undo and channel-set isolation');
  p=await center('[data-component="vin"]');await click(p.x,p.y);await key('e','KeyE');await chooseWaveform('sine');
  apply=await center('#properties button[type="submit"]');await click(apply.x,apply.y);await waitFor("document.getElementById('scope-panel').dataset.samples==='1'");
  await evaluate("document.getElementById('scope-time').value='0.0002';document.getElementById('scope-time').dispatchEvent(new Event('change'));document.getElementById('scope-volts').value='auto';document.getElementById('scope-volts').dispatchEvent(new Event('change'))");
  scopeRun=await center('#scope-run');await click(scopeRun.x,scopeRun.y);await waitFor("Number(document.getElementById('scope-panel').dataset.samples)>=500");
  scopeRun=await center('#scope-run');await click(scopeRun.x,scopeRun.y);await waitFor("document.getElementById('scope-status').textContent.includes('Paused')");
  await waitFor("document.querySelectorAll('[data-scope-trace]').length===2");
  assert(await evaluate("[...document.querySelectorAll('[data-scope-trace]')].every(p=>!p.getAttribute('d').includes('NaN')&&p.getAttribute('d').length>1000)"),'Dense sine traces rendered without invalid points');
  checks.push('Source edit starts fresh scope run; real input/output sine waveforms plot together');
  const captureCount=await evaluate("document.getElementById('scope-panel').dataset.samples");
  const marker=await center(`[data-probe="${inputProbe.id}"] rect`),scale=await evaluate("document.querySelector('#canvas g').getScreenCTM().a");
  await pointer(marker.x,marker.y);await pointer(marker.x,marker.y,'mousePressed');await pointer(marker.x-48*scale,marker.y-48*scale);await pointer(marker.x-48*scale,marker.y-48*scale,'mouseReleased');
  const movedLabel=(await doc()).layout.probes[inputProbe.id];assert(movedLabel.x===-32&&movedLabel.y===-80,'Probe label drag commits its offset');
  assert(await evaluate("document.getElementById('scope-panel').dataset.samples")===captureCount,'Probe label drag preserves scope capture');
  let toggle=await center('#scope-toggle');await click(toggle.x,toggle.y);
  await waitFor("document.getElementById('scope-body').hidden");toggle=await center('#scope-toggle');await click(toggle.x,toggle.y);
  await waitFor("document.getElementById('scope-toggle').getAttribute('aria-expanded')==='true'");
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  await waitFor("document.querySelectorAll('[data-scope-trace]').length===2");
  assert(await evaluate("document.getElementById('scope-panel').dataset.samples")===captureCount,'Collapsing/reopening preserves capture');

  const addPane=await center('#scope-add');await click(addPane.x,addPane.y);
  await waitFor("document.querySelectorAll('[data-scope-trace]').length===4");
  assert(await evaluate("document.getElementById('scope-panel').dataset.samples")===captureCount,'Adding pane shares capture without advancing simulation');
  let paneChannel=await center('[data-pane="2"] input');await click(paneChannel.x,paneChannel.y);
  await waitFor("document.querySelectorAll('[data-pane=\"2\"] [data-scope-trace]').length===1");
  assert(await evaluate("document.querySelectorAll('#scope-plot [data-scope-trace]').length===2"),'Pane channel grouping independent');
  await evaluate("document.getElementById('scope-layout').value='side';document.getElementById('scope-layout').dispatchEvent(new Event('change'))");
  await waitFor("document.getElementById('scope-panes').dataset.layout==='side'");
  await evaluate("document.querySelector('[data-pane=\"2\"] select').value='2';document.querySelector('[data-pane=\"2\"] select').dispatchEvent(new Event('change'))");
  assert(await evaluate("document.getElementById('scope-volts').value==='auto'"),'Per-pane voltage scale independent');
  await evaluate("document.getElementById('scope-plot').dispatchEvent(new PointerEvent('pointermove',{clientX:document.getElementById('scope-plot').getBoundingClientRect().left+100}))");
  await waitFor("document.querySelectorAll('[data-scope-cursor]').length===2");
  assert(await evaluate("[...document.querySelectorAll('.scope-readings')].every(el=>el.textContent.startsWith('Cursor'))"),'Cursor synchronized across panes');
  let removePane=await center('[aria-label="Remove pane 2"]');await click(removePane.x,removePane.y);
  await waitFor("document.querySelectorAll('.scope-pane').length===1");
  assert(await evaluate("document.getElementById('scope-panel').dataset.samples")===captureCount,'Removing pane retains capture');
  for(const mode of ['dots','off','lines']){
    await evaluate(`document.getElementById('grid-mode').value='${mode}';document.getElementById('grid-mode').dispatchEvent(new Event('change'))`);
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    assert(await evaluate(mode==='lines'?"!!document.querySelector('#dots path')":mode==='dots'?"!!document.querySelector('#dots circle')":"document.querySelectorAll('#canvas > rect')[1].getAttribute('fill')==='none'"),'Grid display mode '+mode);
  }
  checks.push('Scope panes share capture/cursor with independent channels/scales, removal, side layout and grid modes');
  p=await center('[data-component="vin"]');await click(p.x,p.y);

  if(screenshot){
    await evaluate('document.activeElement.blur()');
    const shot=await command('Page.captureScreenshot',{format:'png'},sessionId);
    await writeFile(screenshot,Buffer.from(shot.data,'base64'));
    await key('e','KeyE');
    const properties=await command('Page.captureScreenshot',{format:'png'},sessionId);
    await writeFile(screenshot.replace(/\.png$/,'-properties.png'),Buffer.from(properties.data,'base64'));
  }
  process.stdout.write(JSON.stringify({status:'passed',checks})+'\n');
} catch (error) {
  process.stderr.write(String(error.stack || error) + '\n');
  process.exitCode = 1;
} finally {
  for (const request of pending.values()) clearTimeout(request.timer);
  socket?.close();
  browser.kill('SIGTERM');
  await Promise.race([new Promise(resolve => browser.once('exit', resolve)), delay(3000)]);
  if (browser.exitCode === null) browser.kill('SIGKILL');
}
