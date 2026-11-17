'use strict';
// Portable computation module: no DOM, renderer, storage or worker construction.
(() => {
  const registry=globalThis.CircuitCoreModules ||= {};
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
            result = {models: ['sweepSource@1','antennaSource@1','amSource@1','fmSource@1','noiseSource@1','schmittTrigger@1','invertingSchmittTrigger@1','xnorGate@1','sparkGap@1','memristor@1','tunnelDiode@1','fuse@1','photoresistor@1','thermistor@1','scr@1','diac@1','triac@1','varactor@1','triode@1','variableVoltage@1', 'lamp@1', 'text@1', 'box@1', 'line@1', 'labeledNode@1', 'voltmeter@1', 'ohmmeter@1', 'ammeter@1', 'wattmeter@1', 'testPoint@1', 'decimalDisplay@1', 'instructionDisplay@1', 'ledArray@1', 'dataExport@1', 'audioOutput@1', 'stopTrigger@1', 'dcMotor@1', 'threePhaseMotor@1', 'pushSwitch@1', 'mbbSwitch@1', 'tappedTransformer@1', 'customTransformer@1', 'transmissionLine@1', 'counter@1', 'latch@1', 'halfAdder@1', 'fullAdder@1', 'output@1', 'logicOutput@1', 'logicInput@1', 'dFlipFlop@1', 'jkFlipFlop@1', 'tFlipFlop@1', 'polarizedCapacitor@1', 'analogSwitch@1', 'analogSpdtSwitch@1', 'resistor@1', 'transformer@1', 'spdtSwitch@1', 'dpdtSwitch@1', 'led@1', 'zener@1', 'npn@1', 'pnp@1', 'nmos@1', 'pmos@1', 'njfet@1', 'pjfet@1', 'andGate@1', 'nandGate@1', 'orGate@1', 'norGate@1', 'xorGate@1', 'inverter@1', 'inductor@1', 'diode@1', 'currentSource@1', 'potentiometer@1', 'capacitor@1', 'switch@1', 'voltageSource:dc@1', 'voltageSource:sine@1', 'voltageSource:periodic@1', 'voltageRail@1', 'opamp@1', 'ground@1'],
              liveChanges: typeof adapterSession.setSwitch === 'function' ? ['setSwitch:rc',...(typeof adapterSession.updateProjection==='function'?['updateCircuit']:[]),...(typeof adapterSession.setContact==='function'?['setContact']:[]),...(typeof adapterSession.setVariableVoltage==='function'?['setVariableVoltage']:[])] : [], maxSampleChannels: 32, perStepSamples: true, maxStepCount: 10000};
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
                result = adapterSession.step(message.payload?.count, message.payload?.channels);
                break;
              case 'readCapture':
                require(typeof adapterSession.readCapture==='function','UNSUPPORTED_CAPTURE','Recorder access unavailable');
                result=adapterSession.readCapture(message.payload?.componentId);break;
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
              case 'updateCircuit': {
                require(typeof adapterSession.updateProjection==='function','UNSUPPORTED_LIVE_CHANGE','Circuit updates unavailable');
                const next=target(message.target);
                require(next.documentId===state.documentId&&next.circuitRevision>state.circuitRevision&&next.runEpoch===state.runEpoch&&message.payload?.statePolicy==='preserve','INVALID_TARGET','Circuit edit must advance revision and preserve epoch');
                result=adapterSession.updateProjection(message.payload.circuit,next.documentId);state=next;break;
              }
              case 'setContact': {
                require(typeof adapterSession.setContact==='function','UNSUPPORTED_LIVE_CHANGE','Live contact updates unavailable');
                const next=target(message.target);
                require(next.documentId===state.documentId&&next.circuitRevision>state.circuitRevision&&next.runEpoch===state.runEpoch&&message.payload?.statePolicy==='preserve','INVALID_TARGET','Contact change must advance revision and preserve epoch');
                result=adapterSession.setContact(message.payload.componentId,message.payload.field,message.payload.value);state=next;break;
              }
              case 'setVariableVoltage': {
                require(typeof adapterSession.setVariableVoltage==='function','UNSUPPORTED_LIVE_CHANGE','Variable source updates unavailable');
                const next=target(message.target);
                require(next.documentId===state.documentId&&next.circuitRevision>state.circuitRevision&&next.runEpoch===state.runEpoch&&message.payload?.statePolicy==='preserve','INVALID_TARGET','Voltage change must advance revision and preserve epoch');
                result=adapterSession.setVariableVoltage(message.payload.componentId,message.payload.voltage);state=next;break;
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
  const api = Object.freeze({create: createRevisionProtocol});

  registry.protocol=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
