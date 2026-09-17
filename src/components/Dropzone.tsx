"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileAudio, Loader2, Play, UploadCloud, AlertCircle, X } from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

export type StemsResult = {
  vocals: string;
  drums: string;
  bass: string;
  guitar: string;
  piano: string;
  other: string;
};

type DropzoneProps = {
  onFileSelected?: (file: File) => void;
  onStemsReady?: (stems: StemsResult, trackTitle: string) => void;
};

export function Dropzone({ onFileSelected, onStemsReady }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<ReturnType<typeof RegionsPlugin.create> | null>(null);

  useEffect(() => () => {
    waveSurferRef.current?.destroy();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const formatTime = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.round(seconds));
    return `${Math.floor(safeSeconds / 60).toString().padStart(2, "0")}:${(safeSeconds % 60).toString().padStart(2, "0")}`;
  };

  const selectFile = (file?: File) => {
    if (!file) return;

    setSelectedFile(file);
    setFileName(file.name);
    setAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setProgress(0);
    setError(null);
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setIsPreviewPlaying(false);
    onFileSelected?.(file);
  };

  useEffect(() => {
    if (!audioUrl || !waveformRef.current) return;

    waveSurferRef.current?.destroy();
    const regions = RegionsPlugin.create();
    const waveSurfer = WaveSurfer.create({
      container: waveformRef.current,
      height: 112,
      waveColor: "#52525b",
      progressColor: "#6ee7b7",
      cursorColor: "#d1fae5",
      cursorWidth: 2,
      barWidth: 2,
      barGap: 2,
      barRadius: 3,
      url: audioUrl,
      plugins: [regions],
    });

    waveSurferRef.current = waveSurfer;
    regionsRef.current = regions;
    waveSurfer.on("ready", (readyDuration) => {
      setDuration(readyDuration);
      setTrimStart(0);
      setTrimEnd(readyDuration);
      regions.addRegion({
        start: 0,
        end: readyDuration,
        color: "rgba(110, 231, 183, 0.18)",
        drag: true,
        resize: true,
      });
    });
    waveSurfer.on("error", () => setError("Não foi possível carregar a waveform desse áudio."));
    regions.on("region-updated", (region) => {
      setTrimStart(region.start);
      setTrimEnd(region.end);
    });
    waveSurfer.on("play", () => setIsPreviewPlaying(true));
    waveSurfer.on("pause", () => setIsPreviewPlaying(false));

    return () => {
      waveSurfer.destroy();
      waveSurferRef.current = null;
      regionsRef.current = null;
    };
  }, [audioUrl]);

  const handleFile = async () => {
    if (!selectedFile) return;

    const trackTitle = selectedFile.name.replace(/\.[^/.]+$/, "");
    setIsLoading(true);
    setError(null);
    setProgress(15);
    setStatusMessage("Enviando áudio...");
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const formData = new FormData();
      formData.append("audio", selectedFile);
      formData.append("trimStart", String(trimStart));
      formData.append("trimEnd", String(trimEnd || duration));

      setProgress(40);
      setStatusMessage("Separando instrumentos com IA (Demucs)...");

      const res = await fetch("/api/stems/separate", {
        method: "POST",
        body: formData,
        signal: abortController.signal,
      });

      const text = await res.text();
      if (!text.trim()) {
        throw new Error(`Stem separation returned an empty response (HTTP ${res.status}).`);
      }

      let data: { stems?: StemsResult; error?: string };
      try {
        data = JSON.parse(text) as { stems?: StemsResult; error?: string };
      } catch (parseError) {
        console.error("[TrackSplit] Invalid JSON from stem separation:", parseError, text);
        throw new Error("Stem separation returned an invalid JSON response.");
      }

      if (!res.ok) {
        throw new Error(data.error || `Stem separation failed (HTTP ${res.status}).`);
      }

      if (!data.stems?.vocals || !data.stems.drums || !data.stems.bass || !data.stems.guitar || !data.stems.piano || !data.stems.other) {
        throw new Error("Stem separation returned incomplete stems.");
      }

      setProgress(100);
      setStatusMessage("Concluído! Carregando mixer...");
      setIsLoading(false);

      if (onStemsReady) {
        onStemsReady(data.stems, trackTitle);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setStatusMessage("Processamento cancelado.");
        setProgress(0);
        return;
      }
      console.error(err);
      setError(err instanceof Error ? err.message : "Ocorreu um erro no processamento.");
      setIsLoading(false);
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      setIsLoading(false);
    }
  };

  const cancelProcessing = () => {
    abortControllerRef.current?.abort();
  };

  const togglePreview = () => {
    waveSurferRef.current?.playPause();
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-dashed border-white/15 bg-zinc-900/60 p-5 transition-all duration-300 hover:border-emerald-300/50 hover:bg-zinc-900 sm:p-8",
        isDragging && "border-emerald-300 bg-emerald-300/10"
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        selectFile(event.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav,.flac,audio/*"
        className="sr-only"
        disabled={isLoading}
        onChange={(event) => selectFile(event.target.files?.[0])}
      />

      <button
        type="button"
        disabled={isLoading}
        className="flex w-full flex-col items-center text-center disabled:opacity-60"
        onClick={() => inputRef.current?.click()}
      >
        <span className="mb-5 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-emerald-300 transition-transform duration-300 group-hover:-translate-y-1">
          {isLoading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : progress === 100 ? (
            <Check className="size-6" />
          ) : (
            <UploadCloud className="size-6" />
          )}
        </span>

        <span className="text-base font-medium text-zinc-100">
          {isLoading ? "Processando áudio com IA" : selectedFile ? "Áudio pronto para separar" : "Drop your track here"}
        </span>
        <span className="mt-1.5 text-sm text-zinc-500">
          {isLoading ? statusMessage : selectedFile ? "Ajuste o trecho abaixo ou processe a faixa inteira" : "or click to browse your files"}
        </span>

        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
          <FileAudio className="size-3" /> MP3 · WAV · FLAC
        </span>
      </button>

      {fileName && (
        <div className="mt-6 border-t border-white/10 pt-4 text-left">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="truncate text-zinc-300">{fileName}</span>
            <span className="shrink-0 text-emerald-300">{progress}%</span>
          </div>
          <Progress
            value={progress}
            className="h-1 bg-white/10 [&>div]:bg-emerald-300"
          />
        </div>
      )}

      {selectedFile && !isLoading && audioUrl && (
        <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4 text-left">
          <div className="mb-3 flex items-center justify-between gap-3 text-xs">
            <span className="font-mono text-emerald-300">{formatTime(trimStart)}</span>
            <span className="text-zinc-500">Trecho selecionado: {formatTime(trimEnd - trimStart)}</span>
            <span className="font-mono text-emerald-300">{formatTime(trimEnd)}</span>
          </div>
          <div ref={waveformRef} className="min-h-28 w-full overflow-hidden rounded-lg bg-zinc-950/80" />
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-600">
            <span>00:00</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={togglePreview}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-emerald-300/40 hover:text-emerald-200"
            >
              <Play className="size-3.5" fill={isPreviewPlaying ? "currentColor" : "none"} />
              {isPreviewPlaying ? "Pausar prévia" : "Ouvir prévia"}
            </button>
            <span className="text-xs text-zinc-500">Arraste as bordas verdes para cortar</span>
          </div>
          <button
            type="button"
            onClick={handleFile}
            className="mt-4 w-full rounded-full bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-200"
          >
            Separar trecho selecionado
          </button>
        </div>
      )}

      {isLoading && (
        <button
          type="button"
          onClick={cancelProcessing}
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-400/30 px-4 py-2 text-xs font-medium text-red-300 transition-colors hover:bg-red-400/10"
        >
          <X className="size-3.5" /> Cancelar processamento
        </button>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
