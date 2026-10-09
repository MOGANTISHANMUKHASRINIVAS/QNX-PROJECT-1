/**
 * QNX Safety Supervisor - White & Cherry Red Digital Telemetry Engine
 * Real-Time Firebase Realtime Database Integration
 */

(function () {
  'use strict';

  // Active Firebase Configuration provided by user
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCnlyiBprm7WzfKPnxwhPt5rhnmt5USAy0",
    authDomain: "qnx-safety-supervisor.firebaseapp.com",
    databaseURL: "https://qnx-safety-supervisor-default-rtdb.firebaseio.com",
    projectId: "qnx-safety-supervisor",
    storageBucket: "qnx-safety-supervisor.firebasestorage.app",
    messagingSenderId: "929006897174",
    appId: "1:929006897174:web:6c03e7f001cf6b0af94d37",
    measurementId: "G-H09DXVFX89"
  };

  const DEFAULT_RTDB_PATH = "telemetry/latest";

  // Fallback / Initial Benchmark Payload Contract
  const BENCHMARK_PAYLOAD = {
    has_sensor_data: true,
    has_safety_data: true,
    sensors: [
      {
        distance_cm: 33.58,
        status: "SENSOR_FAULT"
      },
      {
        distance_cm: 28.81,
        status: "SENSOR_FAULT"
      }
    ],
    safety: {
      state: "FAULT",
      navigation: {
        cmd: "CMD_FORWARD",
        requested_speed: 90
      },
      motor: {
        cmd: "CMD_STOP",
        approved_speed: 0
      },
      timing: {
        last_processing_us: 11,
        decision_count: 213,
        average_us: 24,
        worst_us: 230,
        deadline_violations: 0,
        deadline_ms: 75
      }
    }
  };

  let currentData = JSON.parse(JSON.stringify(BENCHMARK_PAYLOAD));
  let isSimulating = false;
  let simInterval = null;
  let rtdbEventSource = null;

  // DOM Elements
  const dom = {
    connDot: document.getElementById('liveDot'),
    connStatusText: document.getElementById('connStatusText'),
    clock: document.getElementById('liveClock'),
    btnSimToggle: document.getElementById('btnSimToggle'),
    btnSimLabel: document.getElementById('btnSimLabel'),
    btnOpenConfig: document.getElementById('btnOpenConfig'),

    // Annunciator
    activeStatePill: document.getElementById('activeStatePill'),
    tileSafe: document.getElementById('tileSafe'),
    tileWarning: document.getElementById('tileWarning'),
    tileEStop: document.getElementById('tileEStop'),
    tileFault: document.getElementById('tileFault'),
    bannerText: document.getElementById('bannerText'),

    // Hero
    heroState: document.getElementById('heroState'),
    heroStateSub: document.getElementById('heroStateSub'),
    heroNavSpeed: document.getElementById('heroNavSpeed'),
    heroAppSpeed: document.getElementById('heroAppSpeed'),
    heroReductionSub: document.getElementById('heroReductionSub'),
    heroLatencyUs: document.getElementById('heroLatencyUs'),
    heroLatencySub: document.getElementById('heroLatencySub'),
    heroSensorsOk: document.getElementById('heroSensorsOk'),
    heroNearestSub: document.getElementById('heroNearestSub'),

    // Sensors
    sensorStatusTag: document.getElementById('sensorStatusTag'),
    s0StatusPill: document.getElementById('s0StatusPill'),
    s0DistDigits: document.getElementById('s0DistDigits'),
    s0ZoneTag: document.getElementById('s0ZoneTag'),
    s0LedTrack: document.getElementById('s0LedTrack'),
    s1StatusPill: document.getElementById('s1StatusPill'),
    s1DistDigits: document.getElementById('s1DistDigits'),
    s1ZoneTag: document.getElementById('s1ZoneTag'),
    s1LedTrack: document.getElementById('s1LedTrack'),

    // Speed Governor
    governorActiveTag: document.getElementById('governorActiveTag'),
    arbNavCmd: document.getElementById('arbNavCmd'),
    arbNavSpeed: document.getElementById('arbNavSpeed'),
    barNavSpeed: document.getElementById('barNavSpeed'),
    arbMotorCmd: document.getElementById('arbMotorCmd'),
    arbMotorSpeed: document.getElementById('arbMotorSpeed'),
    barMotorSpeed: document.getElementById('barMotorSpeed'),
    arbReductionBadge: document.getElementById('arbReductionBadge'),

    // Timing
    deadlinePill: document.getElementById('deadlinePill'),
    tcLastUs: document.getElementById('tcLastUs'),
    tcLastMs: document.getElementById('tcLastMs'),
    tcAvgUs: document.getElementById('tcAvgUs'),
    tcAvgMs: document.getElementById('tcAvgMs'),
    tcWorstUs: document.getElementById('tcWorstUs'),
    tcWorstMs: document.getElementById('tcWorstMs'),
    tcDeadline: document.getElementById('tcDeadline'),
    tcViolations: document.getElementById('tcViolations'),
    tcDecisions: document.getElementById('tcDecisions'),

    // Modal
    configOverlay: document.getElementById('configOverlay'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    btnDismissModal: document.getElementById('btnDismissModal'),
    cfgUrl: document.getElementById('cfgUrl'),
    cfgNode: document.getElementById('cfgNode'),
    cfgKey: document.getElementById('cfgKey'),
    btnConnectDb: document.getElementById('btnConnectDb'),
    btnResetDemo: document.getElementById('btnResetDemo'),
    toast: document.getElementById('qnxToast')
  };

  // 1. DIGITAL CLOCK (HH:MM:SS.mmm)
  function startClock() {
    function tick() {
      if (!dom.clock) return;
      const d = new Date();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      const ms = String(d.getMilliseconds()).padStart(3, '0');
      dom.clock.textContent = `${h}:${m}:${s}.${ms}`;
    }
    setInterval(tick, 75);
    tick();
  }

  // 2. TOAST NOTIFICATIONS
  function showToast(msg) {
    if (!dom.toast) return;
    dom.toast.textContent = msg;
    dom.toast.style.display = 'block';
    setTimeout(() => {
      dom.toast.style.display = 'none';
    }, 2800);
  }

  // 3. SEGMENTED LED BAR GENERATOR (24 segments per track)
  function renderLedSegments(trackEl, distanceCm, maxCm = 200, isFault = false) {
    if (!trackEl) return;
    trackEl.innerHTML = '';
    const totalSegments = 24;
    const ratio = Math.max(0, Math.min(1, distanceCm / maxCm));
    const activeSegments = Math.round(ratio * totalSegments);

    for (let i = 0; i < totalSegments; i++) {
      const seg = document.createElement('div');
      seg.className = 'led-segment';
      const segCm = (i / totalSegments) * maxCm;

      if (i < activeSegments) {
        if (isFault || segCm < 30) {
          seg.classList.add('lit-danger');
        } else if (segCm < 60) {
          seg.classList.add('lit-warn');
        } else {
          seg.classList.add('lit-safe');
        }
      }

      trackEl.appendChild(seg);
    }
  }

  // 4. MAIN TELEMETRY RENDER PIPELINE
  function render(rawPayload) {
    if (!rawPayload) return;

    // Handle nested payload if path is root 'telemetry' instead of 'telemetry/latest'
    let data = rawPayload;
    if (data.latest && typeof data.latest === 'object') {
      data = data.latest;
    }

    currentData = data;

    const safety = data.safety || {};
    const state = (safety.state || 'FAULT').toUpperCase();

    // Reset Annunciator tiles
    if (dom.tileSafe) dom.tileSafe.className = 'state-tile';
    if (dom.tileWarning) dom.tileWarning.className = 'state-tile';
    if (dom.tileEStop) dom.tileEStop.className = 'state-tile';
    if (dom.tileFault) dom.tileFault.className = 'state-tile';

    if (state === 'SAFE') {
      if (dom.tileSafe) dom.tileSafe.classList.add('active-safe');
      dom.heroState.className = 'hero-value text-safe';
      dom.heroState.textContent = 'SAFE';
      dom.heroStateSub.textContent = 'All safety checks nominal';
      dom.activeStatePill.textContent = 'ACTIVE: SAFE';
      dom.activeStatePill.className = 'pill-tag pill-ok';
    } else if (state === 'WARNING') {
      if (dom.tileWarning) dom.tileWarning.classList.add('active-warning');
      dom.heroState.className = 'hero-value text-cherry';
      dom.heroState.textContent = 'WARNING';
      dom.heroStateSub.textContent = 'Proximity hazard • Governor active';
      dom.activeStatePill.textContent = 'ACTIVE: WARNING';
      dom.activeStatePill.className = 'pill-tag pill-active';
    } else if (state.includes('STOP') || state.includes('EMERGENCY')) {
      if (dom.tileEStop) dom.tileEStop.classList.add('active-critical');
      dom.heroState.className = 'hero-value text-cherry';
      dom.heroState.textContent = 'EMERGENCY STOP';
      dom.heroStateSub.textContent = 'Fail-safe halt triggered';
      dom.activeStatePill.textContent = 'ACTIVE: E-STOP';
      dom.activeStatePill.className = 'pill-tag pill-active';
    } else { // FAULT or SYSTEM FAULT
      if (dom.tileFault) dom.tileFault.classList.add('active-critical');
      dom.heroState.className = 'hero-value text-cherry';
      dom.heroState.textContent = 'SYSTEM FAULT';
      dom.heroStateSub.textContent = 'Sensor / hardware fault • Fail-safe stop';
      dom.activeStatePill.textContent = 'ACTIVE: FAULT';
      dom.activeStatePill.className = 'pill-tag pill-active';
    }

    // 2. Speed Arbitration
    const nav = safety.navigation || { cmd: 'CMD_FORWARD', speed: 90 };
    const motor = safety.motor || { cmd: 'CMD_STOP', approved_speed: 0 };

    // Support both requested_speed (live Firebase) and speed (mock benchmark)
    const reqSpeed = Number(nav.requested_speed !== undefined ? nav.requested_speed : (nav.speed !== undefined ? nav.speed : 0));
    const appSpeed = Number(motor.approved_speed !== undefined ? motor.approved_speed : 0);

    dom.heroNavSpeed.textContent = reqSpeed;
    dom.heroAppSpeed.textContent = appSpeed;

    dom.arbNavCmd.textContent = nav.cmd || 'CMD_FORWARD';
    dom.arbNavSpeed.textContent = reqSpeed;
    dom.barNavSpeed.style.width = Math.min(100, Math.max(0, reqSpeed)) + '%';

    dom.arbMotorCmd.textContent = motor.cmd || (appSpeed === 0 ? 'CMD_STOP' : 'CMD_FORWARD');
    dom.arbMotorSpeed.textContent = appSpeed;
    dom.barMotorSpeed.style.width = Math.min(100, Math.max(0, appSpeed)) + '%';

    const delta = reqSpeed - appSpeed;
    let reductionPct = reqSpeed > 0 ? ((delta / reqSpeed) * 100).toFixed(1) : '0.0';

    if (appSpeed === 0 && reqSpeed > 0) {
      dom.heroReductionSub.textContent = `-100.0% CURTAILED TO 0`;
      dom.arbReductionBadge.textContent = `-100.0% (-${delta}% pts)`;
      dom.governorActiveTag.textContent = 'FAIL-SAFE HALT';
      dom.governorActiveTag.className = 'pill-tag pill-active';
    } else if (delta > 0) {
      dom.heroReductionSub.textContent = `-${reductionPct}% SPEED REDUCTION`;
      dom.arbReductionBadge.textContent = `-${reductionPct}% (-${delta}% pts)`;
      dom.governorActiveTag.textContent = 'GOVERNOR ENGAGED';
      dom.governorActiveTag.className = 'pill-tag pill-active';
    } else {
      dom.heroReductionSub.textContent = `NOMINAL (NO REDUCTION)`;
      dom.arbReductionBadge.textContent = `0.0% (UNRESTRICTED)`;
      dom.governorActiveTag.textContent = 'UNRESTRICTED';
      dom.governorActiveTag.className = 'pill-tag pill-ok';
    }

    // 3. Sensors
    const sensors = data.sensors || [];
    let healthyCount = 0;
    let minDistance = 999;
    let minIdx = 0;

    sensors.forEach((s, idx) => {
      if (s.status === 'SENSOR_OK') healthyCount++;
      const d = Number(s.distance_cm || 0);
      if (d < minDistance) {
        minDistance = d;
        minIdx = idx;
      }
    });

    dom.heroSensorsOk.textContent = `${healthyCount} / ${sensors.length}`;
    if (healthyCount === sensors.length && sensors.length > 0) {
      dom.heroSensorsOk.className = 'hero-value text-safe';
      dom.sensorStatusTag.textContent = 'INTEGRITY 100% OK';
      dom.sensorStatusTag.className = 'pill-tag pill-ok';
    } else {
      dom.heroSensorsOk.className = 'hero-value text-cherry';
      dom.sensorStatusTag.textContent = `${sensors.length - healthyCount} FAULT DETECTED`;
      dom.sensorStatusTag.className = 'pill-tag pill-active';
    }

    dom.heroNearestSub.textContent = `Nearest: ${minDistance < 900 ? minDistance.toFixed(1) + ' cm (Sensor ' + minIdx + ')' : 'N/A'}`;

    // Banner message
    if (state === 'FAULT') {
      dom.bannerText.innerHTML = `<strong>FAIL-SAFE ENGAGED:</strong> Ultrasonic sensors in <strong>FAULT</strong> status. Motor output stopped to <strong>0% (CMD_STOP)</strong> to prevent accident.`;
    } else if (state === 'WARNING') {
      dom.bannerText.innerHTML = `<strong>ARBITRATION ENGAGED:</strong> Proximity obstacle at <strong>${minDistance.toFixed(1)} cm</strong>. Motor throttle curtailed by <strong>${reductionPct}%</strong> (${reqSpeed}% &rarr; ${appSpeed}%).`;
    } else {
      dom.bannerText.innerHTML = `<strong>ALL CHECKS NOMINAL:</strong> Safety supervisor running deterministically under QNX Neutrino RTOS 7.1.`;
    }

    // Sensor 0
    if (sensors[0]) {
      const d0 = Number(sensors[0].distance_cm || 0);
      dom.s0DistDigits.textContent = d0.toFixed(1);
      const isFault0 = sensors[0].status !== 'SENSOR_OK';
      dom.s0StatusPill.textContent = sensors[0].status || 'SENSOR_OK';

      if (isFault0) {
        dom.s0StatusPill.className = 'pill-tag pill-active';
        dom.s0ZoneTag.textContent = 'SENSOR FAULT';
        dom.s0ZoneTag.className = 'sensor-warning-pill warn';
      } else if (d0 < 30) {
        dom.s0StatusPill.className = 'pill-tag pill-ok';
        dom.s0ZoneTag.textContent = 'CRITICAL (< 30 cm)';
        dom.s0ZoneTag.className = 'sensor-warning-pill warn';
      } else if (d0 < 60) {
        dom.s0StatusPill.className = 'pill-tag pill-ok';
        dom.s0ZoneTag.textContent = 'PROXIMITY WARNING (< 60 cm)';
        dom.s0ZoneTag.className = 'sensor-warning-pill warn';
      } else {
        dom.s0StatusPill.className = 'pill-tag pill-ok';
        dom.s0ZoneTag.textContent = 'SAFE CLEARANCE (> 60 cm)';
        dom.s0ZoneTag.className = 'sensor-warning-pill safe';
      }

      renderLedSegments(dom.s0LedTrack, d0, 200, isFault0);
    }

    // Sensor 1
    if (sensors[1]) {
      const d1 = Number(sensors[1].distance_cm || 0);
      dom.s1DistDigits.textContent = d1.toFixed(1);
      const isFault1 = sensors[1].status !== 'SENSOR_OK';
      dom.s1StatusPill.textContent = sensors[1].status || 'SENSOR_OK';

      if (isFault1) {
        dom.s1StatusPill.className = 'pill-tag pill-active';
        dom.s1ZoneTag.textContent = 'SENSOR FAULT';
        dom.s1ZoneTag.className = 'sensor-warning-pill warn';
      } else if (d1 < 30) {
        dom.s1StatusPill.className = 'pill-tag pill-ok';
        dom.s1ZoneTag.textContent = 'CRITICAL (< 30 cm)';
        dom.s1ZoneTag.className = 'sensor-warning-pill warn';
      } else if (d1 < 60) {
        dom.s1StatusPill.className = 'pill-tag pill-ok';
        dom.s1ZoneTag.textContent = 'PROXIMITY WARNING (< 60 cm)';
        dom.s1ZoneTag.className = 'sensor-warning-pill warn';
      } else {
        dom.s1StatusPill.className = 'pill-tag pill-ok';
        dom.s1ZoneTag.textContent = 'SAFE CLEARANCE (> 60 cm)';
        dom.s1ZoneTag.className = 'sensor-warning-pill safe';
      }

      renderLedSegments(dom.s1LedTrack, d1, 200, isFault1);
    }

    // 4. Timing
    const timing = safety.timing || {};
    const lastUs = Number(timing.last_processing_us !== undefined ? timing.last_processing_us : 11);
    const avgUs = Number(timing.average_us !== undefined ? timing.average_us : 24);
    const worstUs = Number(timing.worst_us !== undefined ? timing.worst_us : 230);
    const deadlineMs = Number(timing.deadline_ms !== undefined ? timing.deadline_ms : 75);
    const violations = Number(timing.deadline_violations !== undefined ? timing.deadline_violations : 0);
    const decisions = Number(timing.decision_count !== undefined ? timing.decision_count : 213);

    const lastMs = (lastUs / 1000).toFixed(2);
    dom.heroLatencyUs.textContent = lastUs.toLocaleString();
    dom.heroLatencySub.textContent = `${lastMs} ms • Deadline: ${deadlineMs} ms (${violations} misses)`;

    dom.tcLastUs.textContent = lastUs.toLocaleString();
    dom.tcLastMs.textContent = `${lastMs} ms`;
    dom.tcAvgUs.textContent = avgUs.toLocaleString();
    dom.tcAvgMs.textContent = `${(avgUs / 1000).toFixed(2)} ms`;
    dom.tcWorstUs.textContent = worstUs.toLocaleString();
    dom.tcWorstMs.textContent = `${(worstUs / 1000).toFixed(2)} ms`;
    dom.tcDeadline.textContent = deadlineMs;
    dom.tcViolations.textContent = violations;
    dom.tcDecisions.textContent = decisions;

    if (violations === 0) {
      dom.deadlinePill.textContent = 'HARD REAL-TIME NOMINAL';
      dom.deadlinePill.className = 'pill-tag pill-ok';
    } else {
      dom.deadlinePill.textContent = `${violations} DEADLINE VIOLATIONS`;
      dom.deadlinePill.className = 'pill-tag pill-active';
    }
  }

  // 5. SIMULATION MODE
  function toggleSim() {
    isSimulating = !isSimulating;

    if (isSimulating) {
      dom.btnSimLabel.textContent = 'STOP SIMULATION';
      dom.btnSimToggle.classList.add('btn-sim-active');
      showToast('Live Simulation Jitter Active');

      simInterval = setInterval(() => {
        const sim = JSON.parse(JSON.stringify(currentData));

        if (sim.sensors && sim.sensors[0]) {
          const j0 = (Math.random() * 2.0 - 1.0);
          sim.sensors[0].distance_cm = parseFloat((Number(sim.sensors[0].distance_cm || 33.5) + j0).toFixed(2));
        }

        if (sim.sensors && sim.sensors[1]) {
          const j1 = (Math.random() * 2.0 - 1.0);
          sim.sensors[1].distance_cm = parseFloat((Number(sim.sensors[1].distance_cm || 28.8) + j1).toFixed(2));
        }

        if (sim.safety && sim.safety.timing) {
          sim.safety.timing.last_processing_us = Math.max(5, Math.floor(11 + (Math.random() * 8 - 4)));
          sim.safety.timing.decision_count = (Number(sim.safety.timing.decision_count) || 213) + 1;
        }

        render(sim);
      }, 1000);
    } else {
      dom.btnSimLabel.textContent = 'SIMULATE LIVE';
      dom.btnSimToggle.classList.remove('btn-sim-active');
      clearInterval(simInterval);
      simInterval = null;
      render(currentData);
      showToast('Simulation Stopped');
    }
  }

  // 6. FIREBASE CONNECTIVITY
  function setConnStatus(isLive, label) {
    if (dom.connStatusText) dom.connStatusText.textContent = label;
    if (dom.connDot) {
      if (isLive) {
        dom.connDot.style.background = '#059669';
        dom.connDot.style.boxShadow = '0 0 8px #059669';
      } else {
        dom.connDot.style.background = '#C2183A';
        dom.connDot.style.boxShadow = '0 0 8px #C2183A';
      }
    }
  }

  function connectFirebase(dbUrl, dbPath, apiKey) {
    const cleanUrl = (dbUrl || FIREBASE_CONFIG.databaseURL).trim().replace(/\/+$/, '');
    const cleanPath = (dbPath || DEFAULT_RTDB_PATH).trim().replace(/^\/+|\/+$/g, '');
    const key = apiKey || FIREBASE_CONFIG.apiKey;

    setConnStatus(false, 'CONNECTING...');

    // Method 1: Firebase Compat SDK
    if (window.firebase && window.firebase.initializeApp) {
      try {
        const config = {
          ...FIREBASE_CONFIG,
          databaseURL: cleanUrl,
          apiKey: key
        };

        const appName = `qnx-app-${Date.now()}`;
        const app = window.firebase.initializeApp(config, appName);
        const db = app.database();

        db.ref('.info/connected').on('value', (snap) => {
          if (snap.val() === true) {
            setConnStatus(true, 'LIVE RTDB ONLINE');
            showToast('Connected to Firebase Realtime Database');
          }
        });

        // Immediate fetch to render instant live data
        fetch(`${cleanUrl}/${cleanPath}.json`)
          .then(r => r.json())
          .then(d => {
            if (d) {
              setConnStatus(true, 'LIVE RTDB ONLINE');
              render(d);
            }
          })
          .catch(() => {});

        // Listen to the specified path in real-time
        db.ref(cleanPath).on('value', (snap) => {
          const val = snap.val();
          if (val) {
            setConnStatus(true, 'LIVE RTDB ONLINE');
            render(val);
          }
        }, (err) => {
          console.warn('[Firebase] SDK error, fallback to REST:', err);
          fallbackRest(cleanUrl, cleanPath);
        });

        return;
      } catch (err) {
        console.warn('[Firebase] Fallback to REST streaming:', err);
      }
    }

    // Method 2: Fallback REST streaming
    fallbackRest(cleanUrl, cleanPath);
  }

  function fallbackRest(cleanUrl, cleanPath) {
    if (rtdbEventSource) {
      rtdbEventSource.close();
      rtdbEventSource = null;
    }

    const url = `${cleanUrl}/${cleanPath}.json`;

    fetch(url)
      .then(r => r.json())
      .then(d => {
        if (d) {
          setConnStatus(true, 'LIVE REST STREAM');
          render(d);
          showToast('Live RTDB Stream Active');
        }
      })
      .catch((err) => {
        console.warn('[REST] Initial fetch failed:', err);
        setConnStatus(false, 'CONNECTION FAILED');
      });

    try {
      rtdbEventSource = new EventSource(url);
      rtdbEventSource.addEventListener('put', (e) => {
        try {
          const p = JSON.parse(e.data);
          if (p && p.data) {
            render(p.data);
            setConnStatus(true, 'LIVE REST STREAM');
          }
        } catch (ex) { /* ignore */ }
      });
      rtdbEventSource.onerror = () => {
        // Polling fallback every 2 seconds
        if (rtdbEventSource) {
          rtdbEventSource.close();
          rtdbEventSource = null;
        }
        setInterval(() => {
          fetch(url)
            .then(res => res.json())
            .then(data => {
              if (data) {
                setConnStatus(true, 'LIVE RTDB ONLINE');
                render(data);
              }
            })
            .catch(() => {});
        }, 2000);
      };
    } catch (e) { /* ignore */ }
  }

  // 7. EVENT LISTENERS
  function setupEvents() {
    startClock();

    if (dom.btnSimToggle) dom.btnSimToggle.addEventListener('click', toggleSim);

    // Modal
    if (dom.btnOpenConfig) {
      dom.btnOpenConfig.addEventListener('click', () => {
        dom.cfgUrl.value = localStorage.getItem('qnx_rtdb_url') || FIREBASE_CONFIG.databaseURL;
        dom.cfgNode.value = localStorage.getItem('qnx_rtdb_path') || DEFAULT_RTDB_PATH;
        dom.cfgKey.value = localStorage.getItem('qnx_rtdb_key') || FIREBASE_CONFIG.apiKey;
        dom.configOverlay.style.display = 'flex';
      });
    }

    function closeModal() {
      if (dom.configOverlay) dom.configOverlay.style.display = 'none';
    }

    if (dom.btnCloseModal) dom.btnCloseModal.addEventListener('click', closeModal);
    if (dom.btnDismissModal) dom.btnDismissModal.addEventListener('click', closeModal);

    if (dom.btnConnectDb) {
      dom.btnConnectDb.addEventListener('click', () => {
        const u = dom.cfgUrl.value.trim() || FIREBASE_CONFIG.databaseURL;
        const p = dom.cfgNode.value.trim() || DEFAULT_RTDB_PATH;
        const k = dom.cfgKey.value.trim() || FIREBASE_CONFIG.apiKey;

        localStorage.setItem('qnx_rtdb_url', u);
        localStorage.setItem('qnx_rtdb_path', p);
        localStorage.setItem('qnx_rtdb_key', k);

        closeModal();
        connectFirebase(u, p, k);
      });
    }

    if (dom.btnResetDemo) {
      dom.btnResetDemo.addEventListener('click', () => {
        closeModal();
        render(BENCHMARK_PAYLOAD);
        showToast('Loaded benchmark data');
      });
    }
  }

  // 8. BOOTSTRAP & CONNECT
  function init() {
    setupEvents();

    // Render initial benchmark payload immediately
    render(BENCHMARK_PAYLOAD);

    // Automatically connect to the user's Firebase RTDB!
    const targetUrl = localStorage.getItem('qnx_rtdb_url') || FIREBASE_CONFIG.databaseURL;
    const targetPath = localStorage.getItem('qnx_rtdb_path') || DEFAULT_RTDB_PATH;
    const targetKey = localStorage.getItem('qnx_rtdb_key') || FIREBASE_CONFIG.apiKey;

    connectFirebase(targetUrl, targetPath, targetKey);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
