"""Build a private, allowlisted context from the checksum-verified original export.
No .env, training data, optimizer exports or unrelated recognition models are copied.
Run again after source changes. Generated model/src are ignored by Git, not Vercel.
"""
import argparse
import hashlib
import json
import shutil
from pathlib import Path
from ai_inference.app.siformer_loader import inspect_export
ROOT = Path(__file__).resolve().parents[2]

def package(model):
    cfg, labels, state = inspect_export(model)
    receipt=json.loads((ROOT/'ai_inference/deploy/source-receipt.json').read_text())
    for name, expected in receipt.items():
        candidate=(model/name).resolve()
        if not candidate.is_relative_to(model.resolve()) or hashlib.sha256(candidate.read_bytes().replace(b"\r\n",b"\n")).hexdigest()!=expected:
            raise ValueError('Original packaged source checksum mismatch: '+name)
    destination = ROOT/'ai_service'
    # Rebuild only generated folders after verifying their resolved boundaries.
    for name in ('src','model'):
        target=destination/name
        if target.is_symlink() or target.resolve().parent != destination.resolve():
            raise ValueError('Refusing to replace a path outside ai_service')
        if target.exists(): shutil.rmtree(target)
    files = ['run/best.json','run/config.json','run/labels.json','run/epoch_0047.json']
    files += ['run/'+name for name in state['files']]
    # Include package dependencies but never training data/vendor models.
    for name in ('vsl','vsl_tf'):
        files += [p.relative_to(model).as_posix() for p in (model/'project'/name).rglob('*.py')]
    files += ['project/'+name for name in state['code_identity']]
    files += [p.relative_to(model).as_posix() for p in (model/'project/vendor/siformer_official').rglob('*.py')]
    for name in sorted(set(files)):
        source = model/name
        if not source.resolve().is_relative_to(model.resolve()):
            raise ValueError('Model receipt path escapes export')
        target = destination/'model'/name
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(source,target)
    inspect_export(destination/'model')
    for source in (ROOT/'ai_inference').rglob('*'):
        if not source.is_file() or source.suffix not in ('.py','.json') or '__pycache__' in source.parts or 'tests' in source.parts or 'reports' in source.parts:
            continue
        relative=source.relative_to(ROOT/'ai_inference')
        allowed=(relative.parts[0] in ('app','landmarks') or relative.as_posix() in (
            '__init__.py','model_worker.py','landmark_worker.py','deploy/__init__.py',
            'deploy/serve.py','deploy/source-receipt.json','deploy/capture_parity.py'))
        if not allowed: continue
        target=destination/'src'/source.relative_to(ROOT)
        target.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(source,target)
    for name in ('backend/__init__.py','backend/app/__init__.py','backend/app/services/__init__.py'):
        target=destination/'src'/name; target.parent.mkdir(parents=True,exist_ok=True); target.touch()
    shutil.copyfile(ROOT/'backend/app/services/ai_tokens.py',destination/'src/backend/app/services/ai_tokens.py')
    manifest={p.relative_to(destination).as_posix():dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
              for sub in ('model','src') for p in (destination/sub).rglob('*') if p.is_file()}
    (destination/'src/package-manifest.json').write_text(json.dumps(manifest,indent=2))
    print(json.dumps(dict(files=len(manifest),bytes=sum(v['bytes'] for v in manifest.values()))))
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--model-root',type=Path,required=True)
    package(parser.parse_args().model_root)
