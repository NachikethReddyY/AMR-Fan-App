"""Evaluate a frozen synthetic split against the single leased HTTP service."""
import argparse
import json
import math
from pathlib import Path
import statistics
import time
import urllib.request
from runtime import ROOT, QUESTIONS


def request(path, payload=None):
    body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode()
    req = urllib.request.Request('http://127.0.0.1:55434' + path, data=body, headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=6) as response:
        raw = response.read(65537)
        if len(raw)>65536: raise ValueError('oversized response')
        return json.loads(raw), len(raw), len(body or b'')


def interval(correct,total):
    z=1.96; p=correct/total; denominator=1+z*z/total
    center=(p+z*z/(2*total))/denominator
    radius=z*math.sqrt(p*(1-p)/total+z*z/(4*total*total))/denominator
    return [round(center-radius,3),round(center+radius,3)]


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--split',choices=['selection','held-out'],required=True)
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if args.output.exists(): raise SystemExit('Refusing to overwrite evaluation evidence')
    fixtures=json.loads((ROOT/f'services/api/ai/evaluation/laya-{args.split}.json').read_text())
    health,_,_=request('/health')
    results=[]
    for fixture in fixtures:
        started=time.perf_counter()
        try:
            result,received,sent=request('/v1/systemone',{'state':fixture['text'],'questions':{fixture['task']:QUESTIONS[fixture['task']]}})
            answer=result['answers'][fixture['task']]
            actual=answer['choice']
            confidence=answer.get('confidence')
            failure=None
        except Exception as error:
            actual=None; confidence=None; received=sent=0; failure=type(error).__name__
        results.append({'id':fixture['id'],'task':fixture['task'],'language':fixture['language'],'expected':fixture['expected'],'actual':actual,'correct':actual==fixture['expected'],'confidence':confidence,'ms':round((time.perf_counter()-started)*1000,2),'requestBytes':sent,'responseBytes':received,'failure':failure})
    groups={}
    for dimension in ['task','language']:
        groups[dimension]={}
        for label in sorted(set(r[dimension] for r in results)):
            rows=[r for r in results if r[dimension]==label]; correct=sum(r['correct'] for r in rows)
            groups[dimension][label]={'correct':correct,'total':len(rows),'accuracy':round(correct/len(rows),3),'wilson95':interval(correct,len(rows))}
    final,_,_=request('/health')
    durations=sorted(r['ms'] for r in results)
    report={'split':args.split,'healthBefore':health,'healthAfter':final,'groups':groups,'latency':{'firstMs':results[0]['ms'],'medianMs':statistics.median(durations),'maxMs':max(durations)},'results':results}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['split','groups','latency']},indent=2))

if __name__=='__main__': main()
