import { useState, useEffect } from 'react';
import { PoseLandmarker } from '@mediapipe/tasks-vision';

/**
 * Runs a `requestAnimationFrame` pose detection loop against the live video
 * stream and derives a shoulder tension metric.
 *
 * **Shoulder isolation** — when `targetHand` is set, only the corresponding
 * shoulder's Y coordinate is tracked. This prevents the non-dominant shoulder's
 * movement from diluting the tension signal for the hand under training.
 *
 * **Visibility gate** — both shoulders must exceed a 0.85 visibility confidence
 * threshold before any reading is emitted. This ensures stable posture baseline
 * acquisition before the session begins.
 *
 * **Tension formula** — `max(0, (baselineY − activeY) × 2000)`, clamped to
 * [0, 100]. A rising shoulder (decreasing Y in normalised coords) produces a
 * positive tension value.
 *
 * @param videoRef        - Ref to the active `<video>` element.
 * @param poseLandmarker  - Compiled MediaPipe `PoseLandmarker` instance.
 * @param isPlaying       - Gates tension computation; resets to 0 when `false`.
 * @param baselineY       - Shoulder Y captured at session start; used as the zero-tension reference.
 * @param targetHand      - Determines which shoulder is used for tension measurement.
 */
export function useVisionEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  poseLandmarker: PoseLandmarker | null,
  isPlaying: boolean,
  baselineY: number | null,
  targetHand: 'LEFT' | 'RIGHT' | null
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

          const visible = (leftShoulder.visibility || 0) > 0.85 && (rightShoulder.visibility || 0) > 0.85;
          setIsShouldersVisible(visible);

          if (visible) {
            let activeY = (leftShoulder.y + rightShoulder.y) / 2;
            if (targetHand === 'LEFT') activeY = leftShoulder.y;
            if (targetHand === 'RIGHT') activeY = rightShoulder.y;

            setCurrentShoulderY(activeY);

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
