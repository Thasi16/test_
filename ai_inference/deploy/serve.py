"""Single ASGI worker owns the original serialized model/landmark processes."""
import os
import uvicorn
if __name__ == '__main__':
    from pathlib import Path
    import json
    from ai_inference.app.siformer_loader import inspect_export, sha256
    root=Path(__file__).resolve().parents[2]
    inspect_export(root/'model')
    receipt=json.loads((root/'ai_inference/deploy/source-receipt.json').read_text())
    for name,expected in receipt.items():
        source=(root/'model'/name).resolve()
        if not source.is_relative_to(root/'model') or sha256(source,text=True)!=expected:
            raise RuntimeError('Packaged source integrity failed')
    uvicorn.run('ai_inference.app.main:app', host='0.0.0.0', port=int(os.environ.get('PORT','80')),
                workers=1, access_log=False, timeout_graceful_shutdown=25)
