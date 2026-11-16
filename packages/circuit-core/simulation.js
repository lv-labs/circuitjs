'use strict';
// Portable computation module: no DOM, renderer, storage or worker construction.
(() => {
  const registry=globalThis.CircuitCoreModules ||= {};
  const Adapter=typeof module==='object'&&module.exports?require('./adapter.js'):registry.adapter;
  const copy = value => structuredClone(value);
  const failure = (code, message) => Object.assign(new Error(message), {code});
  function isCurrentFrame(frame, identity, lastSequence = 0) {
    return !!frame && !!identity && frame.protocolVersion === 1 && frame.sessionId === identity.sessionId &&
      frame.documentId === identity.documentId && frame.circuitRevision === identity.circuitRevision &&
      frame.runEpoch === identity.runEpoch && Number.isSafeInteger(frame.frameSequence) &&
      frame.frameSequence > lastSequence;
  }
  function create({workerFactory, onFrame, onState,
      autoRun = true, batchSteps = 128, intervalMs = 16, scheduleTask = setTimeout, cancelTask = clearTimeout} = {}) {
    if(typeof workerFactory!=='function')throw failure('INVALID_RUN_OPTIONS','A workerFactory transport is required');
    if (!Number.isSafeInteger(batchSteps) || batchSteps < 1 || batchSteps > 10000 ||
        !Number.isFinite(intervalMs) || intervalMs < 0) throw failure('INVALID_RUN_OPTIONS', 'Invalid batch size or interval');
    let active = null, candidate = null, stepPending = null, replacement = null;
    let desiredDocument = null, desiredCanonical = null, desiredDocumentId = null;
    let documentRevision = 0, circuitRevision = 0, nextEpoch = 0, generation = 0, acquisitionEpoch = 0;
    let sampleChannels=[];
    let lastFrame = null, status = 'empty', lastError = null, disposed = false;
    let runRequested = autoRun, timer = null, livePending = null;
    const idleStatus = () => runRequested ? 'running' : 'paused';
    function cancelTick() {
      if (timer !== null) {cancelTask(timer); timer = null;}
    }
    function stopRun() {
      runRequested = false;
      cancelTick();
    }
    function schedule(delay = intervalMs) {
      if (!runRequested || disposed || timer !== null || stepPending || livePending ||
          !current() || !['paused', 'running'].includes(status)) return;
      timer = scheduleTask(() => {
        timer = null;
        if (runRequested && !disposed && !stepPending && !livePending && current() && status === 'running')
          step(batchSteps, true).catch(() => {});
      }, delay);
    }
    function current(record = active) {
      return record && !record.dead && record.documentId === desiredDocumentId &&
        record.circuitRevision === circuitRevision && record.canonical === desiredCanonical;
    }
    function identity(record) {
      return record ? {sessionId: record.sessionId, documentId: record.documentId,
        circuitRevision: record.circuitRevision, runEpoch: record.runEpoch} : null;
    }
    function state() {
      return copy({status, runRequested, documentRevision, acquisitionEpoch, desired: {documentId: desiredDocumentId, circuitRevision},
        accepted: identity(active), frame: ['paused', 'running', 'stepping', 'pausing'].includes(status) && current() && lastFrame &&
          isCurrentFrame(lastFrame, identity(active)) ? lastFrame : null,
        historicalFrame: lastFrame, error: lastError ? {code: lastError.code, message: lastError.message} : null});
    }
    function notify(callback, value) {
      try {callback?.(copy(value));} catch (cause) {console.error('Simulation observer failed', cause);}
    }
    function publish() {notify(onState, state());}
    function assertOpen() {if (disposed) throw failure('DISPOSED', 'Coordinator has been disposed');}
    function cancelCandidate() {
      if (candidate) {candidate.worker?.terminate(); candidate = null;}
    }
    function makeWorker(target) {
      const record = {...target, sessionId: crypto.randomUUID(), worker: null, dead: false};
      record.worker = workerFactory({sessionId: record.sessionId, onFailure: cause => {
        record.dead = true;
        if (active === record && !disposed) {
          stopRun();
          if (status !== 'loading') {status = 'error'; lastError = cause;}
          publish();
        }
      }});
      return record;
    }
    function replace(compiled) {
      cancelTick();
      const token = ++generation;
      const pendingChanges = livePending?.promise;
      cancelCandidate();
      status = 'loading'; lastError = null;
      const targetRevision = circuitRevision;
      const task = (async () => {
        let record;
        try {
          // A pending step may complete, but the new desired revision has already
          // invalidated its live results. Never mutate/terminate the active solver.
          if (pendingChanges) await pendingChanges.catch(() => {});
          if (stepPending) await stepPending.promise.catch(() => {});
          if (disposed || token !== generation) return {superseded: true};
          record = makeWorker({documentId: compiled.documentId, circuitRevision: targetRevision,
            runEpoch: ++nextEpoch, canonical: compiled.canonical});
          candidate = record;
          const ready=await record.worker.ready;
          record.canUpdate=(ready.capabilities?.liveChanges||ready.liveChanges||[]).includes('updateCircuit');
          const installed = await record.worker.request('installCircuit', {
            target: {documentId: record.documentId, circuitRevision: record.circuitRevision, runEpoch: record.runEpoch},
            payload: {circuit: JSON.parse(compiled.canonical)}
          });
          if (disposed || token !== generation) return {superseded: true};
          if (record.dead || installed.sessionId !== record.sessionId || installed.documentId !== record.documentId ||
              installed.circuitRevision !== record.circuitRevision || installed.runEpoch !== record.runEpoch)
            throw failure('INVALID_REPLY', 'Candidate installation identity mismatch');
          const previous = active;
          active = record; candidate = null;
          if (replacement?.token === token) replacement = null;
          lastFrame = null; status = idleStatus(); lastError = null;
          previous?.worker.terminate();
          publish(); schedule();
          return {activated: true, ...identity(record)};
        } catch (cause) {
          if (disposed || token !== generation) return {superseded: true};
          status = 'error'; lastError = cause; publish();
          throw cause;
        } finally {
          if (record && record !== active) record.worker.terminate();
          if (candidate === record) candidate = null;
        }
      })();
      replacement = {token, promise: task};
      // Attach both handlers immediately so supersession/termination cannot leave
      // an internally unobserved rejection. Callers still receive the original task.
      task.then(() => {if (replacement?.token === token) replacement = null;},
        () => {if (replacement?.token === token) replacement = null;});
      publish();
      return task;
    }
    function singleLiveChange(compiled) {
      if (!desiredCanonical || desiredDocumentId !== compiled.documentId) return null;
      const before = JSON.parse(desiredCanonical), after = JSON.parse(compiled.canonical);
      if (before.devices.length !== after.devices.length) return null;
      const changed = [];
      before.devices.forEach((device, i) => {
        const next = after.devices[i];
        const field={pushSwitch:'normallyClosed',spdtSwitch:'position',dpdtSwitch:'position',mbbSwitch:'position',logicInput:'state'}[device.kind];
        if(field&&device.id===next.id&&device.kind===next.kind&&device.parameters[field]!==next.parameters[field]){
          changed.push({componentId:device.id,field,value:next.parameters[field]});device.parameters[field]=next.parameters[field];
        }
        if(device.id===next.id&&device.kind==='variableVoltage'&&next.kind==='variableVoltage'&&device.parameters.voltage!==next.parameters.voltage){changed.push({componentId:device.id,voltage:next.parameters.voltage});device.parameters.voltage=next.parameters.voltage;}
        if (device.id === next.id && device.kind === 'switch' && next.kind === 'switch' &&
            device.parameters.closed !== next.parameters.closed) {
          changed.push({componentId: device.id, closed: next.parameters.closed});
          device.parameters.closed = next.parameters.closed;
        }
      });
      return changed.length === 1 && JSON.stringify(before) === compiled.canonical ? changed[0] : null;
    }
    function commitLiveChange(saved, compiled, change) {
      const token = generation, record = active, previous = livePending?.promise;
      desiredDocument = saved; desiredDocumentId = compiled.documentId; desiredCanonical = compiled.canonical;
      const revision = ++circuitRevision;
      status = 'updating'; lastError = null;
      const pending = {token};
      pending.promise = (async () => {
        try {
          await Promise.resolve(); // register queue bookkeeping before any callbacks
          if (previous) await previous;
          if (stepPending) await stepPending.promise.catch(() => {});
          if (disposed || token !== generation || active !== record) return {superseded: true};
          if (record.dead) throw failure('ENGINE_FAILURE', 'Worker faulted; reset required');
          const ack = await record.worker.request(Object.hasOwn(change,'circuit')?'updateCircuit':Object.hasOwn(change,'voltage')?'setVariableVoltage':Object.hasOwn(change,'field')?'setContact':'setSwitch', {
            target: {documentId: record.documentId, circuitRevision: revision, runEpoch: record.runEpoch},
            payload: {...change, statePolicy: 'preserve'}
          });
          if (ack.sessionId !== record.sessionId || ack.documentId !== record.documentId ||
              ack.circuitRevision !== revision || ack.runEpoch !== record.runEpoch)
            throw failure('INVALID_REPLY', 'Live change acknowledgement identity mismatch');
          // Record a completed physical mutation even if a replacement superseded
          // it meanwhile. Retained worker identity must describe its real state.
          record.circuitRevision = revision; record.canonical = compiled.canonical;
          if (disposed || token !== generation || active !== record) return {superseded: true};
          return ack;
        } catch (cause) {
          if (cause.code === 'ENGINE_FAILURE' || cause.disposition === 'faulted' || cause.code === 'INVALID_REPLY') record.dead = true;
          if (!disposed && token === generation) {stopRun(); status = 'error'; lastError = cause;}
          throw cause;
        } finally {
          if (livePending === pending) {
            livePending = null;
            if (!disposed && token === generation && status === 'updating') status = idleStatus();
          }
          publish();
          // A drag must not repeatedly postpone physics by a full display interval.
          // Replace an older timer with a prompt solve once the latest edit lands.
          if(!livePending && token===generation && status==='running'){cancelTick();schedule(0);}
          else schedule();
        }
      })();
      livePending = pending;
      pending.promise.catch(() => {});
      publish();
      return pending.promise;
    }
    function setDocument(document) {
      assertOpen();
      const saved = copy(document);
      if(desiredDocumentId!==(typeof saved?.id==='string'?saved.id:null))acquisitionEpoch++;
      documentRevision++;
      let compiled;
      try {compiled = Adapter.compile(saved);}
      catch (cause) {
        cancelTick();
        desiredDocument = saved; desiredDocumentId = typeof saved?.id === 'string' ? saved.id : null;
        desiredCanonical = null; circuitRevision++; generation++;
        cancelCandidate(); status = 'error'; lastError = cause; publish();
        return Promise.reject(cause);
      }
      const sameElectrical = desiredDocumentId === compiled.documentId && desiredCanonical === compiled.canonical;
      const change = !sameElectrical && singleLiveChange(compiled);
      if (change && active && !active.dead && status !== 'error' &&
          !(replacement?.token === generation) && (current() || livePending?.token === generation))
        return commitLiveChange(saved, compiled, change);
      if(!sameElectrical&&active?.canUpdate&&!active.dead&&active.documentId===compiled.documentId&&
          !(replacement?.token===generation))
        return commitLiveChange(saved,compiled,{circuit:JSON.parse(compiled.canonical)});
      desiredDocument = saved; desiredDocumentId = compiled.documentId; desiredCanonical = compiled.canonical;
      if (!sameElectrical) circuitRevision++;
      if (sameElectrical && replacement?.token === generation) {publish(); return replacement.promise;}
      if (sameElectrical && livePending?.token === generation) {publish(); return livePending.promise;}
      if (sameElectrical && current() && status !== 'error') {publish(); return Promise.resolve({reused: true, ...identity(active)});}
      return replace(compiled);
    }
    function step(count, automatic = false) {
      assertOpen();
      if (!Number.isSafeInteger(count) || count < 1 || count > 10000)
        return Promise.reject(failure('INVALID_STEP', 'Step count must be 1–10000'));
      if (stepPending || livePending || status === 'loading' || (runRequested && !automatic))
        return Promise.reject(failure('BUSY', 'Simulation is running or an operation is pending'));
      if (!current() || !['paused', 'running'].includes(status)) return Promise.reject(failure('NO_CURRENT_CIRCUIT', 'No simulation matches the desired circuit'));
      const record = active, channels=copy(sampleChannels);
      const previousSequence = lastFrame?.frameSequence || 0;
      const stepGeneration = generation;
      const pending = {};
      status = 'stepping';
      pending.promise = (async () => {
        try {
          const frame = await Promise.resolve().then(() => record.worker.request('step', {payload: {count, ...(channels.length?{channels}:{})}}));
          if (disposed || active !== record || !current(record) || stepGeneration !== generation ||
              !isCurrentFrame(frame, identity(record), previousSequence)) return null;
          lastFrame = copy(frame);
          if(frame.stopRequested)stopRun();
          notify(onFrame, lastFrame);
          return copy(frame);
        } catch (cause) {
          if (!disposed && active === record && current(record) && stepGeneration === generation) {
            record.dead = true; status = 'error'; lastError = cause;
            stopRun();
          }
          throw cause;
        } finally {
          if (stepPending === pending) stepPending = null;
          if (!disposed && ['stepping', 'pausing'].includes(status)) status = idleStatus();
          publish(); schedule();
        }
      })();
      stepPending = pending;
      publish();
      return pending.promise;
    }
    async function readCapture(componentId){
      assertOpen();if(stepPending)await stepPending.promise;
      if(!current()||!active||active.dead)throw failure('NO_CURRENT_CIRCUIT','No current recorder session');
      const record=active,token=generation,result=await record.worker.request('readCapture',{payload:{componentId}});
      if(disposed||token!==generation||active!==record||!current(record)||result.sessionId!==record.sessionId||result.documentId!==record.documentId||result.circuitRevision!==record.circuitRevision||result.runEpoch!==record.runEpoch)throw failure('STALE_CAPTURE','Recorder changed while reading data');
      if(result.componentId!==componentId)throw failure('INVALID_REPLY','Recorder reply target mismatch');
      return copy(result);
    }
    return {setDocument, readCapture, setSampleChannels: channels=>{assertOpen();sampleChannels=Adapter.normalizeSampleChannels(channels);}, step: count => step(count), getState: state,
      run: () => {
        assertOpen();
        // Keep the user's intent even while an edit is being installed or repaired.
        runRequested = true;
        if (status === 'paused') status = 'running';
        publish(); schedule();
        return state();
      },
      pause: async () => {
        assertOpen(); stopRun();
        if (status === 'running') status = 'paused';
        if (status === 'stepping') status = 'pausing';
        publish();
        if (stepPending) await stepPending.promise.catch(() => {});
        return state();
      },
      setSwitch: (componentId, closed) => {
        assertOpen();
        const components = desiredDocument?.electrical?.components;
        const device = Array.isArray(components) && components.find(item => item.id === componentId && item.kind === 'switch');
        if (!device || typeof closed !== 'boolean') return Promise.reject(failure('INVALID_DOCUMENT', 'Expected switch ID and boolean state'));
        const saved = copy(desiredDocument);
        saved.electrical.components.find(item => item.id === componentId).parameters.closed = closed;
        return setDocument(saved);
      },
      reset: () => {
        assertOpen();
        if (!desiredDocument || desiredCanonical === null)
          return Promise.reject(failure('NO_CURRENT_CIRCUIT', 'Reset requires a valid desired circuit'));
        acquisitionEpoch++;
        return replace(Adapter.compile(desiredDocument));
      },
      dispose: () => {
        if (disposed) return;
        stopRun();
        disposed = true; generation++; cancelCandidate(); active?.worker.terminate();
        active = null; lastFrame = null; status = 'disposed'; publish();
      }};
  }
  function presentationFrame(state){
    if(!state||!['paused','running','stepping','pausing','updating'].includes(state.status))return null;
    if(state.frame)return state.frame;
    const f=state.historicalFrame,a=state.accepted;
    return f&&a&&f.sessionId===a.sessionId&&f.documentId===a.documentId&&
      f.documentId===state.desired?.documentId&&f.runEpoch===a.runEpoch&&
      f.circuitRevision<=a.circuitRevision?f:null;
  }
  const api = Object.freeze({create, isCurrentFrame, presentationFrame});

  registry.simulation=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})();
