import Link from "next/link";
import { ArrowUpRight, AudioLines } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-white/10 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="TrackSplit home">
          <span className="flex size-8 items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-300/10 text-emerald-300 transition-colors group-hover:bg-emerald-300/20"><AudioLines className="size-4" /></span>
          <span className="flex items-baseline gap-2"><span className="text-sm font-semibold tracking-tight text-zinc-100">TrackSplit</span><span className="text-[10px] text-zinc-500">by Josué Lima</span></span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6" aria-label="Main navigation">
          <Link href="#how-it-works" className="hidden text-sm text-zinc-400 transition-colors hover:text-zinc-100 sm:block">Documentation</Link>
          <Link href="#workspace" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-zinc-100 px-4 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-200">Sign in / Start <ArrowUpRight className="size-4" /></Link>
        </nav>
      </div>
    </header>
  );
}