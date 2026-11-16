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
  const {targetId} = await command('Target.createTarget', {url:'about:blank'});
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
  await command('Page.navigate',{url},sessionId);
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},sessionId);
  await waitFor("document.body?.dataset.status==='ready'");
  await evaluate(`(()=>{const d=JSON.parse(localStorage.getItem('circuit-editor-prototype.v1'));d.electrical.junctions.push({id:'routing-end'});d.layout.junctions['routing-end']={x:800,y:480};d.electrical.wires.push({id:'routing-lead',from:{kind:'pin',componentId:'r1',pinId:'a'},to:{kind:'junction',junctionId:'routing-end'}});d.layout.wires['routing-lead']={bends:[]};localStorage.setItem('circuit-editor-prototype.v1',JSON.stringify(d));})()`);
  await reload();await key('Escape');
  const before=await doc();
  async function worldPoint(x,y){return evaluate(`(()=>{const p=new DOMPoint(${x},${y}).matrixTransform(document.querySelector('#canvas g').getScreenCTM());return {x:p.x,y:p.y}})()`);}
  let end=await center('[data-loose-end="routing-end"]');
  await click(end.x,end.y);
  let dest=await worldPoint(864,544);await pointer(dest.x,dest.y);
  assert(JSON.stringify(await doc())===JSON.stringify(before),'Click starts an uncommitted route');
  assert(await evaluate(`!!document.querySelector('#canvas polyline[stroke-dasharray]')`),'Click shows wire routing preview without W');
  await key('Escape');assert(JSON.stringify(await doc())===JSON.stringify(before),'Escape cancels route');
  end=await center('[data-loose-end="routing-end"]');await click(end.x,end.y);await pointer(dest.x,dest.y);await key('Enter');
  const extended=await doc();assert(Object.values(extended.layout.junctions).some(p=>p.x===864&&p.y===544),'Click then Enter extends the floating end');
  await key('z','KeyZ',2);assert(JSON.stringify(await doc())===JSON.stringify(before),'One-step route undo');
  end=await center('[data-loose-end="routing-end"]');dest=await worldPoint(864,512);
  await pointer(end.x,end.y,'mousePressed');await pointer(dest.x,dest.y);await pointer(dest.x,dest.y,'mouseReleased');
  const dragged=await doc();assert(dragged.layout.junctions['routing-end'].x===864&&dragged.layout.junctions['routing-end'].y===512,'Dragging still moves the existing endpoint');
  assert(!await evaluate(`!!document.querySelector('#canvas polyline[stroke-dasharray]')`),'Drag does not start a fresh route');
  process.stdout.write('Floating-end click routing passed: preview, Escape, completion, undo and drag-to-reconnect.\n');
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
