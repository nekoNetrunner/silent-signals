"""Independent Python three-slot oracle. Values and adjacency are explicit."""
import json
from pathlib import Path

def fixture():
    adjacency = [[1], [0, 2], [1]]
    tape = [[0.1, 0.1, 0.1], [0.1, 0.9, 0.1]]
    p = [1., 1., 1.]
    state = [0,0,0]
    energy = [23760.] * 3
    frames = []
    for step, draws in enumerate(tape,1):
        effective = [max(.02,min(1,v)) for v in p]
        contenders = [int(s==0 and u<pr) for s,u,pr in zip(state,draws,effective)]
        for phase in ("contention","confirmation","announcement"):
            tx = contenders[:]
            heard = [int(any(tx[j] for j in js) and (not tx[i] or phase!="announcement")) for i,js in enumerate(adjacency)]
            if phase == "contention":
                p = [max(.02,v/2) if h else min(1,v*2) for v,h in zip(p,heard)]
            for i in range(3):
                energy[i] -= .00627 if tx[i] else .0132
            if phase=="announcement":
                state=[1 if b else 2 if h else 0 for b,h in zip(tx,heard)]
            else:
                contenders=[int(b and not h) for b,h in zip(tx,heard)]
            frames.append(dict(slot=len(frames)+1,step=step,phase=phase,state=state[:],p=p[:],
                               eff=effective[:],energy=energy[:],tx=tx,heard=heard))
    return {"format":"silent-signals-python-v1","protocol":"P5","seed":0,"scenario":"three-node fixture",
            "pos":[[.15,.5],[.5,.5],[.85,.5]],"edges":[[0,1],[1,2]],"tape":tape,"frames":frames}

if __name__=="__main__":
    target=Path(__file__).resolve().parent.parent/"viz"/"python-trace.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(fixture(),indent=2)+"\n",encoding="utf-8")

