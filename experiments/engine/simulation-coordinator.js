'use strict';
(() => {
  const copy = value => structuredClone(value);
  const failure = (code, message) => Object.assign(new Error(message), {code});
  function isCurrentFrame(frame, identity, lastSequence = 0) {
    return !!frame && !!identity && frame.protocolVersion === 1 && frame.sessionId === identity.sessionId &&
      frame.documentId === identity.documentId && frame.circuitRevision === identity.circuitRevision &&
      frame.runEpoch === identity.runEpoch && Number.isSafeInteger(frame.frameSequence) &&
      frame.frameSequence > lastSequence;
  }
  function create({workerFactory = options => createRevisionWorker(options), onFrame, onState,
      batchSteps = 128, intervalMs = 16, scheduleTask = setTimeout, cancelTask = clearTimeout} = {}) {
    if (!Number.isSafeInteger(batchSteps) || batchSteps < 1 || batchSteps > 10000 ||
        !Number.isFinite(intervalMs) || intervalMs < 0) throw failure('INVALID_RUN_OPTIONS', 'Invalid batch size or interval');
    let active = null, candidate = null, stepPending = null, replacement = null;
    let desiredDocument = null, desiredCanonical = null, desiredDocumentId = null;
    let documentRevision = 0, circuitRevision = 0, nextEpoch = 0, generation = 0;
    let sampleChannels=[];
    let lastFrame = null, status = 'empty', lastError = null, disposed = false;
    let runRequested = false, timer = null, livePending = null;
    const idleStatus = () => runRequested ? 'running' : 'paused';
    function stopRun() {
      runRequested = false;
      if (timer !== null) {cancelTask(timer); timer = null;}
    }
    function schedule() {
      if (!runRequested || disposed || timer !== null || stepPending || livePending ||
          !current() || !['paused', 'running'].includes(status)) return;
      timer = scheduleTask(() => {
        timer = null;
        if (runRequested && !disposed && !stepPending && !livePending && current() && status === 'running')
          step(batchSteps, true).catch(() => {});
      }, intervalMs);
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
      return copy({status, runRequested, documentRevision, desired: {documentId: desiredDocumentId, circuitRevision},
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
      stopRun();
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
          await record.worker.ready;
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
          lastFrame = null; status = 'paused'; lastError = null;
          previous?.worker.terminate();
          publish();
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
    function singleSwitchChange(compiled) {
      if (!desiredCanonical || desiredDocumentId !== compiled.documentId) return null;
      const before = JSON.parse(desiredCanonical), after = JSON.parse(compiled.canonical);
      if (before.devices.length !== after.devices.length) return null;
      const changed = [];
      before.devices.forEach((device, i) => {
        const next = after.devices[i];
        if (device.id === next.id && device.kind === 'switch' && next.kind === 'switch' &&
            device.parameters.closed !== next.parameters.closed) {
          changed.push({componentId: device.id, closed: next.parameters.closed});
          device.parameters.closed = next.parameters.closed;
        }
      });
      return changed.length === 1 && JSON.stringify(before) === compiled.canonical ? changed[0] : null;
    }
    function commitSwitch(saved, compiled, change) {
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
          const ack = await record.worker.request('setSwitch', {
            target: {documentId: record.documentId, circuitRevision: revision, runEpoch: record.runEpoch},
            payload: {...change, statePolicy: 'preserve'}
          });
          if (ack.sessionId !== record.sessionId || ack.documentId !== record.documentId ||
              ack.circuitRevision !== revision || ack.runEpoch !== record.runEpoch)
            throw failure('INVALID_REPLY', 'Switch acknowledgement identity mismatch');
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
          publish(); schedule();
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
      documentRevision++;
      let compiled;
      try {compiled = CircuitDocumentAdapter.compile(saved);}
      catch (cause) {
        stopRun();
        desiredDocument = saved; desiredDocumentId = typeof saved?.id === 'string' ? saved.id : null;
        desiredCanonical = null; circuitRevision++; generation++;
        cancelCandidate(); status = 'error'; lastError = cause; publish();
        return Promise.reject(cause);
      }
      const sameElectrical = desiredDocumentId === compiled.documentId && desiredCanonical === compiled.canonical;
      const change = !sameElectrical && singleSwitchChange(compiled);
      if (change && active && !active.dead && status !== 'error' &&
          !(replacement?.token === generation) && (current() || livePending?.token === generation))
        return commitSwitch(saved, compiled, change);
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
    return {setDocument, setSampleChannels: channels=>{assertOpen();sampleChannels=CircuitDocumentAdapter.normalizeSampleChannels(channels);}, step: count => step(count), getState: state,
      run: () => {
        assertOpen();
        if (status === 'error' || status === 'loading' || !active || active.dead || (!current() && !livePending))
          throw failure('NO_CURRENT_CIRCUIT', 'Install a valid circuit before running');
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
        return replace(CircuitDocumentAdapter.compile(desiredDocument));
      },
      dispose: () => {
        if (disposed) return;
        stopRun();
        disposed = true; generation++; cancelCandidate(); active?.worker.terminate();
        active = null; lastFrame = null; status = 'disposed'; publish();
      }};
  }
  globalThis.CircuitSimulation = Object.freeze({create, isCurrentFrame});
})();
