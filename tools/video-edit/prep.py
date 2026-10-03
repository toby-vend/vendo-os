#!/usr/bin/env python3
"""
Footage prep for a talking-head edit (the "polish" half of the v3 recipe).

  python3 tools/video-edit/prep.py analyse <source> <job_dir>
      source.json      size, fps, duration (after rotation), orientation
      transcript.json  word timings on the ORIGINAL timeline (local Whisper via hyperframes)
      silences.json    pauses from ffmpeg silencedetect, to sanity-check Whisper drift
      frames.jpg       8-frame strip for judging face position / crop

  python3 tools/video-edit/prep.py base <source> <job_dir> --in 5.8 --out 56.3 [--crop-x 0.5] [--fps 25]
      public/input-video.mp4  trimmed, 9:16 1080x1920, graded, dense keyframes,
                              audio high-passed + light denoise + gentle compression, −14 LUFS / −1.5 dBTP
      words.json              transcript words inside [in, out], shifted to start at 0
      base.json               what was done + measured loudness

Needs ffmpeg/ffprobe and npx (hyperframes) on PATH.
"""
import argparse
import json
import re
import subprocess
from pathlib import Path

GRADE = "curves=all='0/0 0.22/0.20 0.78/0.80 1/0.97',eq=saturation=1.05:contrast=1.03,unsharp=5:5:0.35"
CLEAN = "highpass=f=80,afftdn=nr=8:nf=-42,acompressor=threshold=-20dB:ratio=2.5:attack=10:release=150:makeup=2"
TARGET_LUFS = -14.0
# Sample-peak ceiling of −3 dBFS (4x oversampled) leaves room for inter-sample and AAC overs under −1.5 dBTP.
LIMIT = "aresample=192000,alimiter=limit=0.708:attack=1:release=60:level=false,aresample=48000"


def run(cmd, capture=False):
    r = subprocess.run(cmd, check=True, text=True, capture_output=capture)
    return r.stdout + r.stderr if capture else ""


def probe(src):
    out = json.loads(run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height,r_frame_rate:stream_side_data=rotation:format=duration", "-of", "json", str(src)], capture=True))
    s = out["streams"][0]
    w, h = s["width"], s["height"]
    rot = 0
    for sd in s.get("side_data_list", []) or []:
        rot = int(sd.get("rotation", 0) or 0)
    if abs(rot) in (90, 270):
        w, h = h, w
    num, den = (int(x) for x in s["r_frame_rate"].split("/"))
    fps = num / den
    return {"width": w, "height": h, "fps": round(fps, 3), "duration": float(out["format"]["duration"]),
            "orientation": "portrait" if h > w else "landscape" if w > h else "square"}


def pick_fps(src_fps):
    """Even divisions keep motion smooth: 50→25, 60→30, otherwise the nearest of 24/25/30."""
    for target in (25, 30, 24):
        if abs(src_fps / target - round(src_fps / target)) < 0.01 and round(src_fps / target) >= 1:
            return target
    return min((24, 25, 30), key=lambda t: abs(t - src_fps))


def analyse(src, job):
    job.mkdir(parents=True, exist_ok=True)
    info = probe(src)
    (job / "source.json").write_text(json.dumps({**info, "source": str(src)}, indent=2))
    wav = job / "audio.wav"
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", str(wav)])
    run(["npx", "-y", "hyperframes", "transcribe", str(wav), "-d", str(job), "--json", "--model", "small.en"], capture=True)
    log = run(["ffmpeg", "-i", str(wav), "-af", "silencedetect=noise=-32dB:d=0.08", "-f", "null", "-"], capture=True)
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    (job / "silences.json").write_text(json.dumps([{"start": a, "end": b} for a, b in zip(starts, ends)], indent=1))
    n = 8
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-vf",
         f"fps={n}/{info['duration']:.3f},scale=240:-1,tile={n}x1", "-frames:v", "1", str(job / "frames.jpg")])
    words = json.loads((job / "transcript.json").read_text())
    print(json.dumps({**info, "words": len(words), "pauses": len(starts)}, indent=2))


def base(src, job, t_in, t_out, crop_x, fps):
    info = probe(src)
    fps = fps or pick_fps(info["fps"])
    t_out = min(t_out, info["duration"])
    dur = round(t_out - t_in, 3)
    # Fill 1080x1920: scale so the short side covers, then crop around crop_x (0 = left edge, 1 = right edge).
    if info["width"] / info["height"] > 1080 / 1920:
        scale = "scale=-2:1920:flags=lanczos"
        crop = f"crop=1080:1920:(iw-1080)*{crop_x}:0"
    else:
        scale = "scale=1080:-2:flags=lanczos"
        crop = "crop=1080:1920:0:(ih-1920)/2"
    vf = f"{scale},{crop},{GRADE},fps={fps}"
    fade_out = max(0, dur - 0.25)
    # Measure, then apply a fixed gain to the target and a peak limiter. Single-pass loudnorm runs in
    # dynamic mode and undershoots on short clips; linear loudnorm falls back to dynamic when the gain
    # would push peaks past TP.
    # The limiter shaves loudness off, so re-measure the whole chain and top the gain up until it lands.
    gain = 0.0
    for _ in range(4):
        af = f"{CLEAN},volume={gain:.2f}dB,{LIMIT},afade=t=in:d=0.08,afade=t=out:st={fade_out}:d=0.25"
        m = run(["ffmpeg", "-hide_banner", "-ss", str(t_in), "-to", str(t_out), "-i", str(src), "-vn",
                 "-af", f"{af},ebur128", "-f", "null", "-"], capture=True)
        miss = TARGET_LUFS - float(re.findall(r"I:\s+(-?[\d.]+) LUFS", m)[-1])
        if abs(miss) < 0.2:
            break
        gain += miss
    pub = job / "public"
    pub.mkdir(parents=True, exist_ok=True)
    out = pub / "input-video.mp4"
    run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(t_in), "-to", str(t_out), "-i", str(src), "-vf", vf, "-af", af,
         "-ar", "48000", "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-g", str(fps), "-keyint_min", str(fps),
         "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k", str(out)])
    meas = run(["ffmpeg", "-i", str(out), "-af", "ebur128=peak=true", "-f", "null", "-"], capture=True)
    lufs = re.findall(r"I:\s+(-?[\d.]+) LUFS", meas)
    peak = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", meas)
    final = probe(out)
    words = json.loads((job / "transcript.json").read_text())
    shifted = [{"text": w["text"], "start": round(max(0.0, w["start"] - t_in), 3), "end": round(min(dur, w["end"] - t_in), 3)}
               for w in words if w["end"] > t_in + 0.05 and w["start"] < t_out - 0.05]
    (job / "words.json").write_text(json.dumps(shifted, indent=1))
    summary = {"in": t_in, "out": t_out, "duration": final["duration"], "fps": fps, "crop_x": crop_x,
               "lufs": float(lufs[-1]) if lufs else None, "true_peak": float(peak[-1]) if peak else None, "words": len(shifted)}
    (job / "base.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["analyse", "base"])
    ap.add_argument("source")
    ap.add_argument("job")
    ap.add_argument("--in", dest="t_in", type=float, default=0.0)
    ap.add_argument("--out", dest="t_out", type=float, default=1e9)
    ap.add_argument("--crop-x", type=float, default=0.5)
    ap.add_argument("--fps", type=int, default=0)
    a = ap.parse_args()
    src, job = Path(a.source).resolve(), Path(a.job).resolve()
    if a.mode == "analyse":
        analyse(src, job)
    else:
        base(src, job, a.t_in, a.t_out, a.crop_x, a.fps)
