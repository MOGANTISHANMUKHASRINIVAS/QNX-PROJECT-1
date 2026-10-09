# QNX Real-Time Safety Supervisor Dashboard

An industrial-grade, responsive real-time safety monitoring web dashboard built for the **QNX Real-Time Safety Supervisor** embedded systems project.

Designed with an authentic **QNX White & Cherry Red Digital Cockpit Theme**:
* **Theme**: Crisp White surfaces (`#FFFFFF`) with authentic **QNX Cherry Red (`#C2183A`)** and deep dark red (`#8B0018`) accents.
* **Precision Square Geometry**: 100% sharp square geometry (`border-radius: 0px`) across all cards, tags, buttons, and meters.
* **Hardware Annunciator Panel**: Discrete state indicators (`SAFE`, `WARNING`, `EMERGENCY STOP`, `SYSTEM FAULT`).
* **Live Ultrasonic Telemetry**: Digital distance readouts and hardware segmented LED meters with proximity threshold tracking.
* **Speed Arbitration & Governor**: Autonomous navigation command vs. safety-approved motor output with real-time speed curtailment calculations.
* **Deterministic Real-Time Monitoring**: Microsecond RTOS latency tracking (`last_processing_us`, `average_us`, `worst_us`), deadline monitoring (`75 ms`), and miss rate calculation under QNX Neutrino RTOS 7.1.
* **Live Firebase Integration**: Connected directly to Firebase Realtime Database (`https://qnx-safety-supervisor-default-rtdb.firebaseio.com/telemetry/latest`) streaming live hardware telemetry from Raspberry Pi.

---

## 1. Project Structure

```text
qnx-dashboard/
├── index.html           # White & Cherry Red digital cockpit UI
├── styles.css           # QNX Cherry Red & White design system
├── app.js               # Real-time telemetry engine & Firebase RTDB sync
├── firebase-config.js   # Firebase configuration & connection manager
├── server.js            # Zero-dependency local Node.js HTTP server
├── .gitignore           # Git ignore file for temp files
└── README.md            # Documentation & setup guide
```

---

## 2. Quick Start: Running the Dashboard Locally

### Option A: Local HTTP Server
```bash
node server.js
```
Navigate to: **`http://localhost:3000`**

### Option B: Open Directly (Double-Click)
Double-click `index.html` in Windows File Explorer:
`c:\Users\Lenovo\Downloads\QNX\qnx-dashboard\index.html`

---

## 3. Firebase Realtime Database Data Contract

The dashboard reads and monitors real-time telemetry structured as:

```json
{
  "has_sensor_data": true,
  "has_safety_data": true,
  "sensors": [
    {
      "distance_cm": 33.58,
      "status": "SENSOR_FAULT"
    },
    {
      "distance_cm": 28.81,
      "status": "SENSOR_FAULT"
    }
  ],
  "safety": {
    "state": "FAULT",
    "navigation": {
      "cmd": "CMD_FORWARD",
      "requested_speed": 90
    },
    "motor": {
      "cmd": "CMD_STOP",
      "approved_speed": 0
    },
    "timing": {
      "last_processing_us": 11,
      "decision_count": 213,
      "average_us": 24,
      "worst_us": 230,
      "deadline_violations": 0,
      "deadline_ms": 75
    }
  }
}
```

---

## 4. License
MIT License - Developed for QNX Real-Time Safety Supervisor demonstration.
