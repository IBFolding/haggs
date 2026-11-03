"""Beat detection with librosa (ISC, https://github.com/librosa/librosa).

usage: beats.py audio.wav out_dir
Writes out_dir/beats.json ({"bpm", "beats": [seconds...], "duration"}) and out_dir/clicks.wav,
a click on every detected beat, the same length as the input, for checking by ear.
"""
import json
import sys

import librosa
import numpy as np
import soundfile as sf

src, out = sys.argv[1], sys.argv[2]
y, sr = librosa.load(src, sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time")
bpm = float(np.atleast_1d(tempo)[0])
beats = [round(float(b), 3) for b in beats]
sf.write(f"{out}/clicks.wav", librosa.clicks(times=np.array(beats), sr=sr, length=len(y)), sr)
with open(f"{out}/beats.json", "w") as f:
    json.dump({"bpm": round(bpm, 1), "beats": beats, "duration": round(len(y) / sr, 3)}, f)
