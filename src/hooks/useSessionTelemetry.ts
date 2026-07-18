import { useState, useEffect, useRef } from 'react';

/** A single recorded drum strike with timing error and shoulder tension readings. */
export interface HitData {
  /** Signed timing offset in milliseconds relative to the nearest target beat. */
  deltaMs: number;
  /** Raw shoulder elevation delta mapped to [0, 100]. */
  tension: number;
  /** Alias of `tension`; retained for downstream compatibility. */
  tensionScore: number;
  /** Unix timestamp (ms) at the moment of detection. */
  timestamp: number;
}

/**
 * Collects `kelso-hit` CustomEvents emitted by the audio engine and accumulates
 * them into a `sessionData` array.
 *
 * The `currentTension` value is read from a `useRef` rather than being captured
 * in the event listener closure. This deliberately omits `currentTension` from
 * the dependency array so the listener is not re-registered on every tension
 * frame, which would cause missed hits during high-frequency pose updates.
 *
 * @param isPlaying      - Gates hit recording; events are ignored when `false`.
 * @param currentTension - Live shoulder tension value forwarded via ref.
 */
export function useSessionTelemetry(isPlaying: boolean, currentTension: number) {
  const [sessionData, setSessionData] = useState<HitData[]>([]);

  const currentTensionRef = useRef(currentTension);
  useEffect(() => {
    currentTensionRef.current = currentTension;
  }, [currentTension]);

  const resetSession = () => {
    setSessionData([]);
  };

  useEffect(() => {
    const handlePhysicalHit = (event: Event) => {
      if (!isPlaying) return;

      const customEvent = event as CustomEvent<{ deltaMs: number }>;

      setSessionData(prev => [...prev, {
        deltaMs: customEvent.detail.deltaMs,
        tension: currentTensionRef.current,
        tensionScore: currentTensionRef.current,
        timestamp: Date.now()
      }]);
    };

    window.addEventListener('kelso-hit', handlePhysicalHit);

    return () => {
      window.removeEventListener('kelso-hit', handlePhysicalHit);
    };
  }, [isPlaying]);

  return { sessionData, resetSession };
}

/** Computed biomechanical statistics derived from a completed session. */
export interface SessionAggregates {
  /** Total number of detected strikes. */
  totalStrikes: number;
  /** Constant Error — mean signed timing offset (ms). */
  meanOffsetMs: number;
  /** Variable Error — Bessel-corrected sample standard deviation of offsets (ms). */
  stdDevMs: number;
  /** `stdDevMs` normalised against the target beat interval, expressed as a percentage. */
  tempoNormalizedCV: number;
  /** Percentage of strikes landing within the ±20 ms precision pocket. */
  precisionZonePercentage: number;
  /**
   * Ordinary least-squares slope of `deltaMs` over strike index.
   * A positive value indicates progressive rushing; negative indicates dragging.
   */
  driftSlope: number;
  /** Mean shoulder tension load across all strikes. */
  averageTension: number;
  /** Bessel-corrected sample variance of tension readings. */
  tensionVariance: number;
}

/**
 * Computes biomechanical aggregates from raw session hit data.
 *
 * Statistical notes:
 * - Standard deviation uses Bessel's correction `/ (n - 1)` to correct for
 *   sample variance bias.
 * - `driftSlope` is the OLS beta coefficient of `deltaMs ~ strike_index`,
 *   computed via the closed-form `(n·ΣXY − ΣX·ΣY) / (n·ΣX² − (ΣX)²)`.
 *
 * @param sessionData - Array of `HitData` objects from `useSessionTelemetry`.
 * @param bpm         - Session tempo used to normalise the coefficient of variation.
 * @returns           Zero-valued `SessionAggregates` when `sessionData` is empty.
 */
export function calculateSessionAggregates(sessionData: HitData[], bpm: number): SessionAggregates {
  const n = sessionData.length;

  if (n === 0) {
    return {
      totalStrikes: 0, meanOffsetMs: 0, stdDevMs: 0,
      tempoNormalizedCV: 0, precisionZonePercentage: 0,
      driftSlope: 0, averageTension: 0, tensionVariance: 0
    };
  }

  let sumOffset = 0;
  let sumTension = 0;
  let precisionCount = 0;

  sessionData.forEach(hit => {
    sumOffset += hit.deltaMs;
    sumTension += (hit.tension || 0);
    if (Math.abs(hit.deltaMs) <= 20) precisionCount++;
  });

  const meanOffsetMs = sumOffset / n;
  const averageTension = sumTension / n;
  const precisionZonePercentage = (precisionCount / n) * 100;

  let sumOffsetSqDiff = 0;
  let sumTensionSqDiff = 0;

  sessionData.forEach(hit => {
    sumOffsetSqDiff += Math.pow(hit.deltaMs - meanOffsetMs, 2);
    sumTensionSqDiff += Math.pow((hit.tension || 0) - averageTension, 2);
  });

  const stdDevMs = n > 1 ? Math.sqrt(sumOffsetSqDiff / (n - 1)) : 0;
  const tensionVariance = n > 1 ? sumTensionSqDiff / (n - 1) : 0;

  const targetIntervalMs = 60000 / bpm;
  const tempoNormalizedCV = targetIntervalMs > 0 ? (stdDevMs / targetIntervalMs) * 100 : 0;

  let driftSlope = 0;
  if (n > 1) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    sessionData.forEach((hit, i) => {
      sumX += i;
      sumY += hit.deltaMs;
      sumXY += (i * hit.deltaMs);
      sumX2 += (i * i);
    });

    const denominator = (n * sumX2) - (sumX * sumX);
    if (denominator !== 0) {
      driftSlope = ((n * sumXY) - (sumX * sumY)) / denominator;
    }
  }

  return {
    totalStrikes: n,
    meanOffsetMs,
    stdDevMs,
    tempoNormalizedCV,
    precisionZonePercentage,
    driftSlope,
    averageTension,
    tensionVariance
  };
}
