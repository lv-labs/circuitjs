'use strict';
// Optional environment adapter. Worker construction happens only in create().
(() => {
  const registry=globalThis.CircuitCoreModules ||= {};
  function create({url, WorkerClass=globalThis.Worker, sessionId = crypto.randomUUID(),
    timeoutMs = 10000, onFailure = () => {}} = {}) {
  if(!url||typeof WorkerClass!=='function')throw new Error('A worker URL and Worker constructor are required');
  const worker = new WorkerClass(url);
  const pending = new Map();
  let nextID = 0, stopped = false, initialized = false;
  let state = {documentId: null, circuitRevision: 0, runEpoch: 0};
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => {resolveReady = resolve; rejectReady = reject;});
  function stop(cause, notify = true) {
    if (stopped) return;
    stopped = true; clearTimeout(startup); worker.terminate(); rejectReady(cause);
    for (const item of pending.values()) {clearTimeout(item.timer); item.reject(cause);}
    pending.clear();
    if (notify) onFailure(cause);
  }
  const startup = setTimeout(() => stop(new Error('Worker startup timed out')), timeoutMs);
  function send(operation, options = {}) {
    if (stopped) return Promise.reject(new Error('Worker terminated'));
    const requestId = ++nextID;
    const message = {protocolVersion: 1, sessionId, requestId, operation,
      base: options.base ?? structuredClone(state), payload: options.payload ?? {},
      ...(options.target ? {target: options.target} : {})};
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => stop(new Error('Worker request timed out: ' + operation)), timeoutMs);
      pending.set(requestId, {resolve, reject, timer});
      try {worker.postMessage(message);}
      catch (cause) {pending.delete(requestId); clearTimeout(timer); reject(cause);}
    });
  }
  worker.onmessage = ({data}) => {
    if (data.type === 'ready') {
      if (initialized) {stop(new Error('Unexpected duplicate worker startup')); return;}
      initialized = true;
      send('initialize').then(capabilities => {
        clearTimeout(startup); resolveReady({...data, capabilities, sessionId});
      }, cause => stop(cause));
      return;
    }
    if (data.type === 'fatal') {stop(new Error(data.error.message)); return;}
    if (data.protocolVersion !== 1 || data.sessionId !== sessionId) {
      stop(new Error('Worker reply identity mismatch')); return;
    }
    const item = pending.get(data.requestId);
    if (!item) return;
    pending.delete(data.requestId); clearTimeout(item.timer);
    state = structuredClone(data.state);
    if (data.ok) item.resolve(data.result);
    else item.reject(Object.assign(new Error(data.error.message), data.error));
  };
  worker.onerror = event => {event.preventDefault(); stop(new Error(event.message));};
  worker.onmessageerror = () => stop(new Error('Worker message could not be decoded'));
  return {sessionId, ready,
    get state() {return structuredClone(state);},
    request: async (operation, options) => {await ready; return send(operation, options);},
    terminate: () => stop(new Error('Worker terminated'), false)};
}
  const api=Object.freeze({create,factory:options=>settings=>create({...options,...settings})});
  registry.browser_transport=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
