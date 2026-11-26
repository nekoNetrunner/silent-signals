"""All displayed quantities, positions and connectivity come from experiment CSVs."""
from pathlib import Path
import math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.collections import LineCollection
import numpy as np
from .analysis import read_runs, select, interval, exact, infer

COLOR=dict(P0="#9e9e9e",P1="#f57c00",P2="#ffb300",P3="#151515",P4="#1565c0",P5="#2e7d32",JSX="#784899",CTRL="#516579")
MARK=dict(P0="x",P1="^",P2="s",P3="D",P4="o",P5="P",JSX="v",CTRL="h")
def plot(out):
    out=Path(out);data=read_runs(out);infer(data,out)
    dest=out/"figures";dest.mkdir(exist_ok=True)
    plt.rcParams.update({"font.family":"DejaVu Sans","font.size":9,"axes.spines.top":False,"axes.spines.right":False,"axes.titlelocation":"left","axes.axisbelow":True,"pdf.fonttype":42})
    def canvas(title,subtitle,panels=1,rows=1,height=5):
        fig,axs=plt.subplots(rows,panels,figsize=(10,height),squeeze=False)
        fig.subplots_adjust(top=.77,bottom=.22,left=.085,right=.97,wspace=.29,hspace=.55)
        fig.text(.045,.95,title,fontsize=17,weight="bold",va="top",color="#193629")
        fig.text(.045,.88,subtitle,fontsize=9,color="#4b5953",va="top")
        return fig,axs.flatten()
    def save(fig,name,axes,legend=True):
        if legend:
            entries={}
            for ax in axes:
                handles,labels=ax.get_legend_handles_labels()
                entries.update(zip(labels,handles))
            if entries:fig.legend(entries.values(),entries.keys(),loc="lower center",ncol=min(5,len(entries)),frameon=False,fontsize=8,bbox_to_anchor=(.5,.01))
        fig.savefig(dest/(name+".png"),dpi=300);fig.savefig(dest/(name+".pdf"));plt.close(fig)
    def line(ax,rows,p,x,m,label=None,ls=None,mark=None):
        if not rows:return
        xs=sorted({r[x] for r in rows});ys=[];low=[];hi=[]
        for v in xs:
            med,l,h=interval([r[m] for r in rows if r[x]==v],(p,label,x,m,v));ys.append(med);low.append(l);hi.append(h)
        ax.plot(xs,ys,marker=mark or MARK[p],ls=ls or ("--" if p=="P3" else "-"),color=COLOR[p],label=label or p,ms=4)
        ax.fill_between(xs,low,hi,color=COLOR[p],alpha=.08);ax.grid(axis="y",alpha=.2)
    n=100 if any(r["n"]==100 for r in data[5]) else data[5][0]["n"]
    fig,axs=canvas("01   Eight ways sensors can be connected","One preselected deployment per family, seed 0. Filled green dots are elected EcoBeep heads.",4,2,6.5)
    for ax,r in zip(axs,select(data[2],protocol="P5",seed=0)):
        xy=np.array([[d["x"],d["y"]] for _,d in sorted(r["nodes"].items())]);heads=np.array([bool(d["head"]) for _,d in sorted(r["nodes"].items())])
        ax.add_collection(LineCollection([[xy[i],xy[j]] for i,j in r["edges"]],colors="#acbbb7",linewidths=.45))
        ax.scatter(*xy[~heads].T,s=7,c="#92a6b2");ax.scatter(*xy[heads].T,s=17,c=COLOR["P5"])
        ax.set(xlim=(-.04,1.04),ylim=(-.04,1.04),aspect="equal");ax.set_title(r["topology"]+"  ·  "+str(r["n"])+" nodes",fontsize=9);ax.axis("off")
    save(fig,"f1_topologies",axs,False)
    fig,axs=canvas("02   Time spent electing heads","Geometric graphs, target degree 8. Lines are deployment medians; shading is the 95% bootstrap interval.")
    for p in COLOR:
        if p=="CTRL":continue
        line(axs[0],select(data[1],protocol=p,topology="rgg"),p,"n","election_slots",p+(" (M=1)" if p=="P4" else ""))
    axs[0].set(xlabel="Number of sensors",ylabel="Physical slots to end of election");save(fig,"f2_rounds_vs_n",axs)
    fig,axs=canvas("03   Did the chosen heads cover and separate?","Fraction of finished sets satisfying both graph checks. Columns retain each topology separately.",height=5.6)
    pnames=["P1","P2","P3","P4","P5","JSX"];topos=list(dict.fromkeys(r["topology"] for r in data[2]))
    arr=np.array([[np.mean([r["valid_mis"] for r in select(data[2],protocol=p,topology=t)]) for t in topos] for p in pnames])
    ax=axs[0];ax.imshow(arr,cmap="Greens",vmin=0,vmax=1,aspect="auto");ax.set(yticks=range(len(pnames)),yticklabels=pnames,xticks=range(len(topos)),xticklabels=topos)
    for i,j in np.ndindex(arr.shape):ax.text(j,i,f"{arr[i,j]:.2f}",ha="center",va="center",color="white" if arr[i,j]>.65 else "#182d22")
    save(fig,"f3_correctness",axs,False)
    fig,axs=canvas("04   The cost of becoming ready to collect reports",f"Geometric graphs, n={n}. Election plus advertisements, joins and schedules. Ideal sender feedback has no extra measured cost.",2)
    for ax,m,y in zip(axs,["setup_slots","setup_per_node"],["Physical slots","Energy per sensor (mJ)"]):
        for i,p in enumerate(["P0","P1","P2","P3","P4","P5"]):
            a,b,c=interval([r[m] for r in select(data[1],topology="rgg",n=n,protocol=p)],(m,p))
            ax.bar(i,a,color=COLOR[p]);ax.errorbar(i,a,yerr=[[a-b],[c-a]],color="#223328",capsize=2)
        ax.set(xticks=range(6),xticklabels=["P0","P1","P2","P3","P4","P5"],ylabel=y)
    save(fig,"f4_setup_cost",axs,False)
    for number,m,y,title,name in [(5,"orphan_rate","Fraction with no reachable head","Who is left without a nearby head?","f5_coverage_vs_n"),(6,"adjacent_pairs_per_head","Adjacent head pairs per head","How often do neighboring sensors both lead?","f6_adjacent_ch")]:
        fig,axs=canvas(f"0{number}   {title}","Geometric graphs, target degree 8. Native elections and controls given exactly the paired EcoBeep head count.",2)
        for ax,prof in zip(axs,["full","heterogeneous"]):
            for p,v,lab,style in [("P1","native","P1 LEACH","-"),("P2","native","P2 weighted LEACH","--"),("P5","native","P5 EcoBeep","-"),("CTRL","uniform-exact","Uniform exact count",":"),("CTRL","weighted-exact","Weighted exact count","--")]:
                line(ax,select(data[3],protocol=p,variant=v,d=8,profile=prof),p,"n",m,lab,style)
            ax.set(title="Equal batteries" if prof=="full" else "Unequal batteries",xlabel="Number of sensors",ylabel=y)
        save(fig,name,axs)
    fig,axs=canvas("07   Global timing versus local feedback","Paired geometric networks, degree target 8. An incomplete or invalid election scores the 4,096-slot limit.",2)
    for ax,prof in zip(axs,["full","heterogeneous"]):
        for p,v,lab in [("P4","M1","Afek (M=1)"),("JSX","native","Published local feedback"),("P5","native","EcoBeep"),("P5","bias-off","EcoBeep, bias off")]:
            line(ax,select(data[4],protocol=p,variant=v,profile=prof,d=8),p,"n","capped_time",lab,"--" if v=="bias-off" else "-")
        ax.set(title=prof.capitalize()+" starting energy",xlabel="Number of sensors",ylabel="Capped physical slots")
    save(fig,"f7_headtohead",axs)
    fig,axs=canvas("08   How many sensors are still alive?","Lines show the mean living fraction across deployments. Bands resample whole deployments. Ideal sender-feedback radio.",2)
    horizon=604800 if n==100 else 900;unit=86400 if n==100 else 60
    for ax,prof in zip(axs,["full","heterogeneous"]):
        for p in ["P0","P1","P2","P3","P4","JSX","P5"]:
            rr=select(data[5],protocol=p,variant="native",profile=prof);tt=np.linspace(0,horizon,220)
            surv=np.array([1-np.searchsorted(np.sort(r["deaths"]),tt,side="right")/r["n"] for r in rr])
            means=surv.mean(axis=0);rng=np.random.default_rng(612);boot=surv[rng.integers(len(rr),size=(2000,len(rr)))].mean(axis=1);lo,hi=np.percentile(boot,[2.5,97.5],axis=0)
            ax.plot(tt/unit,means,color=COLOR[p],label=p,ls="--" if p=="P3" else "-",marker=MARK[p],markevery=36,ms=3);ax.fill_between(tt/unit,lo,hi,color=COLOR[p],alpha=.07)
        ax.set(title=prof.capitalize()+" starting energy",xlabel="Simulated "+("days" if n==100 else "minutes"),ylabel="Living fraction",ylim=(-.03,1.03))
    save(fig,"f8_lifetime",axs)
    fig,axs=canvas("09   Does the first death depend on radio current?","Cells show the median paired difference in restricted time to first death, EcoBeep minus weighted LEACH. Positive favors EcoBeep.",height=5.4)
    A=np.zeros((3,3))
    for i,idle in enumerate(["0.5","1","2"]):
        for j,rx in enumerate(["0.7","1","1.3"]):
            rr=select(data[7],variant=f"current-{idle}-{rx}")
            a={r["seed"]:r["fnd_s"] for r in rr if r["protocol"]=="P2"}
            A[i,j]=np.median([r["fnd_s"]-a[r["seed"]] for r in rr if r["protocol"]=="P5"])/60
    ax=axs[0];v=max(1,np.abs(A).max());ax.imshow(A,cmap="BrBG",vmin=-v,vmax=v,aspect="auto")
    for i,j in np.ndindex(A.shape):ax.text(j,i,f"{A[i,j]:+.1f} min",ha="center",va="center",color="white" if abs(A[i,j])>.65*v else "black")
    ax.set(xticks=range(3),xticklabels=["0.7×","1×","1.3×"],xlabel="Receive current multiplier",yticks=range(3),yticklabels=["0.5×","1×","2×"],ylabel="Idle current multiplier")
    save(fig,"f9_sensitivity",axs,False)
    fig,axs=canvas("10   Changing the minimum chance of volunteering","EcoBeep lifetime runs on unequal batteries. Coverage loss accumulates only while a sensor is alive.",3)
    floors=[{**r,"floor":float(r["variant"].split("-")[1]),"fnd_h":r["fnd_s"]/3600,
             "uncovered_h":r["uncovered_node_s"]/r["n"]/3600} for r in data[7] if r["variant"].startswith("floor-")]
    for ax,m,y in zip(axs,["uncovered_h","service_fraction","fnd_h"],["Uncovered hours / initial sensor","Delivered / fixed opportunities","Restricted first-death time (hours)"]):
        line(ax,floors,"P5","floor",m);ax.set(xlabel="Minimum probability",ylabel=y)
    save(fig,"f10_pfloor",axs,False)
    fig,axs=canvas("11   When a beep goes missing","Points are observed rates of adjacent heads. Vertical bars are two-sided 95% exact binomial intervals.",2)
    for ax,mode in zip(axs,["directional","symmetric"]):
        for p,var,lab,off in [("P4","M1","Afek (M=1)",-.0015),("P5","confirm","EcoBeep confirmation",0),("P5","no-confirm","EcoBeep, no confirmation",.0015)]:
            rr=select(data[6],protocol=p,variant=var,mode=mode);xs=sorted({r["loss"] for r in rr});ys=[];err=[]
            for x in xs:
                r=select(rr,loss=x);k=int(sum(1-i["independent"] for i in r));v=k/len(r);lo,hi=exact(k,len(r));ys.append(v);err.append([v-lo,hi-v])
            ax.errorbar(np.array(xs)+off,ys,yerr=np.array(err).T,color=COLOR[p],fmt=MARK[p]+("--" if var=="no-confirm" else "-"),label=lab,capsize=2,ms=4)
        ax.set(title=mode.capitalize()+" losses",xlabel="Probability of erasing a beep",ylabel="Deployments with adjacent heads",ylim=(-.04,1.05))
    save(fig,"f11_loss",axs)

