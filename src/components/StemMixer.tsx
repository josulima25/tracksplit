"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { Mp3Encoder } from "lamejs";
import { Activity, AudioLines, Download, Drum, Guitar, Headphones, Mic2, Pause, Piano, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

type Stem = {
  name: string;
  icon: typeof Mic2;
  color: string;
  fill: string;
  audioUrl: string;
  bars: number[];
};

type StemMixerProps = {
  sessionName?: string;
  uploadedAudioUrl?: string;
  stems?: Partial<Record<"vocals" | "drums" | "bass" | "guitar" | "piano" | "other", string | null>>;
};

const DEFAULT_DURATION = 200;
const demoStems: Stem[] = [
  { name: "Vocals", icon: Mic2, color: "text-emerald-300", fill: "bg-emerald-300", audioUrl: "/stems/vocals.mp3", bars: [35, 62, 48, 78, 55, 88, 45, 68, 40, 74, 52, 81, 42, 64, 50, 72] },
  { name: "Drums", icon: Drum, color: "text-amber-300", fill: "bg-amber-300", audioUrl: "/stems/drums.mp3", bars: [76, 42, 86, 34, 68, 92, 46, 72, 38, 84, 56, 76, 42, 90, 50, 70] },
  { name: "Bass", icon: Activity, color: "text-sky-300", fill: "bg-sky-300", audioUrl: "/stems/bass.mp3", bars: [42, 54, 36, 62, 48, 70, 40, 58, 45, 76, 38, 64, 50, 68, 44, 56] },
  { name: "Other", icon: AudioLines, color: "text-rose-300", fill: "bg-rose-300", audioUrl: "/stems/other.mp3", bars: [38, 58, 44, 74, 32, 62, 50, 80, 42, 68, 36, 56, 72, 46, 64, 34] },
  { name: "Guitar", icon: Guitar, color: "text-violet-300", fill: "bg-violet-300", audioUrl: "/stems/guitar.mp3", bars: [48, 66, 42, 76, 54, 72, 38, 68, 46, 82, 50, 64, 44, 74, 52, 70] },
  { name: "Piano", icon: Piano, color: "text-fuchsia-300", fill: "bg-fuchsia-300", audioUrl: "/stems/piano.mp3", bars: [32, 52, 68, 44, 76, 36, 58, 72, 40, 64, 48, 80, 42, 60, 70, 50] },
];

const mixPresets = {
  default: { label: "Padrão", volumes: [78, 84, 72, 68] },
  vocals: { label: "Vocal destacado", volumes: [100, 45, 48, 52] },
  instrumental: { label: "Instrumental", volumes: [0, 92, 86, 78] },
  balanced: { label: "Tudo equilibrado", volumes: [82, 82, 82, 82] },
} as const;

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
}

function encodeWav(buffer: AudioBuffer) {
  const channelCount = Math.min(2, buffer.numberOfChannels);
  const frameCount = buffer.length;
  const bytesPerSample = 2;
  const wav = new ArrayBuffer(44 + frameCount * channelCount * bytesPerSample);
  const view = new DataView(wav);
  const writeText = (offset: number, text: string) => text.split("").forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  writeText(0, "RIFF");
  view.setUint32(4, 36 + frameCount * channelCount * bytesPerSample, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channelCount * bytesPerSample, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, frameCount * channelCount * bytesPerSample, true);
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([wav], { type: "audio/wav" });
}

function encodeMp3(buffer: AudioBuffer) {
  const channelCount = Math.min(2, buffer.numberOfChannels);
  const encoder = new Mp3Encoder(channelCount, buffer.sampleRate, 192);
  const left = buffer.getChannelData(0);
  const right = channelCount > 1 ? buffer.getChannelData(1) : left;
  const samplesPerFrame = 1152;
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < buffer.length; offset += samplesPerFrame) {
    const frameLength = Math.min(samplesPerFrame, buffer.length - offset);
    const leftFrame = new Int16Array(frameLength);
    const rightFrame = new Int16Array(frameLength);
    for (let index = 0; index < frameLength; index += 1) {
      leftFrame[index] = Math.max(-32768, Math.min(32767, left[offset + index] * 32767));
      rightFrame[index] = Math.max(-32768, Math.min(32767, right[offset + index] * 32767));
    }
    const encoded = encoder.encodeBuffer(leftFrame, channelCount > 1 ? rightFrame : undefined);
    if (encoded.length > 0) chunks.push(new Uint8Array(encoded).buffer as ArrayBuffer);
  }
  const flushed = encoder.flush();
  if (flushed.length > 0) chunks.push(new Uint8Array(flushed).buffer as ArrayBuffer);
  return new Blob(chunks, { type: "audio/mpeg" });
}

