// Real-time CDP runner: virtual-time fast forwarding can outrun worker messages.
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';

const [chrome, profile, url] = process.argv.slice(2);
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
  let complete = false;
  const deadline = Date.now() + 70000;
  while (Date.now() < deadline) {
    const evaluation = await command('Runtime.evaluate', {
      expression: `document.body?.dataset.status && document.body.dataset.status !== 'running' ? document.getElementById('result').textContent : null`,
      returnByValue: true
    }, sessionId);
    if (evaluation.result?.value) {
      const report = JSON.parse(evaluation.result.value);
      process.stdout.write(JSON.stringify(report) + '\n');
      complete = true;
      break;
    }
    await delay(50);
  }
  if (!complete) throw new Error('Browser checks did not complete within 70 seconds');
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
