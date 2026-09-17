import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import gradio as gr
import spaces
import torch

STEMS = ["vocals", "drums", "bass", "guitar", "piano", "other"]


@spaces.GPU(duration=300)
def separate(audio_path: str):
    if not audio_path:
        raise gr.Error("Envie um arquivo de áudio.")

    work_dir = Path(tempfile.mkdtemp(prefix="tracksplit-"))
    input_path = work_dir / Path(audio_path).name
    output_dir = work_dir / "output"
    output_dir.mkdir()
    shutil.copy2(audio_path, input_path)

    try:
        subprocess.run(
            [
                "python",
                "-m",
                "demucs.separate",
                "--name",
                "htdemucs_6s",
                "--out",
                str(output_dir),
                "--mp3",
                "--mp3-bitrate",
                "192",
                "--device",
                "cuda" if torch.cuda.is_available() else "cpu",
                str(input_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        source_dir = output_dir / "htdemucs_6s" / input_path.stem
        return [str(source_dir / f"{stem}.mp3") for stem in STEMS]
    except subprocess.CalledProcessError as error:
        raise gr.Error(error.stderr[-2000:] or "Falha na separação Demucs.") from error


app = gr.Interface(
    fn=separate,
    inputs=gr.Audio(type="filepath", label="Audio"),
    outputs=[gr.Audio(label=stem.title(), type="filepath") for stem in STEMS],
    title="TrackSplit Stem Separation",
    description="Separação de vocals, drums, bass, guitar, piano e other com Demucs.",
    api_name="predict",
)

app.launch()
