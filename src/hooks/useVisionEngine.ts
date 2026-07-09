import { useEffect, useState, useRef } from 'react';
import { PoseLandmarker } from '@mediapipe/tasks-vision';

export function useVisionEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>, 
  poseLandmarker: PoseLandmarker | null, 
  isPlaying: boolean
) {
  const [tensionLevel, setTensionLevel] = useState(0); // 0 (relaxed) to 100 (stiff)
  const animationRef = useRef<number | null>(null);
  const lastVideoTime = useRef(-1);

  useEffect(() => {
    if (!isPlaying || !poseLandmarker || !videoRef.current) return;

    const video = videoRef.current;

    const processFrame = () => {
      // Only process if the video frame has actually updated
      if (video.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = video.currentTime;
        
        const startTimeMs = performance.now();
        const results = poseLandmarker.detectForVideo(video, startTimeMs);

        if (results.landmarks && results.landmarks.length > 0) {
          const pose = results.landmarks[0];
          
          // MediaPipe Landmarks: 11 (Left Shoulder), 12 (Right Shoulder)
          const leftShoulder = pose[11];
          const rightShoulder = pose[12];

          // Basic tension heuristic: Shoulders rising in the Y-axis.
          // (Y is 0.0 at the top of the frame, 1.0 at the bottom).
          // If Y gets smaller, the shoulders are hiking up (tension).
          const averageShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
          
          // Map shoulder height to a 0-100 tension score
          // (These thresholds would be calibrated to the user in a real scenario)
          let currentTension = 0;
          if (averageShoulderY < 0.45) { // Threshold for "shoulders up"
            currentTension = Math.min(100, (0.45 - averageShoulderY) * 500);
          }
          
          setTensionLevel(currentTension);
        }
      }
      
      animationRef.current = requestAnimationFrame(processFrame);
    };

    // Start the ML loop
    animationRef.current = requestAnimationFrame(processFrame);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, poseLandmarker, videoRef]);

  return { tensionLevel };
}