export function StemMixer({ sessionName = "Midnight Session", uploadedAudioUrl = "", stems }: StemMixerProps) {
  const activeStems = useMemo<Stem[]>(() => {
    if (stems) {
      const stemConfig = [
        ["vocals", "Vocals", Mic2, "text-emerald-300", "bg-emerald-300"],
        ["drums", "Drums", Drum, "text-amber-300", "bg-amber-300"],
        ["bass", "Bass", Activity, "text-sky-300", "bg-sky-300"],
        ["guitar", "Guitar", Guitar, "text-violet-300", "bg-violet-300"],
        ["piano", "Piano", Piano, "text-fuchsia-300", "bg-fuchsia-300"],
        ["other", "Other", AudioLines, "text-rose-300", "bg-rose-300"],
      ] as const;
      return stemConfig.filter(([key]) => stems[key]).map(([key, name, icon, color, fill], index) => ({
        name,
        icon,
        color,
        fill,
        audioUrl: stems[key] as string,
        bars: demoStems[index % demoStems.length].bars,
      }));
    }
    return uploadedAudioUrl ? [{ ...demoStems[0], name: "Original", audioUrl: uploadedAudioUrl }] : demoStems.slice(0, 4);
  }, [stems, uploadedAudioUrl]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [volumes, setVolumes] = useState([78, 84, 72, 68]);
  const [pans, setPans] = useState([0, 0, 0, 0]);
  const [muted, setMuted] = useState<number[]>([]);
  const [solo, setSolo] = useState<number[]>([]);
  const [audioError, setAudioError] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingMix, setExportingMix] = useState(false);
  const [mixFormat, setMixFormat] = useState<"wav" | "mp3">("wav");
  const tracksRef = useRef<HTMLAudioElement[]>([]);
  const pannersRef = useRef<StereoPannerNode[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pausedAtRef = useRef(0);

  const isAudible = (index: number, nextMuted = muted, nextSolo = solo) => !nextMuted.includes(index) && (nextSolo.length === 0 || nextSolo.includes(index));
  const applyVolumes = (nextVolumes = volumes, nextMuted = muted, nextSolo = solo, nextPans = pans) => {
    tracksRef.current.forEach((audio, index) => {
      audio.volume = isAudible(index, nextMuted, nextSolo) ? (nextVolumes[index] ?? 78) / 100 : 0;
      if (pannersRef.current[index]) pannersRef.current[index].pan.value = (nextPans[index] ?? 0) / 100;
    });
  };

  const createTracks = () => {
    if (tracksRef.current.length === activeStems.length) return tracksRef.current;
    tracksRef.current.forEach((audio) => audio.pause());
    const audioContext = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = audioContext;
    pannersRef.current = [];
    tracksRef.current = activeStems.map((stem, index) => {
      const audio = new Audio(stem.audioUrl);
      audio.preload = "auto";
      audio.loop = true;
      audio.volume = isAudible(index) ? (volumes[index] ?? 78) / 100 : 0;
      const source = audioContext.createMediaElementSource(audio);
      const panner = audioContext.createStereoPanner();
      panner.pan.value = (pans[index] ?? 0) / 100;
      source.connect(panner).connect(audioContext.destination);
      pannersRef.current[index] = panner;
      audio.addEventListener("canplay", () => console.info(`[TrackSplit] Stem ready: ${stem.name}`), { once: true });
      audio.addEventListener("error", () => {
        console.error(`[TrackSplit] Failed to load stem ${stem.name} from ${stem.audioUrl}`, audio.error);
        setAudioError(true);
      });
      if (index === 0) audio.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
      }, { once: true });
      return audio;
    });
    return tracksRef.current;
  };

  useEffect(() => () => {
    tracksRef.current.forEach((audio) => audio.pause());
    pannersRef.current.forEach((panner) => panner.disconnect());
    audioContextRef.current?.close();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const masterTrack = tracksRef.current[0];
      const time = masterTrack?.currentTime ?? pausedAtRef.current;
      tracksRef.current.slice(1).forEach((audio) => {
        if (Math.abs(audio.currentTime - time) > 0.035) audio.currentTime = time;
      });
      const nextTime = Math.min(duration, time);
      pausedAtRef.current = nextTime;
      setCurrentTime(nextTime);
      if (nextTime >= duration) {
        tracksRef.current.forEach((audio) => { audio.pause(); audio.currentTime = 0; });
        pausedAtRef.current = 0;
        setCurrentTime(0);
        setPlaying(false);
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [duration, playing]);

  const togglePlay = async () => {
    const tracks = createTracks();
    if (playing) {
      tracks.forEach((audio) => audio.pause());
      setPlaying(false);
      return;
    }
    tracks.forEach((audio) => { audio.currentTime = pausedAtRef.current; });
    try {
      await audioContextRef.current?.resume();
      const results = await Promise.allSettled(tracks.map((audio) => audio.play()));
      const failed = results.filter((result) => result.status === "rejected");
      failed.forEach((result) => console.error("[TrackSplit] Stem playback rejected", result.reason));
      if (failed.length === tracks.length) throw new Error("No audio track could be played");
      setAudioError(false);
      setPlaying(true);
    } catch (error) {
      console.error("[TrackSplit] Unable to start mixer playback", error);
      tracks.forEach((audio) => audio.pause());
      setAudioError(true);
    }
  };

  const seek = (time: number) => {
    pausedAtRef.current = time;
    setCurrentTime(time);
    tracksRef.current.forEach((audio) => { audio.currentTime = time; });
  };
  const resetMix = () => { const next = [78, 84, 72, 68]; const nextPans = [0, 0, 0, 0]; setVolumes(next); setPans(nextPans); setMuted([]); setSolo([]); applyVolumes(next, [], [], nextPans); };
  const toggleMute = (index: number) => { const next = muted.includes(index) ? muted.filter((item) => item !== index) : [...muted, index]; setMuted(next); applyVolumes(volumes, next, solo); };
  const toggleSolo = (index: number) => { const next = solo.includes(index) ? solo.filter((item) => item !== index) : [...solo, index]; setSolo(next); applyVolumes(volumes, muted, next); };
  const updateVolume = (index: number, value: number) => { const next = volumes.map((volume, item) => item === index ? value : volume); setVolumes(next); applyVolumes(next); };
  const updatePan = (index: number, value: number) => { const next = pans.map((pan, item) => item === index ? value : pan); setPans(next); applyVolumes(volumes, muted, solo, next); };
  const applyPreset = (preset: keyof typeof mixPresets) => {
    const next = [...mixPresets[preset].volumes];
    setVolumes(next);
    setMuted([]);
    setSolo([]);
    applyVolumes(next, [], []);
  };
  const exportStems = async () => {
    setExporting(true);
    const zip = new JSZip();
    await Promise.all(activeStems.map(async (stem) => {
      const response = await fetch(stem.audioUrl);
      if (response.ok) zip.file(`${stem.name.toLowerCase()}.mp3`, await response.blob());
    }));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "tracksplit-stems.zip";
    anchor.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };
  const exportMix = async () => {
    setExportingMix(true);
    try {
      const audioContext = new AudioContext();
      const buffers = await Promise.all(activeStems.map(async (stem) => {
        const response = await fetch(stem.audioUrl);
        if (!response.ok) throw new Error(`Não foi possível carregar ${stem.name}.`);
        return audioContext.decodeAudioData(await response.arrayBuffer());
      }));
      await audioContext.close();
      const sampleRate = buffers[0]?.sampleRate || 44100;
      const mixDuration = Math.max(...buffers.map((buffer) => buffer.duration));
      const offline = new OfflineAudioContext(2, Math.ceil(mixDuration * sampleRate), sampleRate);
      buffers.forEach((buffer, index) => {
        const source = offline.createBufferSource();
        const gain = offline.createGain();
        const panner = offline.createStereoPanner();
        source.buffer = buffer;
        gain.gain.value = isAudible(index) ? (volumes[index] ?? 78) / 100 : 0;
        panner.pan.value = (pans[index] ?? 0) / 100;
        source.connect(gain).connect(panner).connect(offline.destination);
        source.start(0);
      });
      const rendered = await offline.startRendering();
      const blob = mixFormat === "mp3" ? encodeMp3(rendered) : encodeWav(rendered);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${sessionName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "tracksplit"}-mix.${mixFormat}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("[TrackSplit] Mix export failed", error);
      setAudioError(true);
    } finally {
      setExportingMix(false);
    }
  };

  return (
    <section className="flex h-[min(760px,calc(100vh-8rem))] max-h-screen flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/80 shadow-2xl shadow-black/20">
      <div className="border-b border-white/10 bg-zinc-950/60 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-zinc-300"><Headphones className="size-4" /></span><div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-100">{sessionName}</p><p className="text-xs text-zinc-500">{activeStems.length} {activeStems.length === 1 ? "track preview" : "stems"} · {formatTime(duration)}</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><label className="sr-only" htmlFor="mix-preset">Mix preset</label><select id="mix-preset" defaultValue="default" onChange={(event) => applyPreset(event.target.value as keyof typeof mixPresets)} className="h-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-zinc-300 outline-none focus:border-emerald-300/50"><option value="default">Padrão</option><option value="vocals">Vocal destacado</option><option value="instrumental">Instrumental</option><option value="balanced">Tudo equilibrado</option></select><Button variant="ghost" size="sm" onClick={resetMix} className="text-zinc-400 hover:text-zinc-100"><RotateCcw /> Reset Mix</Button><Button variant="ghost" size="sm" onClick={() => { const next = activeStems.map((_, index) => index); setMuted(next); applyVolumes(volumes, next, solo); }} className="text-zinc-400 hover:text-red-300"><VolumeX /> Mute All</Button><label className="sr-only" htmlFor="mix-format">Mix format</label><select id="mix-format" value={mixFormat} onChange={(event) => setMixFormat(event.target.value as "wav" | "mp3")} className="h-8 rounded-md border border-white/10 bg-white/[0.04] px-2 text-xs text-zinc-300 outline-none focus:border-sky-300/50"><option value="wav">WAV</option><option value="mp3">MP3</option></select><Button size="sm" onClick={exportMix} disabled={exportingMix} className="bg-sky-300 text-zinc-950 hover:bg-sky-200"><Download /> {exportingMix ? "Mixing..." : `Export Mix (${mixFormat.toUpperCase()})`}</Button><Button size="sm" onClick={exportStems} disabled={exporting} className="bg-emerald-300 text-zinc-950 hover:bg-emerald-200"><Download /> {exporting ? "Packing..." : "Export Stems (ZIP)"}</Button></div>
        </div>
        <div className="mx-auto mt-5 flex max-w-xl items-center justify-center gap-4"><span className="w-12 text-right font-mono text-xs text-zinc-400">{formatTime(currentTime)}</span><button type="button" aria-label="Play or pause" onClick={togglePlay} className="flex size-12 items-center justify-center rounded-full bg-emerald-300 text-zinc-950 shadow-lg shadow-emerald-300/10 transition-transform hover:scale-105">{playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="ml-0.5 size-5" fill="currentColor" />}</button><span className="w-12 font-mono text-xs text-zinc-500">{formatTime(duration)}</span></div>
        <button type="button" aria-label="Seek timeline" className="group relative mt-5 block h-5 w-full cursor-pointer" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); seek(((event.clientX - rect.left) / rect.width) * duration); }}><span className="absolute top-2 h-1 w-full rounded-full bg-white/10" /><span className="absolute top-2 h-1 rounded-full bg-emerald-300" style={{ width: `${(currentTime / duration) * 100}%` }} /></button>
      </div>
      <div className="min-h-0 flex-1 divide-y divide-white/10 overflow-y-auto">
        {activeStems.map((stem, index) => {
          const Icon = stem.icon;
          const isMuted = muted.includes(index);
          const isSolo = solo.includes(index);
          return <div key={stem.name} className="flex min-h-32 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"><div className="w-full shrink-0 sm:w-[220px]"><div className="flex items-center justify-between"><div className="flex items-center gap-2.5"><Icon className={`size-4 ${stem.color}`} /><span className="text-sm font-medium text-zinc-200">{stem.name}</span></div><span className="font-mono text-[10px] text-zinc-600">0{index + 1}</span></div><div className="mt-4 flex items-center gap-2"><Volume2 className="size-3.5 shrink-0 text-zinc-500" /><Slider aria-label={`${stem.name} volume`} value={[volumes[index] ?? 78]} onValueChange={(value) => updateVolume(index, Number(Array.isArray(value) ? value[0] : value))} max={100} step={1} className="[&_[data-slot=slider-track]]:bg-white/10 [&_[data-slot=slider-range]]:bg-zinc-300" /><span className="w-7 text-right font-mono text-[10px] text-zinc-500">{volumes[index] ?? 78}</span></div><div className="mt-3 flex gap-2"><button type="button" aria-pressed={isMuted} onClick={() => toggleMute(index)} className={`h-7 flex-1 rounded-md border text-[10px] font-semibold tracking-wider ${isMuted ? "border-red-400/40 bg-red-400/15 text-red-300" : "border-white/10 text-zinc-500"}`}>M</button><button type="button" aria-pressed={isSolo} onClick={() => toggleSolo(index)} className={`h-7 flex-1 rounded-md border text-[10px] font-semibold tracking-wider ${isSolo ? "border-amber-300/40 bg-amber-300/15 text-amber-200" : "border-white/10 text-zinc-500"}`}>S</button></div></div><div className={`relative flex h-20 min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-white/[0.06] bg-black/20 px-3 ${isMuted ? "opacity-35" : ""}`}><div className="absolute inset-x-3 top-1/2 h-px bg-white/[0.06]" />{stem.bars.map((height, barIndex) => <span key={barIndex} className={`mx-[2px] w-full rounded-full opacity-70 ${stem.fill} ${playing && isAudible(index) ? "animate-pulse" : ""}`} style={{ height: `${height}%` }} />)}<span className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-emerald-200" style={{ left: `${(currentTime / duration) * 100}%` }} /></div></div>;
        })}
        <div className="border-t border-white/10 bg-zinc-950/30 px-4 py-2 sm:px-5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">Stereo pan</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {activeStems.map((stem, index) => (
              <div key={`${stem.name}-pan`} className="flex items-center gap-2">
                <span className={`w-20 truncate text-xs ${stem.color}`}>{stem.name}</span>
                  <button type="button" title={`Pan ${stem.name} para a esquerda`} aria-label={`Pan ${stem.name} para a esquerda`} onClick={() => updatePan(index, -100)} className="flex size-7 items-center justify-center rounded-full border border-white/10 text-[10px] text-zinc-500 hover:border-emerald-300/50 hover:text-emerald-200">L</button>
                  <button type="button" title="Centralizar pan" aria-label={`Centralizar pan de ${stem.name}`} onClick={() => updatePan(index, 0)} className={`flex size-7 items-center justify-center rounded-full border font-mono text-[9px] ${pans[index] === 0 ? "border-emerald-300/50 bg-emerald-300/10 text-emerald-200" : "border-white/10 text-zinc-500"}`}>C</button>
                  <button type="button" title={`Pan ${stem.name} para a direita`} aria-label={`Pan ${stem.name} para a direita`} onClick={() => updatePan(index, 100)} className="flex size-7 items-center justify-center rounded-full border border-white/10 text-[10px] text-zinc-500 hover:border-emerald-300/50 hover:text-emerald-200">R</button>
                <span className="w-8 font-mono text-[10px] text-zinc-500">{pans[index] === 0 ? "C" : pans[index] < 0 ? "L" : "R"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-white/10 px-4 py-3 text-[11px] text-zinc-600 sm:px-6"><span>{uploadedAudioUrl ? "Original upload preview · not separated" : audioError ? "Check MP3 files in /public/stems" : "Local demo stems · HTML5 Audio"}</span><span className="flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${audioError ? "bg-amber-300" : "bg-emerald-300"}`} /> {playing ? "Playing" : audioError ? "Audio error" : "Ready"}</span></div>
    </section>
  );
}
