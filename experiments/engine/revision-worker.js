'use strict';
let protocol;
self.onmessage = ({data}) => {
  if (!protocol) return;
  const reply = protocol.handle(data);
  self.postMessage(reply);
  if (reply.ok && data.operation === 'dispose') self.close();
};
self.oncircuitengineready = engine => {
  protocol = CircuitRevisionProtocol.create(CircuitDocumentAdapter.createSession(engine));
  self.postMessage({type: 'ready', protocolVersion: 1,
    dedicatedWorker: self instanceof DedicatedWorkerGlobalScope,
    hasDocument: typeof document !== 'undefined', hasWindow: typeof window !== 'undefined'});
};
try {
  importScripts('core/catalog.js','core/adapter.js','core/worker-api.js','document-adapter.js', 'core/protocol.js','revision-protocol.js', 'circuitjsworker/engine-worker.js');
} catch (error) {
  self.postMessage({type: 'fatal', error: {message: String(error.stack || error)}});
}
