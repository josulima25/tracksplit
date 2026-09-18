import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "@gradio/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

const remoteOutputUrl = (output: unknown) => {
  if (typeof output === "string") return output;
  if (output && typeof output === "object" && "url" in output && typeof output.url === "string") return output.url;
  if (output && typeof output === "object" && "path" in output && typeof output.path === "string") return output.path;
  return null;
};

export async function POST(req: Request) {
  let workDir = "";

  try {
    const formData = await req.formData();
    const file = formData.get("audio");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const spaceId = process.env.HF_SPACE_ID;
    if (spaceId) {
      const app = await Client.connect(spaceId, {
        token: process.env.HF_TOKEN as `hf_${string}` | undefined,
      });
      const result: { data?: unknown[] } = await app.predict("/predict", [file]);
      const outputs = result.data || [];
      const remoteStems = ["vocals", "drums", "bass", "guitar", "piano", "other"].map((stem, index) => [
        stem,
        remoteOutputUrl(outputs[index]),
      ] as const);
      const missingStem = remoteStems.find(([, url]) => !url);
      if (missingStem) throw new Error(`O Space não retornou o stem ${missingStem[0]}.`);
      return NextResponse.json({ stems: Object.fromEntries(remoteStems) });
    }

    if (process.env.VERCEL) {
      return NextResponse.json(
        { error: "HF_SPACE_ID não está configurado na Vercel." },
        { status: 503 },
      );
    }

    const inputExtension = path.extname(file.name).toLowerCase() || ".audio";
    const trimStart = Number(formData.get("trimStart") || 0);
    const trimEnd = Number(formData.get("trimEnd") || 0);
    if (!Number.isFinite(trimStart) || trimStart < 0 || !Number.isFinite(trimEnd) || trimEnd <= trimStart) {
      return NextResponse.json({ error: "O intervalo de áudio é inválido." }, { status: 400 });
    }

    const outputRoot = path.join(process.cwd(), "public", "generated");
    const outputId = randomUUID();
    const outputDir = path.join(outputRoot, outputId);
    const demucsPath = path.join(process.cwd(), ".venv-demucs", "bin", "demucs");

    workDir = await mkdtemp(path.join("/tmp", "tracksplit-"));
    const inputPath = path.join(workDir, `input${inputExtension}`);
    const clippedPath = path.join(workDir, "clipped.wav");
    await mkdir(outputDir, { recursive: true });
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

    await execFileAsync("ffmpeg", [
      "-y", "-ss", String(trimStart), "-i", inputPath,
      "-t", String(trimEnd - trimStart), "-vn", "-acodec", "pcm_s16le", clippedPath,
    ], { maxBuffer: 10 * 1024 * 1024, signal: req.signal });

    console.log("Executando Demucs localmente em CPU...");
    await execFileAsync(demucsPath, [
      "--name", "htdemucs_6s",
      "--out", outputRoot,
      "--mp3",
      "--mp3-bitrate", "192",
      "--device", "cpu",
      clippedPath,
    ], { maxBuffer: 10 * 1024 * 1024, signal: req.signal });

    const trackName = path.basename(clippedPath, ".wav");
    const demucsOutputDir = path.join(outputRoot, "htdemucs_6s", trackName);
    const stems = await Promise.all(["vocals", "drums", "bass", "guitar", "piano", "other"].map(async (stem) => {
      const stemData = await readFile(path.join(demucsOutputDir, `${stem}.mp3`));
      const stemPath = path.join(outputDir, `${stem}.mp3`);
      await writeFile(stemPath, stemData);
      return [stem, `/generated/${outputId}/${stem}.mp3`] as const;
    }));

    return NextResponse.json({ stems: Object.fromEntries(stems) });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json({ error: "Processamento cancelado." }, { status: 499 });
    }
    console.error("Erro no Demucs local:", error);
    const message = error instanceof Error ? error.message : "Falha na separação local.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }
}
