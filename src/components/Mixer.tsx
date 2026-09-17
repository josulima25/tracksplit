"use client";

import { useState, useRef, useEffect, useMemo } from "react";

interface Stems {
  vocals: string | null;
  drums: string | null;
  bass: string | null;
  guitar: string | null;
  piano: string | null;
  other: string | null;
}

interface MixerProps {
  stems: Stems;
}

export default function Mixer({ stems }: MixerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Referências para os elementos de áudio HTML
  const vocalsRef = useRef<HTMLAudioElement>(null);
  const drumsRef = useRef<HTMLAudioElement>(null);
  const bassRef = useRef<HTMLAudioElement>(null);
  const guitarRef = useRef<HTMLAudioElement>(null);
  const pianoRef = useRef<HTMLAudioElement>(null);
  const otherRef = useRef<HTMLAudioElement>(null);
  const audioRefs = useMemo(() => ({
    vocals: vocalsRef,
    drums: drumsRef,
    bass: bassRef,
    guitar: guitarRef,
    piano: pianoRef,
    other: otherRef,
  }), [vocalsRef, drumsRef, bassRef, guitarRef, pianoRef, otherRef]);

  // Estados de volume (0 a 1)
  const [volumes, setVolumes] = useState({ vocals: 1, drums: 1, bass: 1, guitar: 1, piano: 1, other: 1 });
  
  // Estados de mute
  const [mutes, setMutes] = useState({ vocals: false, drums: false, bass: false, guitar: false, piano: false, other: false });

  // Sincroniza Play/Pause
  const togglePlay = () => {
    const nextIsPlaying = !isPlaying;
    setIsPlaying(nextIsPlaying);
    
    Object.values(audioRefs).forEach((ref) => {
      if (ref.current) {
        if (nextIsPlaying) {
          ref.current.play();
        } else {
          ref.current.pause();
        }
      }
    });
  };

  // Atualiza os volumes reais sempre que o estado mudar
  useEffect(() => {
    (Object.keys(volumes) as Array<keyof typeof volumes>).forEach((key) => {
      if (audioRefs[key].current) {
        audioRefs[key].current!.volume = mutes[key] ? 0 : volumes[key];
      }
    });
  }, [audioRefs, volumes, mutes]);

  const handleVolumeChange = (track: keyof typeof volumes, value: number) => {
    setVolumes((prev) => ({ ...prev, [track]: value }));
  };

  const toggleMute = (track: keyof typeof mutes) => {
    setMutes((prev) => ({ ...prev, [track]: !prev[track] }));
  };

  // Nomes amigáveis para a interface
  const trackLabels: Record<keyof Stems, string> = {
    vocals: "Vocais",
    drums: "Bateria",
    bass: "Baixo",
    guitar: "Guitarra",
    piano: "Piano",
    other: "Outros",
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-6 bg-gray-900 rounded-xl shadow-2xl text-white mt-8">
      <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
        <h2 className="text-2xl font-bold">Mixer Multifaixa</h2>
        <button
          onClick={togglePlay}
          className={`px-8 py-3 rounded-full font-bold transition-all ${
            isPlaying ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {isPlaying ? "Pausar" : "Tocar"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {(Object.keys(stems) as Array<keyof Stems>).map((track) => (
          stems[track] && (
            <div key={track} className="flex flex-col items-center bg-gray-800 p-4 rounded-lg">
              <span className="font-semibold text-lg mb-4">{trackLabels[track]}</span>
              
              <div className="h-48 flex items-center justify-center mb-4">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volumes[track]}
                  onChange={(e) => handleVolumeChange(track, parseFloat(e.target.value))}
                  className="h-full w-2 appearance-none bg-gray-600 rounded-full cursor-pointer accent-blue-500"
                  style={{ writingMode: "vertical-lr", direction: "rtl" }}
                />
              </div>

              <button
                onClick={() => toggleMute(track)}
                className={`w-full py-2 rounded font-medium transition-colors ${
                  mutes[track] ? "bg-red-500 text-white" : "bg-gray-600 hover:bg-gray-500"
                }`}
              >
                {mutes[track] ? "Mutado" : "Mute"}
              </button>

              <audio ref={audioRefs[track]} src={stems[track] as string} loop />
            </div>
          )
        ))}
      </div>
    </div>
  );
}
