'use strict';
// Small request/reply client. Each worker owns one isolated simulation session.
window.createCircuitWorker = function(url = 'worker.js') {
  const worker = new Worker(url);
  const pending = new Map();
  let nextID = 0;
  let stopped = false;
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const startupTimeout = setTimeout(() => stop(new Error('Worker startup timed out')), 10000);
  function stop(error) {
    stopped = true;
    clearTimeout(startupTimeout);
    worker.terminate();
    rejectReady(error);
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    pending.clear();
  }
  worker.onmessage = ({data}) => {
    if (data.type === 'ready') { clearTimeout(startupTimeout); resolveReady(data); return; }
    if (data.type === 'fatal') { stop(new Error(data.error.message)); return; }
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    clearTimeout(request.timeout);
    if (data.ok) request.resolve(data.result);
    else {
      const error = new Error(data.error.message);
      if (data.error.code) error.code = data.error.code;
      request.reject(error);
    }
  };
  worker.onerror = event => { event.preventDefault(); stop(new Error(event.message)); };
  worker.onmessageerror = () => stop(new Error('Worker message could not be decoded'));
  async function request(method, ...args) {
    await ready;
    if (stopped) throw new Error('Worker has been terminated');
    const id = ++nextID;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // A timed-out mutation may still be queued/running. End the session so
        // later calls cannot unknowingly observe a partially completed request.
        stop(new Error('Worker request timed out: ' + method));
      }, 10000);
      pending.set(id, {resolve, reject, timeout});
      try { worker.postMessage({id, method, args}); }
      catch (error) { pending.delete(id); clearTimeout(timeout); reject(error); }
    });
  }
  return {ready, request,
    load: (text, dt) => request('load', text, dt),
    step: count => request('step', count),
    reset: () => request('reset'),
    snapshot: () => request('snapshot'),
    setSwitch: (id, closed) => request('setSwitch', id, closed),
    updateCircuit: (text, dt, retained) => request('updateCircuit', text, dt, retained),
    terminate: () => stop(new Error('Worker terminated'))};
};

// Document operations are intentionally separate from the legacy text/index API.
window.createDocumentWorker = function(url = 'document-worker.js') {
  const client = createCircuitWorker(url);
  return {ready: client.ready,
    loadDocument: document => client.request('loadDocument', document),
    step: (count, channels) => client.request('step', count, channels),
    snapshot: () => client.request('snapshot'),
    reset: () => client.request('reset'),
    updateProjection: (projection, documentId) => client.request('updateProjection', projection, documentId),
    terminate: client.terminate};
};
