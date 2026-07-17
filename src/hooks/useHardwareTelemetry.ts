import { useState, useEffect, useRef } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export type HardwareStatus = 'awaiting_permissions' | 'initializing_ai' | 'calibrated' | 'error';

export function useHardwareTelemetry(isActive: boolean) {
  const [status, setStatus] = useState<HardwareStatus>('awaiting_permissions');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    // --- SYNCHRONOUS PRIVACY & HARDWARE GATE ---
    if (!isActive) {
      // Gracefully release camera tracks to turn off the physical device indicator light
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      
      // Close Web Audio Context graphs
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(err => console.warn("AudioContext closure error:", err));
        audioContextRef.current = null;
      }

      // Drop MediaPipe WebAssembly references out of heap memory
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }

      analyserRef.current = null;
      setStatus('awaiting_permissions');
      setErrorMsg(null);
      return;
    }
    // --------------------------------------------

    async function initHardware() {
      try {
        setStatus('awaiting_permissions');
        
        // 1. Request strict user media constraints (Bypass Browser Processing)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: {
            echoCancellation: { exact: false },
            autoGainControl: { exact: false },
            noiseSuppression: { exact: false }
          }
        });
        
        // Race condition guard: If user quickly backed out during permission prompt, abort setup
        if (!videoRef) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        activeStream = stream;

        // 2. Bind video stream to the DOM element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(err => console.warn("Video stream play interrupted:", err));
        }

        // 3. Initialize Web Audio Context
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;

        // 4. Build the DSP Audio Routing Graph
        const source = audioCtx.createMediaStreamSource(stream);

        // DSP Filter: Slices out continuous low-frequency noise (like computer fan whirring) below 300Hz
        const highPassFilter = audioCtx.createBiquadFilter();
        highPassFilter.type = 'highpass';
        highPassFilter.frequency.value = 300; 

        // Route: Mic Source -> Biquad High-Pass Filter -> Analyser Node
        source.connect(highPassFilter);
        highPassFilter.connect(analyser);

        audioContextRef.current = audioCtx;
        analyserRef.current = analyser;

        // 5. Initialize MediaPipe Vision Engine
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

        // Double-check active state before saving compiled models to memory
        poseLandmarkerRef.current = landmarker;
        setStatus('calibrated');

      } catch (err: any) {
        console.error("Hardware Initialization Fault:", err);
        setStatus('error');
        setErrorMsg(err.message || 'Failed to access camera or microphone.');
      }
    }

    initHardware();

    // Clean up hardware tracks on unmount or phase shifting
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
  }, [isActive]); // Added isActive to capture state machine updates correctly

  return {
    status,
    errorMsg,
    videoRef,
    audioContextRef,
    analyserRef,
    poseLandmarkerRef
  };
}