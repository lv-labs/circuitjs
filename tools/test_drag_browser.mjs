// Real-time CDP runner: virtual-time fast forwarding can outrun worker messages.
import {writeFile} from 'node:fs/promises';
import '../experiments/engine/editor-model.js';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const [chrome, profile, url, screenshot] = process.argv.slice(2);
const browser = spawn(chrome, ['--headless', '--disable-gpu', '--no-first-run',
  '--no-default-browser-check', '--disable-background-timer-throttling',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  {stdio: ['ignore', 'ignore', 'pipe']});
let socket;
const browserErrors=[];
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
    if(message.method==='Runtime.exceptionThrown')browserErrors.push(message.params.exceptionDetails);
    if(message.method==='Network.loadingFailed'||message.method==='Log.entryAdded')browserErrors.push(message.params);
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
  const {targetId} = await command('Target.createTarget', {url:'about:blank'});
  const {sessionId} = await command('Target.attachToTarget', {targetId, flatten: true});
  async function evaluate(expression) {
    const result=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
    if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result?.value;
  }
  async function waitFor(expression){const end=Date.now()+12000;while(Date.now()<end){if(await evaluate(expression))return;await delay(40);}throw new Error('Timed out: '+expression+' '+JSON.stringify(await evaluate(`({ready:document.readyState,status:document.body?.dataset.status,notice:document.getElementById('notice')?.textContent,model:typeof CircuitEditorModel,menu:typeof CircuitComponentMenu,resources:performance.getEntriesByType('resource').map(r=>r.name)})`)));}
  async function reload(){await evaluate("document.body.dataset.status='reloading'");await command('Page.reload',{},sessionId);await waitFor("document.body?.dataset.status==='ready' && !!document.querySelector('[data-component]')");await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');}
  async function key(key,code=key,modifiers=0){await command('Input.dispatchKeyEvent',{type:'keyDown',key,code,modifiers},sessionId);await command('Input.dispatchKeyEvent',{type:'keyUp',key,code,modifiers},sessionId);await delay(40);}
  async function pointer(x,y,type='mouseMoved'){await command('Input.dispatchMouseEvent',{type,x,y,...(type==='mouseMoved'?{}:{button:'left',clickCount:1})},sessionId);await delay(40);}
  async function click(x,y){await pointer(x,y,'mousePressed');await pointer(x,y,'mouseReleased');}
  async function center(selector){await waitFor(`!!document.querySelector(${JSON.stringify(selector)})`);return evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);}
  const doc=()=>evaluate("JSON.parse(localStorage.getItem('circuit-editor-prototype.v1'))");
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const checks=[];
  await command('Runtime.enable',{},sessionId);
  await command('Network.enable',{},sessionId);
  await command('Log.enable',{},sessionId);
  await command('Page.navigate',{url},sessionId);
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},sessionId);
  await waitFor("document.body?.dataset.status==='ready'");
  await evaluate(`(()=>{const M=CircuitEditorModel,d=M.empty();
    for(const [id,kind,x,y] of [['moving','resistor',256,192],['source','voltageRail',160,160],['ground','ground',512,320]]){d.electrical.components.push({id,kind,reference:id,modelVersion:1,parameters:structuredClone(M.definitions[kind].parameters)});d.layout.components[id]={x,y,rotation:0,mirror:false};}
    d.electrical.junctions.push({id:'corner'});d.layout.junctions.corner={x:512,y:192};
    const p=(componentId,pinId)=>({kind:'pin',componentId,pinId}),j={kind:'junction',junctionId:'corner'};
    for(const [id,from,to] of [['input',p('source','p'),p('moving','a')],['lead',p('moving','b'),j],['vertical',j,p('ground','g')]]){d.electrical.wires.push({id,from,to});d.layout.wires[id]={bends:[]};}
    localStorage.setItem('circuit-editor-prototype.v1',JSON.stringify(d));})()`);
  await reload();await key('Escape');const before=await doc();
  const canonical=()=>evaluate(`CircuitDocumentAdapter.compile(JSON.parse(localStorage.getItem('circuit-editor-prototype.v1'))).canonical`),originalNet=await canonical();
  async function worldPoint(x,y){return evaluate(`(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('#canvas g').getScreenCTM());return {x:p.x,y:p.y}})()`);}
  let start=await worldPoint(256,192),dest;
  await pointer(start.x,start.y,'mousePressed');
  for(const [x,y] of [[256,224],[288,256],[288,320],[288,352],[224,352],[224,160]]){dest=await worldPoint(x,y);await pointer(dest.x,dest.y);}
  assert(JSON.stringify(await doc())===JSON.stringify(before),'Pointer preview never autosaves');
  await key('Escape');await pointer(dest.x,dest.y,'mouseReleased');assert(JSON.stringify(await doc())===JSON.stringify(before),'Escape cancels all temporary geometry');
  start=await worldPoint(256,192);dest=await worldPoint(256,224);
  await pointer(start.x,start.y,'mousePressed');await pointer(dest.x,dest.y);await pointer(dest.x,dest.y,'mouseReleased');
  const dragged=await doc();assert(dragged.layout.components.moving.y===224,'Pointer component drag commits');assert(dragged.layout.junctions.corner.y===224,'Existing corner slides with the component');assert(await canonical()===originalNet,'Pointer drag preserves circuit nets');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(before),'Pointer drag is one undo');await key('z','KeyZ',10);assert(JSON.stringify(await doc())===JSON.stringify(dragged),'Redo restores the same segment IDs');await key('z','KeyZ',2);
  start=await worldPoint(256,192);await pointer(start.x,start.y);await key('g','KeyG');
  for(const [x,y] of [[256,224],[288,256],[288,320],[288,352],[224,352],[224,160]]){dest=await worldPoint(x,y);await pointer(dest.x,dest.y);}
  assert(JSON.stringify(await doc())===JSON.stringify(before),'G preview is isolated');await click(dest.x,dest.y);
  const g=await doc();assert(g.layout.components.moving.x===224&&g.layout.components.moving.y===160,'G commits the incremental gesture');assert(await canonical()===originalNet,'G drag preserves nets');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(before),'G drag is one undo');
  // The G gesture and pointer gesture must finalize the same incremental path.
  start=await worldPoint(256,192);await pointer(start.x,start.y,'mousePressed');
  for(const [x,y] of [[256,224],[288,256],[288,320],[288,352],[224,352],[224,160]]){dest=await worldPoint(x,y);await pointer(dest.x,dest.y);}
  await pointer(dest.x,dest.y,'mouseReleased');
  const direct=await doc();const geometry=d=>d.electrical.wires.map(w=>{const path=CircuitEditorModel.route(d,w),a=JSON.stringify(path),b=JSON.stringify([...path].reverse());return a<b?a:b;}).sort();
  assert(await canonical()===originalNet,'Reversal gesture preserves nets');assert(JSON.stringify(geometry(direct))===JSON.stringify(geometry(g)),'G and pointer share identical drag graph geometry');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(before),'Full reversal gesture has atomic undo');
  // Rotation and reflection are applied to the same session snapshot at commit.
  start=await worldPoint(256,192);await pointer(start.x,start.y);await key('g','KeyG');dest=await worldPoint(288,224);await pointer(dest.x,dest.y);await key('r','KeyR');await key('x','KeyX');await click(dest.x,dest.y);
  const flipped=await doc();assert(flipped.layout.components.moving.rotation!==before.layout.components.moving.rotation,'G flip keeps the transformed pose');for(const w of before.electrical.wires){const after=flipped.electrical.wires.find(a=>a.id===w.id);assert(JSON.stringify(CircuitEditorModel.route(flipped,after))===JSON.stringify(CircuitEditorModel.route(before,w)),'G flip leaves original wires in place');}await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(before),'G plus rotation/reflection is one undo');
  // Rotation alone during G must discard the connected-drag preview too.
  start=await worldPoint(256,192);await pointer(start.x,start.y);await key('g','KeyG');dest=await worldPoint(288,224);await pointer(dest.x,dest.y);await key('r','KeyR');
  assert(JSON.stringify(await doc())===JSON.stringify(before),'G rotation preview is uncommitted');await click(dest.x,dest.y);
  const rotatedDrag=await doc();assert(rotatedDrag.layout.components.moving.rotation===270,'G rotation changes pose');
  for(const w of before.electrical.wires){const after=rotatedDrag.electrical.wires.find(a=>a.id===w.id);assert(JSON.stringify(CircuitEditorModel.route(rotatedDrag,after))===JSON.stringify(CircuitEditorModel.route(before,w)),'G rotation keeps original wires stationary');}
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(before),'G rotation is one undo');
  start=await worldPoint(256,192);await pointer(start.x,start.y);await click(start.x,start.y);await key('r','KeyR');
  const rotated=await doc();assert(rotated.layout.components.moving.rotation===270,'Direct R rotates');
  for(const w of before.electrical.wires){const after=rotated.electrical.wires.find(a=>a.id===w.id);assert(JSON.stringify(CircuitEditorModel.route(rotated,after))===JSON.stringify(CircuitEditorModel.route(before,w)),'Direct R keeps original wires stationary');}
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(before),'Direct R is one undo');
  for(const axis of ['x','y']){
    start=await worldPoint(256,192);await pointer(start.x,start.y);await click(start.x,start.y);await key(axis,axis==='x'?'KeyX':'KeyY');
    const flipped=await doc();assert(JSON.stringify(flipped.layout.components.moving)!==JSON.stringify(before.layout.components.moving),'Direct flip changes the component pose');
    for(const w of before.electrical.wires){const after=flipped.electrical.wires.find(a=>a.id===w.id);assert(JSON.stringify(CircuitEditorModel.route(flipped,after))===JSON.stringify(CircuitEditorModel.route(before,w)),'Direct '+axis+' flip keeps wires stationary');}
    await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(before),'Direct '+axis+' flip is one undo');
  }
  // Move remains the disconnecting command and does not use connected dragging.
  start=await worldPoint(256,192);await pointer(start.x,start.y);await key('m','KeyM');dest=await worldPoint(288,224);await pointer(dest.x,dest.y);await click(dest.x,dest.y);
  const moved=await doc();assert(!moved.electrical.wires.some(w=>w.from.componentId==='moving'||w.to.componentId==='moving'),'M still leaves external wires behind');await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(before),'M undo remains exact');
  // Dropping a section over a stationary component pin creates the junction.
  await evaluate(`(()=>{const M=CircuitEditorModel,d=M.empty();d.electrical.components.push({id:'part',kind:'resistor',reference:'R1',modelVersion:1,parameters:{resistance:1000}});d.layout.components.part={x:128,y:128,rotation:0,mirror:false};for(const [id,x] of [['left',16],['right',144]]){d.electrical.junctions.push({id});d.layout.junctions[id]={x,y:64};}d.electrical.wires.push({id:'moving-wire',from:{kind:'junction',junctionId:'left'},to:{kind:'junction',junctionId:'right'}});d.layout.wires['moving-wire']={bends:[]};localStorage.setItem('circuit-editor-prototype.v1',JSON.stringify(d));})()`);
  await reload();await key('Escape');const wireBefore=await doc();
  for(const method of ['pointer','g']){
    start=await worldPoint(80,64);dest=await worldPoint(80,128);await pointer(start.x,start.y);
    if(method==='g')await key('g','KeyG');else await pointer(start.x,start.y,'mousePressed');
    await pointer(dest.x,dest.y);assert(JSON.stringify(await doc())===JSON.stringify(wireBefore),'Wire-on-pin preview is uncommitted');
    if(method==='g')await click(dest.x,dest.y);else await pointer(dest.x,dest.y,'mouseReleased');
    const connected=await doc();assert(connected.layout.components.part.x===128&&connected.layout.components.part.y===128,'Dropping the wire leaves the component stationary');
    await waitFor(`!!document.querySelector('[data-connection-dot][cx="80"][cy="128"]')`);
    assert(connected.electrical.wires.some(w=>w.from.componentId==='part'||w.to.componentId==='part'),method+' wire drop connects the component pin');
    await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(wireBefore),'Wire-to-pin junction is undone with the drag');
  }
  // A second consumer imports only the core ESM entry, without loading any
  // prototype HTML, renderer, legacy model globals or inspector code.
  const coreURL=new URL('core/',url).href;
  const separateTarget=await command('Target.createTarget',{url:coreURL});
  const separate=await command('Target.attachToTarget',{targetId:separateTarget.targetId,flatten:true});
  const standalone=await command('Runtime.evaluate',{expression:`(async()=>{
    const {editing,adapter,simulation,browserTransport,catalog}=await import(${JSON.stringify(new URL('index.mjs',coreURL).href)});
    const input=await(await fetch(${JSON.stringify(new URL('../examples/voltage-divider.json',coreURL).href)})).json();
    const editor=editing.create(input,()=>{},{wireSections:true});
    const run=simulation.create({autoRun:false,workerFactory:browserTransport.factory({url:${JSON.stringify(new URL('../revision-worker.js',coreURL).href)}})});
    try{
      await run.setDocument(editor.document);await run.step(10);
      const first=run.getState(),voltage=first.frame.pinVoltages.r2.a;
      editor.execute({type:'setParameters',componentId:'r1',parameters:{resistance:2000}});
      await run.setDocument(editor.document);await run.step(10);
      const second=run.getState();
      return {models:Object.keys(catalog.definitions).length,voltage,editedVoltage:second.frame.pinVoltages.r2.a,timeAdvanced:second.frame.time>first.frame.time,sameEpoch:second.accepted.runEpoch===first.accepted.runEpoch,legacyGlobals:typeof globalThis.CircuitEditorModel};
    }finally{await run.dispose();}
  })()`,returnByValue:true,awaitPromise:true},separate.sessionId);
  if(standalone.exceptionDetails)throw new Error('Standalone core browser: '+JSON.stringify(standalone.exceptionDetails));
  const consumer=standalone.result.value;
  assert(consumer.models===65&&consumer.legacyGlobals==='undefined','Fresh consumer has core metadata without the prototype');
  assert(Math.abs(consumer.voltage-2.5)<1e-10&&Math.abs(consumer.editedVoltage-5/3)<1e-10,'Fresh consumer edits and simulates a real divider');
  assert(consumer.timeAdvanced&&consumer.sameEpoch,'Fresh consumer retains native simulation state through edits');
  await command('Target.closeTarget',{targetId:separateTarget.targetId});
  if(screenshot){const shot=await command('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(screenshot,Buffer.from(shot.data,'base64'));}
  process.stdout.write('Drag browser passed: pointer/G incremental reversals, corner reuse, preview isolation, Escape, exact undo/redo, connectivity, disconnecting Move and an independent ESM core/worker consumer.\n');
} catch (error) {
  process.stderr.write(String(error.stack || error) + '\n'+JSON.stringify(browserErrors)+'\n');
  process.exitCode = 1;
} finally {
  for (const request of pending.values()) clearTimeout(request.timer);
  socket?.close();
  browser.kill('SIGTERM');
  await Promise.race([new Promise(resolve => browser.once('exit', resolve)), delay(3000)]);
  if (browser.exitCode === null) browser.kill('SIGKILL');
}
