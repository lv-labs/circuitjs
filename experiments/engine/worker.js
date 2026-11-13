'use strict';
// A real dedicated worker: no window/document shims or editor bootstrap.
self.onmessage = ({data}) => {
  const id = data && data.id;
  try {
    if (!Number.isSafeInteger(id) || !data || !Array.isArray(data.args))
      throw new Error('Expected integer request ID and argument array');
    if (!['load', 'step', 'snapshot', 'reset', 'setSwitch'].includes(data.method))
      throw new Error('Unknown engine operation');
    if (!self.CircuitEngine) throw new Error('Engine is not ready');
    const result = self.CircuitEngine[data.method](...data.args);
    self.postMessage({id, ok: true, result});
  } catch (error) {
    self.postMessage({id, ok: false, error: {message: String(error.message || error)}});
  }
};
self.oncircuitengineready = () => self.postMessage({type: 'ready',
  dedicatedWorker: self instanceof DedicatedWorkerGlobalScope,
  hasDocument: typeof document !== 'undefined', hasWindow: typeof window !== 'undefined'});
try {
  importScripts('circuitjsworker/engine-worker.js');
} catch (error) {
  self.postMessage({type: 'fatal', error: {message: String(error.stack || error)}});
}
