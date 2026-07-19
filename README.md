---

# Project Kelso: Learning Drums Without Drums

Welcome to **Project Kelso**. This is a personal passion project built to democratize high-level rhythmic training.

How do you learn to play the drums when you don't own a drum set? Due to noise constraints, tiny apartments, and expensive gear, practicing drums at home is often impossible for aspiring musicians. This application bypasses those physical boundaries completely. It allows you to practice the real, high-level physical and mental coordination of drumming using nothing but your hands and a flat desk.

In particular, this project focuses on leveling up your **weak hand** (non-dominant hand). When learning drums, your weak hand naturally lags behind, rushes when physical fatigue sets in, and tenses up immediately under speed. Project Kelso acts as a digital personal trainer to help your non-dominant hand match your strong hand's relaxed, perfect rhythm.

---

## What is Project Kelso?

Practicing rhythm on a bare desk is traditionally a guessing game. You tap your fingers, but you have no objective way of knowing if your micro-timing is perfectly on beat, or if you are unsustainably tensing up your body to achieve higher speeds.

Project Kelso transforms your workstation into a real-time, smart neuro-motor practice mirror:

* **Audio Telemetry:** The microphone captures your physical transients and measures exactly how many milliseconds early or late you are relative to the target metronome grid.
* **Computer Vision Posture Analysis:** The webcam monitors your shoulders to isolate subconscious physical tension.
* **AI Biomechanical Coach:** An integrated serverless diagnostic engine parses your session aggregates and generates a highly personalized clinical report on your coordination trajectory.

---

## The Science: The HKB Coordination Model

This project is a direct software implementation of real scientific research covering human movement, motor learning, and self-organizing biological systems.

When musicians try to play faster, they frequently fall victim to two destructive bottlenecks:

1. **Micro-Timing Shifts:** Your brain thinks you are perfectly on beat, but your limb might actually be drifting or rushing by 30 to 50 milliseconds. You cannot easily hear this subtle drift, but your nervous system is actively misfiring.
2. **Subconscious Tension:** To hit higher tempos, human movers naturally tighten their shoulders. This physical lockup actually restricts speed, degrades kinetic fluidness, and causes repetitive strain injuries like tendonitis.

This application is named in honor of **Dr. J.A. Scott Kelso**, a world-renowned neuroscientist and pioneer of **Coordination Dynamics** (the study of how the brain, nervous system, and muscles self-organize to produce deliberate movement).

Dr. Kelso is famous for his breakthrough bimanual finger-tapping experiments, mathematically formalized as the **HKB (Haken-Kelso-Bunz) Model**. He discovered that when humans tap their hands at slow speeds, they can easily maintain complex alternating patterns (anti-phase movement). However, as the frequency boundary accelerates past a critical threshold, the neural system undergoes a spontaneous **phase transition**—the muscles suddenly snap out of synchronization, exhibit massive instability, and force the limbs into a symmetrical, parallel pattern (in-phase movement) to conserve neural energy.

The HKB landscape is represented mathematically by the following potential function:

$$V(\phi) = -a \cos \phi - b \cos 2\phi$$

Project Kelso applies these exact coordination dynamics. By tracking your tap transients down to the absolute millisecond while simultaneously evaluating your posture for tension spikes, the application maps precisely when your nervous system begins to experience critical fluctuations and panic under speed.

---

## Real-Time Biofeedback Loop

Studies in neuro-motor recovery and athletic training prove that the human brain adapts exponentially faster when supplied with instantaneous, objective data. Instead of letting you guess your accuracy, Kelso delivers structural truth:

> *"You are hitting 42 milliseconds early on an eighth-note grid, and your left shoulder tension has spiked by 30%."*

By rendering this feedback instantly (the user interface glows red the millisecond your posture crosses your calibrated resting threshold), your brain quickly pairs the feeling of physical relaxation with accurate rhythmic execution. This forces you to build healthy muscle memory from day one.

---

## Production Architecture & Core Stack

Project Kelso has transitioned from a localized experimental prototype into a highly structured, hardened, and deployed web application.

| System Layer | Technology | Operational Strategy |
| --- | --- | --- |
| **Frontend Core** | React 18 + Vite + TypeScript | Modern Single Page App driving low-latency canvas rendering and audio context timing. |
| **Compiler Standard** | TypeScript (`tsconfig.json`) | Enforces `"moduleResolution": "bundler"` matching the Vite graph, with strict linting gates blocking dead code or unused imports from production. |
| **Serverless Backend** | Vercel Serverless Functions (`/api`) | An isolated Node.js environment executing proxy transport layer logic to secure private keys. |
| **LLM Inference Gateway** | DeepSeek (via OpenCode Zen API) | Processes mathematical session telemetry to output purely structured, parsable JSON matching a strict diagnostic schema. |
| **Continuous Integration** | Vercel Edge Network | Automated git-triggered CI/CD pipeline linked to `main` with multi-zone distribution. |
| **User Feedback Queue** | Tally.so Integration | Production-grade form telemetry embedded natively to capture structured bugs, browser specs, and layout telemetry. |

---

## How the Code Works Natively

### 1. The Dynamic Loading Initialization

Before entering a training session, the application executes a hardware handshake phase. To keep users engaged while the webcam and audio context mount, the UI streams a randomized collection of layman-accessible, factually rigorous insights regarding Dr. Kelso’s research, explaining concepts like phase transitions, critical fluctuations, and neural attractors.

### 2. The Serverless Telemetry Pipeline

When a user finishes a session and hits `Enter`, the frontend computes complex aggregates: Mean Offset ($ms$), Standard Deviation ($ms$), Tempo-Normalized Coefficient of Variation ($CV\%$), Posture Drift Slope, and Average Tension.

Instead of exposing API tokens to the client browser, the application executes a secure `POST` request to `/api/diagnostic`. This endpoint handles runtime execution:

* Enforces a strict **55-second AbortController timeout** to gracefully catch upstream gateway delays before platform boundaries terminate the container.
* Scrubs input vectors to guarantee clean string validation.
* Forces the model to return a zero-markdown, fully valid JSON data block mapping to the UI reporting dashboard.

```typescript
// Architectural verification block inside api/diagnostic.ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 55000);
// Seamlessly catches timeout exceptions and transforms them into explicit HTTP 504 codes

```

---

## How to Spin Up Locally

Ensure you have [Node.js](https://nodejs.org/) installed on your machine, clone the repository, and follow these terminal steps:

```powershell
# 1. Install all dependencies (including synchronized Node and Vite environment definitions)
npm install

# 2. Fire up the local Vite hot-reloading development server
npm run dev

# 3. Compile static assets and execute strict type verification gates
npm run build

```

---

## Roadmap & Active Engineering Focus

* [x] **Infrastructure Hardening:** Migration of compiler targets to high-efficiency ESM bundler configurations.
* [x] **Secure Token Routing:** Implementation of Vercel serverless proxy handlers to guard infrastructure keys.
* [x] **Observability Vector:** Native integration of a standardized user telemetry feedback system via Tally.
* [ ] **Metronome Optimization:** Refactoring the HTML5 Web Audio API context queue to bypass aggressive browser-level gain compression and automatic noise gate suppression on low-tier microphones.
* [ ] **MIDI Device Integration:** Expanding input hooks to accept physical electronic drum pads alongside standard microphone transient detection.
