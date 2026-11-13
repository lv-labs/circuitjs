'use strict';
// Synchronous worker-side state machine; engine mutations only follow validated guards.
(() => {
  const copy = value => structuredClone(value);
  const error = (code, message) => Object.assign(new Error(message), {code});
  const require = (condition, code, message) => { if (!condition) throw error(code, message); };
  const positive = n => Number.isSafeInteger(n) && n > 0;
  const same = (a, b) => a && b && a.documentId === b.documentId &&
    a.circuitRevision === b.circuitRevision && a.runEpoch === b.runEpoch;
  function createRevisionProtocol(adapterSession) {
    let sessionId = null, lastRequest = 0, disposed = false, faulted = false;
    let state = {documentId: null, circuitRevision: 0, runEpoch: 0};
    function target(value) {
      require(value && typeof value.documentId === 'string' && value.documentId.length > 0 &&
        positive(value.circuitRevision) && positive(value.runEpoch), 'INVALID_TARGET', 'Invalid target identity');
      return {documentId: value.documentId, circuitRevision: value.circuitRevision, runEpoch: value.runEpoch};
    }
    return {
      handle(message) {
        const envelope = {protocolVersion: 1, sessionId, requestId: message?.requestId};
        try {
          require(message && message.protocolVersion === 1, 'INVALID_PROTOCOL', 'Expected protocol version 1');
          require(typeof message.sessionId === 'string' && message.sessionId.length > 0,
            'SESSION_MISMATCH', 'Session ID is required');
          require(!sessionId || sessionId === message.sessionId, 'SESSION_MISMATCH', 'Wrong worker session');
          envelope.sessionId = message.sessionId;
          require(positive(message.requestId), 'INVALID_REQUEST', 'Expected positive integer request ID');
          require(message.requestId > lastRequest, 'DUPLICATE_REQUEST', 'Request has already been seen');
          lastRequest = message.requestId;
          require(!disposed, 'SESSION_DISPOSED', 'Session has been disposed');
          let result;
          if (message.operation === 'initialize') {
            require(sessionId === null, 'ALREADY_INITIALIZED', 'Worker is already initialized');
            sessionId = message.sessionId;
            result = {models: ['resistor@1', 'capacitor@1', 'switch@1', 'voltageSource:dc@1', 'ground@1'],
              liveChanges: typeof adapterSession.setSwitch === 'function' ? ['setSwitch:rc'] : [], maxStepCount: 10000};
          } else {
            require(sessionId !== null, 'NOT_INITIALIZED', 'Initialize the worker first');
            require(same(message.base, state), 'STALE_BASE', 'Request does not match accepted circuit/run');
            require(!faulted || message.operation === 'dispose', 'ENGINE_FAILURE', 'Session faulted; replace the worker');
            switch (message.operation) {
              case 'installCircuit': {
                require(state.documentId === null, 'ALREADY_INSTALLED', 'Install into a fresh candidate worker');
                const next = target(message.target);
                result = adapterSession.installProjection(message.payload?.circuit, next.documentId);
                state = next;
                break;
              }
              case 'step':
                require(state.documentId !== null, 'NO_DOCUMENT', 'Install a circuit first');
                result = adapterSession.step(message.payload?.count);
                break;
              case 'snapshot':
                require(state.documentId !== null, 'NO_DOCUMENT', 'Install a circuit first');
                result = adapterSession.snapshot();
                break;
              case 'reset': {
                require(state.documentId !== null, 'NO_DOCUMENT', 'Install a circuit first');
                const next = target(message.target);
                require(next.documentId === state.documentId && next.circuitRevision === state.circuitRevision &&
                  next.runEpoch > state.runEpoch && message.payload?.statePolicy === 'reset',
                  'INVALID_TARGET', 'Reset must preserve circuit revision and advance run epoch');
                result = adapterSession.reset();
                state = next;
                break;
              }
              case 'setSwitch': {
                require(typeof adapterSession.setSwitch === 'function', 'UNSUPPORTED_LIVE_CHANGE', 'Live switches unavailable');
                const next = target(message.target);
                require(next.documentId === state.documentId && next.circuitRevision > state.circuitRevision &&
                  next.runEpoch === state.runEpoch && message.payload?.statePolicy === 'preserve',
                  'INVALID_TARGET', 'Switch change must advance revision and preserve run epoch');
                result = adapterSession.setSwitch(message.payload.componentId, message.payload.closed);
                state = next;
                break;
              }
              case 'dispose': disposed = true; result = {disposed: true}; break;
              default: throw error('INVALID_OPERATION', 'Unknown operation');
            }
          }
          return {...envelope, ok: true, state: copy(state),
            result: {...copy(result), ...state, sessionId, protocolVersion: 1}};
        } catch (cause) {
          if (cause.code === 'ENGINE_FAILURE') faulted = true;
          return {...envelope, ok: false, state: copy(state), error: {
            code: cause.code || 'INVALID_REQUEST', message: String(cause.message || cause),
            disposition: faulted ? 'faulted' : 'unchanged', diagnostics: []}};
        }
      }
    };
  }
  globalThis.CircuitRevisionProtocol = Object.freeze({create: createRevisionProtocol});
})();
