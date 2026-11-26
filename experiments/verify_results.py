"""Independent observer for published CSVs. Fails on inconsistent accounting."""
from collections import Counter
import argparse
import hashlib
import json
import math
from pathlib import Path
from .analysis import read_runs,exact
from src.verify import check_mis
import numpy as np

def digest(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def verify(out,replica=None):
    cfg=Path(__file__).resolve().parents[1]/"configs/default.yaml"
    data=read_runs(out);assert set(data)==set(range(1,8))
    statuses={};checks=0;known={}
    for exp,runs in data.items():
        statuses[exp]=dict(Counter(r['status'] for r in runs))
        for r in runs:
            pair=(r['topology'],r['n'],r['d'],r['seed'])
            assert known.setdefault(pair,r['graph_hash'])==r['graph_hash']
            if exp in (5,7):
                assert 0<=r['delivered']<=r['generated']<=r['fixed_opportunities']
                assert math.isclose(r['spent_J'],sum(r[k] for k in ('idle_J','data_J','setup_J','maintenance_J')),rel_tol=1e-9)
                assert r['fnd_s']<=r['hnd_s']<=r['lnd_s']
                dt=sorted(r['deaths']);assert len(dt)+r['terminal_alive']==r['n']
                horizon=604800 if r['n']==100 else 900
                assert math.isclose(sum(dt)+r['terminal_alive']*horizon,
                                    r['tx_s']+r['rx_s']+r['idle_mode_s'],rel_tol=1e-7)
                assert r['valid_elections']<=r['observed_elections']
                for m,i in [('fnd',0),('hnd',math.ceil(r['n']/2)-1),('lnd',r['n']-1)]:
                    assert r[m+'_event']==int(i<len(dt))
                    if i<len(dt):assert math.isclose(r[m+'_s'],dt[i],abs_tol=1e-5)
            else:
                assert r['valid_mis']==(r['dominating'] and r['independent'])
                assert r['independent']==(r['adjacent_pairs']==0)
                assert r['dominating']==(r['orphans']==0)
                assert math.isclose(r['orphan_rate'],r['orphans']/r['n'],abs_tol=1e-10)
                if exp==1:assert r['setup_slots']>=r['election_slots'] and r['setup_J']>=r['election_J']
            if r['nodes']:
                n=r['n'];A=np.zeros((n,n),np.uint8)
                for i,j in r['edges']:A[i,j]=A[j,i]=1
                assert hashlib.sha256(A.tobytes()).hexdigest()==r['graph_hash']
                heads={i for i,v in r['nodes'].items() if v['head']}
                v=check_mis(A,heads);assert int(v['valid_mis'])==r['valid_mis'] and v['heads']==r['heads']
                checks+=1
    targets={r['pair_id']:r for r in data[3] if r['protocol']=='P5'}
    for r in data[3]:
        if r['protocol']=='P5':continue
        t=targets[r['pair_id']];assert r['requested_heads']==t['heads'] and r['p5_valid']==t['valid_mis']
        if r['variant'].endswith('-exact'):assert r['heads']==t['heads']
    assert abs(exact(0,50)[1]-.07112173646)<1e-8
    hashes={p.name:digest(p) for p in sorted((out/'results').glob('e*.csv'))}
    if replica:
        for f,h in hashes.items():assert digest(replica/'results'/f)==h,f
    result={'runs':{i:len(x) for i,x in data.items()},'statuses':statuses,'independently_reconstructed_graphs':checks,'config_sha256':digest(cfg),'sha256':hashes,'independent_rerun_csv_hashes_match':True if replica else None}
    dest=out/'analysis';dest.mkdir(exist_ok=True)
    (dest/'verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,indent=2))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('out',type=Path);p.add_argument('--replica',type=Path);a=p.parse_args();verify(a.out,a.replica)

