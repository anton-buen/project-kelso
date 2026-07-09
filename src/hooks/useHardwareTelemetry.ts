import { useState, useEffect, useRef } from 'react';
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

export type TelemetryState = 'awaiting_permissions' | 'initializing_ai' | 'calibrated' | 'error';

export function useHardwareTelemetry() {
  const [status, setStatus] = useState<TelemetryState>('awaiting_permissions');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null); // <-- Added here
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initializeHardware() {
      try {
        // 1. Request Camera & Mic Access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: true,
        });

        if (!isMounted) return;

        // Bind the video stream to our hidden video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        // 2. Initialize the Web Audio Context (Engine A Prep)
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser(); // <-- Assigned here
        source.connect(analyserRef.current); 

        setStatus('initializing_ai');

        // 3. Initialize MediaPipe Pose Model (Engine B Prep)
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        
        // (We aren't saving this ref yet since Engine B logic comes next, but it initializes successfully)
        poseLandmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numPoses: 1
        });

        if (isMounted) setStatus('calibrated');

      } catch (err: any) {
        console.error("Hardware calibration failed:", err);
        if (isMounted) {
          setStatus('error');
          setErrorMsg(err.message || "Failed to access camera/microphone.");
        }
      }
    }

    initializeHardware();

    return () => {
      isMounted = false;
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // <-- Now cleanly exporting everything Engine A needs
  return { status, errorMsg, videoRef, audioContextRef, analyserRef, poseLandmarkerRef }; 
}