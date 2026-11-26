"""Produce the numeric tables used in the reader's report."""
import json
from pathlib import Path
import numpy as np
from .analysis import read_runs,select,interval,exact
def highlights(root):
    data=read_runs(root);out={}
    def stats(label,exp,metric,**filters):
        rr=select(data[exp],**filters)
        out[label]=dict(csv=exp,metric=metric,filters=filters,n=len(rr),median_ci=interval([r[metric] for r in rr],(exp,metric,filters)))
    for p in ['P1','P2','P3','P4','P5','JSX']:
        filt=dict(n=100,topology='rgg',protocol=p)
        if p!='JSX':
            for met in ['election_slots','setup_slots','setup_per_node','associated']:stats('E1 '+p+' '+met,1,met,**filt)
        rr=select(data[2],**filt);n=len(rr);k=int(sum(r['valid_mis'] for r in rr))
        out['E2 '+p]=[k,n,*exact(k,n)]
    for prof in ['full','heterogeneous']:
        for p,v in [('P1','native'),('P2','native'),('P5','native'),('CTRL','uniform-exact'),('CTRL','weighted-exact')]:
            for m in ['orphan_rate','adjacent_pairs_per_head','heads']:
                stats('E3 '+prof+' '+p+' '+v+' '+m,3,m,n=100,d=8,profile=prof,protocol=p,variant=v)
        for p,v in [('P4','M1'),('JSX','native'),('P5','native'),('P5','bias-off')]:
            for m in ['election_slots','capped_time']:
                stats('E4 '+prof+' '+p+' '+v+' '+m,4,m,n=100,d=8,profile=prof,protocol=p,variant=v)
        for p,v in [('P1','native'),('P2','native'),('JSX','native'),('P4','native'),('P5','native'),('P5','bias-off')]:
            for m in ['fnd_s','service_fraction','joules_per_delivered','delivered','rotations','idle_share','hnd_s','lnd_s']:
                stats('E5 '+prof+' '+p+' '+v+' '+m,5,m,n=100,profile=prof,protocol=p,variant=v)
    for mode in ['directional','symmetric']:
        for loss in [0,.1,.2]:
            for p,v in [('P4','M1'),('P5','confirm'),('P5','no-confirm')]:
                rr=select(data[6],mode=mode,loss=loss,protocol=p,variant=v);n=len(rr)
                for m in ['independent','dominating']:
                    k=int(sum(1-r[m] for r in rr));out[f'E6 {mode} {loss} {p} {v} {m}']=[k,n,*exact(k,n)]
    for v in ['primary','half-duplex','rotation-off','maintenance-off','floor-0','floor-0.02','floor-0.2']:
        for m in ['fnd_s','service_fraction','rotations','joules_per_delivered','setup_J']:
            stats('E7 '+v+' '+m,7,m,variant=v,protocol='P5')
    path=Path(root)/'analysis/highlights.json'
    path.write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':highlights(Path(__file__).resolve().parents[1])

