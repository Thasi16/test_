"""Strict migration release gate. Exit nonzero on any unexplained parity failure."""
import argparse
import json
from pathlib import Path
import numpy as np
# TensorFlow-only control on identical landmarks measured <=3.815e-6 logits and
# <=6.557e-7 confidence on this CPU. Masks and decoded images have zero tolerance.
LOGIT_ATOL=5e-6
CONFIDENCE_ATOL=1e-6
LANDMARK_ATOL=1e-5

def compare(baseline,candidate):
    samples=[]
    for source in sorted(baseline.glob('*.npz')):
        if source.name.endswith('.model.npz'):continue
        row={'sample':source.stem,'checks':{},'pass':True}
        other=candidate/source.name
        if not other.is_file():
            row.update(pass_=False,error='candidate_missing');row['pass']=False;samples.append(row);continue
        for original,target in [(source,other),(baseline/(source.stem+'.model.npz'),candidate/(source.stem+'.model.npz'))]:
            if not original.exists() or not target.exists():
                row['pass']=False;row['error']='model_trace_missing';continue
            with np.load(original,allow_pickle=False) as a,np.load(target,allow_pickle=False) as b:
                for key in a.files:
                    x,y=a[key],b[key]
                    tolerance=LOGIT_ATOL if key=='logits' else LANDMARK_ATOL if key in ('raw','features','coords') else 0
                    matching=x.shape==y.shape and x.dtype==y.dtype
                    delta=float(np.max(np.abs(x.astype(float)-y.astype(float)))) if matching else None
                    ok=matching and bool(np.isfinite(y).all()) and delta<=tolerance
                    row['checks'][key]={'pass':ok,'atol':tolerance,'max_abs':delta,'shape':list(x.shape),'dtype':str(x.dtype)}
                    row['pass'] &= ok
        original=baseline/(source.stem+'.prediction.json');target=candidate/original.name
        if not original.exists() or not target.exists():row['pass']=False
        else:
            a,b=json.loads(original.read_text()),json.loads(target.read_text())
            delta=abs(a['confidence']-b['confidence'])
            ok=a['class_id']==b['class_id'] and a['predicted_gloss']==b['predicted_gloss'] and delta<=CONFIDENCE_ATOL
            row['checks']['prediction']={'pass':ok,'baseline':a['predicted_gloss'],'candidate':b['predicted_gloss'],
                'baseline_confidence':a['confidence'],'candidate_confidence':b['confidence'],'confidence_abs':delta,'atol':CONFIDENCE_ATOL}
            row['pass'] &= ok
        samples.append(row)
    return {'passed':len(samples)==6 and all(s['pass'] for s in samples),'samples':samples,
            'note':'Same top-1 labels alone do not establish parity.'}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('baseline',type=Path);parser.add_argument('candidate',type=Path);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();report=compare(args.baseline,args.candidate);args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2,ensure_ascii=True)+chr(10))
    print(json.dumps({'passed':report['passed'],'samples':len(report['samples']),'failed_samples':[s['sample'] for s in report['samples'] if not s['pass']]}))
    raise SystemExit(0 if report['passed'] else 1)
