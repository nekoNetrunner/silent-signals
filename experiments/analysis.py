"""Read measured CSVs. Treat a whole deployment as a single sampling unit."""
import csv
import hashlib
import math
from collections import defaultdict
from pathlib import Path
import numpy as np

def read_runs(directory):
    experiments = {}
    for path in sorted((Path(directory)/"results").glob("e[1-7]_*.csv")):
        runs = {}
        for r in _rows(path):
            rid=r["run_id"]
            if rid not in runs:
                runs[rid]={key:r[key] for key in ("run_id","scenario_id","pair_id","topology","protocol","variant","profile","mode","status","graph_hash")}
                runs[rid].update(n=int(r["n"]),d=int(r["target_degree"]),loss=float(r["loss"]),seed=int(r["seed"]),deaths=[],nodes={},edges=[])
            item=runs[rid]
            m=r["metric"]; v=float(r["value"]) if r["value"]!="NA" else math.nan
            if m=="death_s": item["deaths"].append(v)
            elif m in ("x","y","head"): item["nodes"].setdefault(int(r["node"]),{})[m]=v
            elif m=="edge": item["edges"].append(tuple(map(int,r["edge"].split("-"))))
            else: item[m]=v
        experiments[int(path.name[1])]=list(runs.values())
    return experiments

def _rows(path):
    with path.open(encoding="utf-8",newline="") as stream:
        yield from csv.DictReader(stream)

def select(rows,**criteria):
    return [r for r in rows if all(r[k]==v for k,v in criteria.items())]

def interval(values,key,stat=np.median,reps=2000):
    a=np.asarray(values,dtype=float)
    a=a[np.isfinite(a)]
    if not len(a): return (math.nan,)*3
    seed=int.from_bytes(hashlib.sha256(("bootstrap/"+str(key)).encode()).digest()[:8],"big")
    rng=np.random.Generator(np.random.PCG64(seed))
    dist=stat(rng.choice(a,(reps,len(a))),axis=1)
    return float(stat(a)),*np.percentile(dist,[2.5,97.5]).tolist()

def exact(k,n):
    if not n:return math.nan,math.nan
    def cdf(p,last):
        return sum(math.comb(n,j)*p**j*(1-p)**(n-j) for j in range(last+1))
    def root(last,target):
        lo,hi=0.,1.
        for _ in range(54):
            mid=(lo+hi)/2
            if cdf(mid,last)>target: lo=mid
            else: hi=mid
        return (lo+hi)/2
    return (0 if k==0 else root(k-1,.975),1 if k==n else root(k,.025))

def km_median(times,events):
    remaining=len(times); surv=1.
    for t in sorted(set(times)):
        group=[v for x,v in zip(times,events) if x==t]
        surv*=1-sum(group)/remaining
        if surv<=.5:return t
        remaining-=len(group)
    return math.nan

def infer(data,out):
    output=Path(out)/"analysis";output.mkdir(exist_ok=True)
    records=[]
    def add(exp,sc,comparison,metric,unit,method,n,val,lo,hi,success=""):
        records.append([exp,sc,comparison,metric,unit,method,n,val,lo,hi,success])
    for exp,rows in data.items():
        strata=defaultdict(list)
        for r in rows:strata[r["scenario_id"]].append(r)
        for sc,group in strata.items():
            arms=defaultdict(dict)
            for r in group:arms[(r["protocol"],r["variant"])][r["seed"]]=r
            for arm,armrows in arms.items():
                vals=list(armrows.values())
                if exp in (1,2,3,4,6):
                    for met in ["independent","dominating","valid_mis"]:
                        k=sum(1-r[met] for r in vals);n=len(vals)
                        add(exp,sc,"/".join(arm),met+"_violation","fraction","Clopper-Pearson",n,k/n,*exact(int(k),n),int(k))
                if exp in (5,7):
                    for endpoint in ("fnd","hnd","lnd"):
                        t=[r[endpoint+"_s"] for r in vals];ev=[r[endpoint+"_event"] for r in vals]
                        med=km_median(t,ev)
                        # Quantile bootstrap retains unreached medians as +infinity.
                        rng=np.random.default_rng(int.from_bytes(hashlib.sha256(str((sc,arm,endpoint)).encode()).digest()[:8],"big"))
                        sims=[]
                        for idx in rng.integers(len(t),size=(2000,len(t))):
                            x=km_median([t[i] for i in idx],[ev[i] for i in idx]);sims.append(x if math.isfinite(x) else math.inf)
                        lo,hi=np.quantile(sims,[.025,.975],method="inverted_cdf")
                        add(exp,sc,"/".join(arm),endpoint+"_median","s","Kaplan-Meier; deployment bootstrap",len(t),med,lo,hi,int(sum(ev)))
            if exp==4:
                contrasts=[(("P4","M1"),("P5","native")),(("P4","M1"),("JSX","native")),(("JSX","native"),("P5","native")),(("P5","bias-off"),("P5","native"))]
                contrasts += [(("P4",v),("P4","M1")) for v in ("M2","M4","oracle-M1")]
                metrics=[("capped_time","slot")]
            elif exp in (1,2,3,5):
                contrasts=[(("P5","native"),b) for b in arms if b!=("P5","native")]
                metrics={1:[("setup_slots","slot"),("setup_J","J")],2:[("valid_mis","fraction")],3:[("orphan_rate","fraction"),("adjacent_pairs_per_head","pairs/head")],5:[("fnd_s","s"),("hnd_s","s"),("lnd_s","s"),("service_fraction","fraction"),("joules_per_delivered","J/report")]}[exp]
            elif exp==6:
                contrasts=[(("P5","confirm"),("P5","no-confirm"))];metrics=[("independent","fraction"),("dominating","fraction"),("election_slots","slot")]
            else:
                contrasts=[(("P5","primary"),b) for b in arms if b!=("P5","primary")]
                contrasts += [(("P5",v),("P2",v)) for p,v in arms if p=="P2"]
                metrics=[("fnd_s","s"),("service_fraction","fraction"),("joules_per_delivered","J/report")]
            for a,b in contrasts:
                if a not in arms or b not in arms:continue
                paired=[(arms[a][s],arms[b][s]) for s in sorted(arms[a].keys() & arms[b].keys())]
                for m,unit in metrics:
                    for op in ("difference","ratio"):
                        vals=[x[m]-y[m] if op=="difference" else x[m]/y[m] for x,y in paired if (op=="difference" or y[m]!=0)]
                        vals=[z for z in vals if math.isfinite(z)]
                        ci=interval(vals,(sc,a,b,m,op))
                        add(exp,sc,"/".join(a)+" vs "+"/".join(b),m+"_"+op,unit if op=="difference" else "ratio","paired median; percentile bootstrap",len(vals),*ci)
                if exp==4:
                    good=[(x,y) for x,y in paired if all(r["status"]=="completed" and r["valid_mis"] for r in (x,y))]
                    vals=[x["election_slots"]/y["election_slots"] for x,y in good]
                    add(exp,sc,"/".join(a)+" vs "+"/".join(b),"successful_pair_ratio","ratio","paired median; percentile bootstrap",len(paired),*interval(vals,(sc,a,b,"success")),len(good))
    path=output/"inference.csv"
    with path.open("w",encoding="utf-8",newline="") as f:
        w=csv.writer(f,lineterminator="\n")
        w.writerow("experiment scenario comparison metric unit method denominator estimate low95 high95 event_count_or_successful_pairs".split())
        for row in records:w.writerow(["NA" if isinstance(v,(float,np.floating)) and not math.isfinite(v) else v for v in row])
    return records

