"""Offline parity capture. Never exposed by the inference API."""
import argparse
import base64
import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np


def landmarks(args):
    from ai_inference.landmark_worker import prepare
    from ai_inference.landmarks import video
    from ai_inference.landmarks.landmark_encoder import (
        build_landmark_detector, extract_raw_landmarks, preprocess_landmarks,
    )
    cfg = json.loads((Path(video.__file__).parent / 'preprocessing.json').read_text())
    decoder = video.decode_video
    imdecode = video.cv2.imdecode
    decoded = []
    def capture_decode(*a, **kw):
        rgb, meta = decoder(*a, **kw)
        decoded.append(rgb)
        return rgb, meta
    def capture_jpeg(*a, **kw):
        bgr = imdecode(*a, **kw)
        if bgr is not None:
            decoded.append(video.cv2.cvtColor(bgr, video.cv2.COLOR_BGR2RGB)[None])
        return bgr
    video.decode_video = capture_decode
    video.cv2.imdecode = capture_jpeg
    args.output.mkdir(parents=True, exist_ok=True)
    with build_landmark_detector(cfg['landmark_extraction']) as detector:
        for source in sorted(args.inputs.iterdir()):
            if source.suffix not in ('.mp4', '.webm', '.json'):
                continue
            tick = time.perf_counter()
            decoded.clear()
            clip = prepare(source)
            raw = extract_raw_landmarks(clip, detector)
            features, detection = preprocess_landmarks(raw)
            rgb = np.concatenate(decoded)
            np.savez_compressed(args.output / (source.stem + '.npz'),
                decoded=rgb, frames=clip['frames'], indices=clip['frame_indices'],
                valid=clip['valid_mask'], padding=clip['padding_mask'],
                raw=raw['landmarks'], features=features, detection=detection)
            report = dict(input_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                bytes=source.stat().st_size, decoded_frames=len(rgb),
                indices=clip['frame_indices'].tolist(),
                preprocessing_ms=(time.perf_counter()-tick)*1000,
                provenance=detector.provenance)
            (args.output / (source.stem + '.json')).write_text(json.dumps(report, indent=2))
            print(json.dumps(dict(sample=source.name, bytes=report['bytes'], decoded=len(rgb))), flush=True)


def model(args):
    from ai_inference.app.preprocessing import to_siformer
    from ai_inference.app.siformer_loader import SiformerRuntime
    runtime = SiformerRuntime(args.model_root)
    for source in sorted(args.inputs.glob('*.npz')):
        if source.name.endswith('.model.npz'):
            continue
        with np.load(source, allow_pickle=False) as data:
            coords = to_siformer(data['features'], data['detection'], data['valid'], runtime)
        result = runtime.predict(coords)
        runtime.model.attention_rng.reset_from_seed(runtime.cfg['seed'] + 17)
        logits = runtime.model(runtime.tf.convert_to_tensor(coords[None], runtime.tf.float32), training=False).numpy()
        softmax = runtime.tf.nn.softmax(logits, axis=-1).numpy()
        np.savez(args.inputs / (source.stem + '.model.npz'), coords=coords, logits=logits, softmax=softmax)
        result.update(class_id=runtime.labels[result['predicted_gloss']], model_loading_ms=runtime.load_ms,
                      numpy_version=np.__version__, tensorflow_version=runtime.tf.__version__)
        (args.inputs / (source.stem + '.prediction.json')).write_text(json.dumps(result, ensure_ascii=True, indent=2))
        print(json.dumps(dict(sample=source.stem, **result)), flush=True)


def http(args):
    from urllib.request import Request, urlopen
    from ai_inference.app.config import Settings
    from backend.app.services.ai_tokens import issue
    settings = Settings()
    reports = []
    for source in sorted(args.inputs.iterdir()):
        if source.suffix not in ('.mp4', '.json'):
            continue
        token = issue(settings.ai_token_secret.get_secret_value(), 'parity-'+source.stem,
                      args.origin, '')
        request = Request(args.url+'/infer', data=source.read_bytes(), headers={
            'Origin':args.origin, 'Authorization':'Bearer '+token,
            'Content-Type':'application/json' if source.suffix=='.json' else 'video/mp4'})
        with urlopen(request, timeout=90) as response:
            result = json.load(response)
        reports.append(dict(sample=source.name, bytes=source.stat().st_size, response=result))
        print(json.dumps(reports[-1]), flush=True)
    args.output.write_text(json.dumps(reports, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('stage', choices=['landmarks', 'model', 'http'])
    parser.add_argument('--inputs', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--model-root', type=Path)
    parser.add_argument('--url', default='http://127.0.0.1:8018')
    parser.add_argument('--origin', default='https://test-signhearing.vercel.app')
    args = parser.parse_args()
    globals()[args.stage](args)
