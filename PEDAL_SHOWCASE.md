# PEDAL 2.0 — Intelligent Mobility Engineering Showcase

**[Open the PEDAL 2.0 visual showcase](https://alswl50978-eng.github.io/ebike-range-lab/pedal.html)**

A standalone GitHub Pages presentation for the ESP32-P4/LVGL electric-bicycle dashboard concept. The existing **한 칸 더** research notebook remains available at the repository root.

## Implementation status
- **Confirmed component tests:** ESP32-P4 display and touch; one MPU6050 on Arduino UNO with threshold-based acceleration/tilt/impact logic.
- **Interactive prototype:** Five-zone impact visualization (rear, front, handle, center, helmet), speed slider, start/stop, battery/range display and simulated warnings.
- **Planned hardware:** Three MPU6050 sensors for rear/front/center; handle and helmet remain virtual. No integrated multi-sensor telemetry or real road test.
- **Battery model:** Assumed 500 Wh battery, 60 km at full charge and 20 km/h; illustrative speed factors 1.10/1.00/0.90/0.80. No fitted AI prediction model.

## Evidence policy
The website deliberately labels simulated values, third-party illustrative photos and unverified functionality. Do not describe modeled values as actual measurements.

## 5-minute booth presentation
1. **0:00–0:45** — Problem: e-bike safety information is fragmented.
2. **0:45–1:45** — Architecture: ESP32-P4 + LVGL; five proposed sensing locations.
3. **1:45–3:00** — Live interaction: speed slider, START/STOP, per-zone alerts.
4. **3:00–4:00** — Battery: 500 Wh/60 km assumption; 85% and 20 km/h predicts 51.0 km.
5. **4:00–5:00** — Evidence and next steps: display/touch and single-MPU6050 tests completed; multi-sensor wiring, road measurements and AI model validation remain future work.

## Assets
The showcase uses original inline SVG technical diagrams and remotely loaded illustrative photos from Unsplash. Photos are not images of this project's hardware.
