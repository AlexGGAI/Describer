#!/usr/bin/env python3
import argparse
import json
import sys

from faster_whisper import WhisperModel


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio_path")
    parser.add_argument("--model", default="tiny.en")
    args = parser.parse_args()

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, _info = model.transcribe(
        args.audio_path,
        vad_filter=True,
        beam_size=1,
        best_of=1,
        condition_on_previous_text=False,
        language="en",
    )

    text = " ".join(segment.text.strip() for segment in segments).strip()
    json.dump({"text": text}, sys.stdout)


if __name__ == "__main__":
    main()
