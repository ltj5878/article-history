import { useEffect, useRef, useState, useCallback } from 'react';

// Drives the play/pause/scrub state for route animation along the active
// paragraph's routes. Returns progress (0..1) which the caller plugs into
// route source data; resets to 1 (fully drawn) whenever paragraph changes or
// `replayKey` increments.
export function useRouteAnimation({ paragraphId, replayKey, durationMs = 4000 }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(1);
  const rafRef = useRef(null);

  // Use a ref to read the latest progress inside the RAF loop without making
  // the loop depend on it (avoids re-arming the animation each frame).
  const progressRef = useRef(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    progressRef.current = 1;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(1);
    setPlaying(false);
  }, [paragraphId, replayKey]);

  // RAF loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    let last = performance.now();
    // If we're at the end, restart from 0; otherwise resume.
    if (progressRef.current >= 1) progressRef.current = 0;
    const step = (now) => {
      const dt = now - last;
      last = now;
      const next = Math.min(1, progressRef.current + dt / durationMs);
      progressRef.current = next;
      setProgress(next);
      if (next >= 1) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, durationMs]);

  const togglePlay = useCallback(() => setPlaying(p => !p), []);
  const scrub = useCallback((value) => {
    setPlaying(false);
    setProgress(Number(value));
  }, []);

  return { progress, playing, togglePlay, scrub };
}
