import { useState, useEffect, useRef } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export type HardwareStatus = 'awaiting_permissions' | 'initializing_ai' | 'calibrated' | 'error';

/**
 * Initialises and manages the full hardware pipeline required for a session:
 * camera stream, Web Audio DSP graph, and MediaPipe pose landmarker.
 *
 * When `isActive` transitions to `false`, all acquired resources are released:
 * camera tracks are stopped (extinguishing the device indicator light),
 * the `AudioContext` is closed, and the MediaPipe WASM instance is freed from
 * heap memory.
 *
 * **Audio DSP chain:** `MediaStreamSource → BiquadHighPassFilter (300 Hz) → AnalyserNode`
 * The high-pass filter removes continuous low-frequency noise (fan hum, room
 * tone) below 300 Hz before the signal reaches the transient detector.
 *
 * **MediaPipe:** Loaded from the jsDelivr CDN at `@mediapipe/tasks-vision@0.10.0`
 * using the `pose_landmarker_lite` float16 model with GPU delegation.
 *
 * @param isActive - Controls whether hardware is acquired (`true`) or released (`false`).
 */
export function useHardwareTelemetry(isActive: boolean) {
  const [status, setStatus] = useState<HardwareStatus>('awaiting_permissions');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (!isActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => console.warn("AudioContext closure error:", err));
        audioContextRef.current = null;
      }

      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }

      analyserRef.current = null;
      setStatus('awaiting_permissions');
      setErrorMsg(null);
      return;
    }

    async function initHardware() {
      try {
        setStatus('awaiting_permissions');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: {
            echoCancellation: { exact: false },
            autoGainControl: { exact: false },
            noiseSuppression: { exact: false }
          }
        });

        if (!videoRef) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        activeStream = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(err => console.warn("Video stream play interrupted:", err));
        }

        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        const source = audioCtx.createMediaStreamSource(stream);

        const highPassFilter = audioCtx.createBiquadFilter();
        highPassFilter.type = 'highpass';
        highPassFilter.frequency.value = 300;

        source.connect(highPassFilter);
        highPassFilter.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        setStatus('initializing_ai');
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
        );

        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });

        poseLandmarkerRef.current = landmarker;
        setStatus('calibrated');

      } catch (err: any) {
        console.error("Hardware Initialization Fault:", err);
        setStatus('error');
        setErrorMsg(err.message || 'Failed to access camera or microphone.');
      }
    }

    initHardware();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => console.warn("AudioContext cleanup error:", err));
      }
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
      }
    };
  }, [isActive]);

  return {
    status,
    errorMsg,
    videoRef,
    audioContextRef,
    analyserRef,
    poseLandmarkerRef
  };
}
