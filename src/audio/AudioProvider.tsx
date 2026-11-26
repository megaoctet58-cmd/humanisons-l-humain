/**
 * Lecture audio centralisée.
 *
 * Un SEUL élément <audio> pour toute l'application : il est donc impossible
 * d'écouter deux témoignages en même temps. Ce même lecteur alimente le
 * mini-lecteur persistant en bas d'écran. Aucune lecture n'est jamais
 * déclenchée automatiquement : seule une action de la personne lance le son.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as repo from '../services/repository';
import { getPlaybackRate, setPlaybackRate } from '../services/preferences';

export interface Track {
  id: string; // identifiant de la publication
  mediaId: string;
  title: string;
  duration: number; // durée connue (secours si le navigateur ne la fournit pas)
}

interface AudioState {
  track: Track | null;
  playing: boolean;
  loading: boolean;
  time: number;
  duration: number;
  rate: number;
  error?: string;
  inlineVisible: boolean;
}

interface AudioApi extends AudioState {
  toggle: (t: Track) => void;
  seek: (fraction: number) => void;
  skip: (seconds: number) => void;
  setRate: (r: number) => void;
  close: () => void;
  setInlineVisible: (id: string, visible: boolean) => void;
}

const Ctx = createContext<AudioApi | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [s, setS] = useState<AudioState>({
    track: null,
    playing: false,
    loading: false,
    time: 0,
    duration: 0,
    rate: getPlaybackRate(),
    inlineVisible: false,
  });
  const trackRef = useRef<Track | null>(null);

  if (!audioRef.current && typeof Audio !== 'undefined') {
    const a = new Audio();
    a.preload = 'metadata';
    audioRef.current = a;
  }

  useEffect(() => {
    const a = audioRef.current!;
    const dur = () => (Number.isFinite(a.duration) && a.duration > 0 ? a.duration : trackRef.current?.duration ?? 0);
    const onTime = () => setS((x) => ({ ...x, time: a.currentTime, duration: dur() }));
    const onPlay = () => setS((x) => ({ ...x, playing: true, loading: false }));
    const onPause = () => setS((x) => ({ ...x, playing: false }));
    const onEnded = () => setS((x) => ({ ...x, playing: false, time: 0 }));
    const onError = () =>
      setS((x) => ({ ...x, playing: false, loading: false, error: "Ce fichier audio ne peut pas être lu par ce navigateur." }));
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('durationchange', onTime);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('durationchange', onTime);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
      a.removeEventListener('error', onError);
      a.pause();
    };
  }, []);

  const toggle = useCallback(async (t: Track) => {
    const a = audioRef.current!;
    if (trackRef.current?.id === t.id && a.src) {
      if (a.paused) {
        a.playbackRate = getPlaybackRate();
        await a.play().catch(() => undefined);
      } else a.pause();
      return;
    }
    // Nouveau témoignage : on arrête le précédent.
    a.pause();
    trackRef.current = t;
    setS((x) => ({ ...x, track: t, time: 0, duration: t.duration, loading: true, playing: false, error: undefined }));
    const url = await repo.mediaUrl(t.mediaId);
    if (trackRef.current?.id !== t.id) return;
    if (!url) {
      setS((x) => ({ ...x, loading: false, error: 'Fichier audio introuvable sur cet appareil.' }));
      return;
    }
    a.src = url;
    a.playbackRate = getPlaybackRate();
    try {
      await a.play();
    } catch {
      setS((x) => ({ ...x, loading: false }));
    }
  }, []);

  const seek = useCallback((fraction: number) => {
    const a = audioRef.current!;
    const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : trackRef.current?.duration ?? 0;
    if (!d || !a.src) return;
    a.currentTime = Math.max(0, Math.min(d - 0.05, fraction * d));
    setS((x) => ({ ...x, time: a.currentTime }));
  }, []);

  const skip = useCallback((sec: number) => {
    const a = audioRef.current!;
    if (!a.src) return;
    a.currentTime = Math.max(0, a.currentTime + sec);
  }, []);

  const setRate = useCallback((r: number) => {
    setPlaybackRate(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
    setS((x) => ({ ...x, rate: r }));
  }, []);

  const close = useCallback(() => {
    const a = audioRef.current!;
    a.pause();
    a.removeAttribute('src');
    a.load();
    trackRef.current = null;
    setS((x) => ({ ...x, track: null, playing: false, time: 0, duration: 0, loading: false }));
  }, []);

  const setInlineVisible = useCallback((id: string, visible: boolean) => {
    setS((x) => (x.track?.id === id && x.inlineVisible !== visible ? { ...x, inlineVisible: visible } : x));
  }, []);

  // Quand la piste change, on considère par défaut que sa carte n'est pas visible.
  useEffect(() => {
    setS((x) => ({ ...x, inlineVisible: false }));
  }, [s.track?.id]);

  const api = useMemo<AudioApi>(() => ({ ...s, toggle, seek, skip, setRate, close, setInlineVisible }), [s, toggle, seek, skip, setRate, close, setInlineVisible]);
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAudio(): AudioApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAudio doit être utilisé dans <AudioProvider>.');
  return v;
}
