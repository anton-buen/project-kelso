import { useState, useEffect } from 'react';
import { PoseLandmarker } from '@mediapipe/tasks-vision';

export function useVisionEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>, 
  poseLandmarker: PoseLandmarker | null, 
  isPlaying: boolean, 
  baselineY: number | null,
  targetHand: 'LEFT' | 'RIGHT' | null // <--- We now pass the target hand
) {
  const [tensionLevel, setTensionLevel] = useState(0);
  const [isShouldersVisible, setIsShouldersVisible] = useState(false);
  const [currentShoulderY, setCurrentShoulderY] = useState(0);

  useEffect(() => {
    if (!videoRef.current || !poseLandmarker) return;

    let animationFrameId: number;

    const detectPose = () => {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        const results = poseLandmarker.detectForVideo(videoRef.current, performance.now());
        if (results.landmarks && results.landmarks.length > 0) {
          const leftShoulder = results.landmarks[0][11];
          const rightShoulder = results.landmarks[0][12];

          // PASSIVE GATE: Both shoulders must be visible to ensure posture
          const visible = (leftShoulder.visibility || 0) > 0.85 && (rightShoulder.visibility || 0) > 0.85;
          setIsShouldersVisible(visible);

          if (visible) {
            // ISOLATION FIX: Only track the specific shoulder being trained
            let activeY = (leftShoulder.y + rightShoulder.y) / 2; // Default
            if (targetHand === 'LEFT') activeY = leftShoulder.y;
            if (targetHand === 'RIGHT') activeY = rightShoulder.y;

            setCurrentShoulderY(activeY);

            // TENSION CALCULATION
            if (isPlaying && baselineY !== null) {
              const difference = baselineY - activeY;
              const newTension = Math.max(0, difference * 2000); 
              setTensionLevel(Math.min(100, newTension));
            } else {
              setTensionLevel(0);
            }
          } else {
            setTensionLevel(0);
          }
        }
      }
      animationFrameId = requestAnimationFrame(detectPose);
    };

    detectPose();
    return () => cancelAnimationFrame(animationFrameId);
  }, [videoRef, poseLandmarker, isPlaying, baselineY, targetHand]);

  return { tensionLevel, isShouldersVisible, currentShoulderY };
}