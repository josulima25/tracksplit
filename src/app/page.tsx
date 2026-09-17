"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ChevronRight, Disc3, Download, Sparkles, UploadCloud } from "lucide-react";

import { Dropzone } from "@/components/Dropzone";
import { Header } from "@/components/Header";
import { StemMixer } from "@/components/StemMixer";

type Stems = {
  vocals: string | null;
  drums: string | null;
  bass: string | null;
  guitar: string | null;
  piano: string | null;
  other: string | null;
};

type Project = {
  id: string;
  name: string;
  stems: Stems;
  createdAt: string;
};

const PROJECTS_KEY = "tracksplit-projects";

export default function Home() {
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState("");
  const [stems, setStems] = useState<Stems | null>(null);
  const [sessionName, setSessionName] = useState("Midnight Session");
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => () => {
    if (uploadedAudioUrl) URL.revokeObjectURL(uploadedAudioUrl);
  }, [uploadedAudioUrl]);

  useEffect(() => {
    const loadProjects = () => {
      try {
        const savedProjects = JSON.parse(localStorage.getItem(PROJECTS_KEY) || "[]") as Project[];
        setProjects(savedProjects);
      } catch {
        setProjects([]);
      }
    };
    const timer = window.setTimeout(loadProjects, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleStemsReady = (nextStems: Stems, trackTitle: string) => {
    setStems(nextStems);
    setSessionName(trackTitle);
    const project: Project = {
      id: crypto.randomUUID(),
      name: trackTitle,
      stems: nextStems,
      createdAt: new Date().toISOString(),
    };
    setProjects((current) => {
      const nextProjects = [project, ...current].slice(0, 8);
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(nextProjects));
      return nextProjects;
    });
  };

  const openProject = (project: Project) => {
    setUploadedAudioUrl("");
    setSessionName(project.name);
    setStems(project.stems);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header />
      <main>
        <section className="mx-auto max-w-6xl px-5 pb-20 pt-20 sm:px-8 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-xs font-medium text-emerald-300">
              <Sparkles className="size-3.5" /> AI-powered stem separation
            </div>
            <h1 className="text-4xl font-semibold tracking-[-0.04em] text-zinc-50 sm:text-6xl">
              Your music, <span className="text-emerald-300">split.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-zinc-400 sm:text-lg">
              Isolate vocals, drums, bass, and more from any track. Studio-quality stems, ready for your next idea.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-2xl">
            <Dropzone
              onFileSelected={(file) => {
                const url = URL.createObjectURL(file);
                setUploadedAudioUrl((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return url;
                });
                setSessionName(file.name.replace(/\.[^/.]+$/, ""));
                setStems(null);
              }}
              onStemsReady={handleStemsReady}
            />
          </div>
          {projects.length > 0 && !stems && (
            <div className="mx-auto mt-8 max-w-2xl">
              <div className="mb-3 flex items-center justify-between"><p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Recent projects</p><span className="text-xs text-zinc-600">Saved on this device</span></div>
              <div className="grid gap-2 sm:grid-cols-2">
                {projects.map((project) => (
                  <button key={project.id} type="button" onClick={() => openProject(project)} className="flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/60 px-4 py-3 text-left transition-colors hover:border-emerald-300/40 hover:bg-zinc-900">
                    <span className="min-w-0 truncate text-sm text-zinc-200">{project.name}</span>
                    <span className="ml-3 shrink-0 text-[10px] text-zinc-600">{new Date(project.createdAt).toLocaleDateString("pt-BR")}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-300" /> Free to try</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-300" /> No credit card</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-300" /> Files stay private</span>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-white/10 bg-zinc-900/30 px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-4xl font-light tracking-tight text-zinc-100 sm:text-5xl">How it works</h2>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                { icon: UploadCloud, title: "Upload song", copy: "Any common audio format. Upload files up to 200 MB and 20 min." },
                { icon: Sparkles, title: "AI isolates stems", copy: "Choose the 6-stem model and let the separation run locally." },
                { icon: Download, title: "Mix and download", copy: "Adjust volume, pan, mute and solo. Export exactly what you need." },
              ].map(({ icon: Icon, title, copy }) => (
                <div key={title} className="rounded-xl border border-white/10 bg-zinc-950/60 p-6 transition-colors hover:border-emerald-300/30">
                  <span className="flex size-9 items-center justify-center rounded-full bg-white/[0.06] text-zinc-300"><Icon className="size-4" /></span>
                  <h3 className="mt-5 text-lg font-medium text-zinc-100">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="workspace" className="border-b border-white/10 bg-zinc-950 px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Your workspace</p>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-100">Create your own mix</h2>
              </div>
              <p className="max-w-xs text-sm leading-6 text-zinc-500">A clean starting point for experiments, edits, and everything in between.</p>
            </div>
            <StemMixer key={uploadedAudioUrl || (stems ? sessionName : "demo")} sessionName={sessionName} uploadedAudioUrl={uploadedAudioUrl} stems={stems || undefined} />
          </div>
        </section>

        <section className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-5 py-14 text-sm text-zinc-500 sm:px-8">
          <Disc3 className="size-4 text-zinc-600" />
          <span>Made for the curious ear</span>
          <ChevronRight className="size-3 text-zinc-700" />
          <span>Built for the next take</span>
        </section>
      </main>
      <footer className="border-t border-white/10 px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-zinc-600 sm:flex-row">
          <span>© 2025 TrackSplit. All rights reserved. <span className="text-zinc-500">by Josué Lima</span></span>
          <span className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-emerald-300" /> All systems operational</span>
        </div>
      </footer>
    </div>
  );
}
