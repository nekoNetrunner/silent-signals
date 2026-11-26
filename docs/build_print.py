"""Rebuild the reader's report and A1 poster from the measured analysis and figures."""
from pathlib import Path
import csv
import json
import math
import os
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
FONTS=Path(os.environ.get("WINDIR","C:/Windows"))/"Fonts"
REG,BOLD="Helvetica","Helvetica-Bold"
if (FONTS/"segoeui.ttf").exists():
    for face,file in [("Segoe","segoeui.ttf"),("SegoeBold","segoeuib.ttf")]:
        pdfmetrics.registerFont(TTFont(face,str(FONTS/file)))
    REG,BOLD="Segoe","SegoeBold"
ink="#162D26";green="#246744";muted="#455B52";rule="#C9D8D0";tint="#ECF4EE";gold="#C2872B";blue="#326884"
def color(c):return colors.HexColor(c)
class Sheet:
    def __init__(self,path,size):
        self.c=canvas.Canvas(str(path),pagesize=size,pageCompression=1);self.w,self.h=size
        self.c.setAuthor("Silent Signals simulation study")
    def text(self,x,y,text,size=12,font=None,fill=ink):
        self.c.setFillColor(color(fill));self.c.setFont(font or REG,size);self.c.drawString(x,self.h-y-size,text)
    def para(self,x,y,w,text,size=12,leading=None,fill=ink,bold=False):
        p=Paragraph(escape(text),ParagraphStyle("p",fontName=BOLD if bold else REG,fontSize=size,leading=leading or size*1.43,textColor=color(fill),splitLongWords=True))
        _,h=p.wrap(w,9999);p.drawOn(self.c,x,self.h-y-h);return y+h
    def rect(self,x,y,w,h,fill):
        self.c.setFillColor(color(fill));self.c.rect(x,self.h-y-h,w,h,stroke=0,fill=1)
    def line(self,x1,y1,x2,y2,c=rule,lw=1):
        self.c.setLineWidth(lw);self.c.setStrokeColor(color(c));self.c.line(x1,self.h-y1,x2,self.h-y2)
    def dot(self,x,y,r,head=False):
        self.c.setFillColor(color(green if head else "#E4EBE7"));self.c.setStrokeColor(color(green if head else "#698678"));self.c.circle(x,self.h-y,r,fill=1,stroke=1)
    def fig(self,x,y,w,h,path):
        with Image.open(path) as im:a,b=im.size
        ratio=min(w/a,h/b);ww,hh=a*ratio,b*ratio;self.c.drawImage(str(path),x+(w-ww)/2,self.h-y-hh,ww,hh,mask="auto")
        return y+hh
    def title(self,tag,title,subtitle):
        self.text(44,34,"SILENT SIGNALS     /     "+tag.upper(),9,BOLD,green)
        self.text(44,65,title,27,BOLD);self.para(44,111,self.w-88,subtitle,12.5,18,muted)
    def foot(self,page,source):
        self.line(44,758,self.w-44,758);self.para(44,768,self.w-88,source,8.1,11,muted)
        self.text(44,809,"SILENT SIGNALS   /   SIMULATION STUDY",8,BOLD,green);self.text(self.w-74,806,str(page)+" / 5",9,BOLD)
        self.c.showPage()
    def table(self,x,y,widths,headers,rows,sz=10.3,rowh=35):
        self.rect(x,y,sum(widths),rowh,tint)
        for j,head in enumerate(headers):self.para(x+sum(widths[:j])+7,y+8,widths[j]-14,head,sz-1,sz+2,green,True)
        y+=rowh
        for row in rows:
            for j,v in enumerate(row):self.para(x+sum(widths[:j])+7,y+7,widths[j]-14,str(v),sz,sz+3,ink,j==0)
            y+=rowh;self.line(x,y,x+sum(widths),y)
        return y

def report():
    h=json.loads((ROOT/"analysis/highlights.json").read_text(encoding="utf8"))
    contrast=list(csv.DictReader((ROOT/"analysis/inference.csv").open(encoding="utf8")))
    def val(k):return h[k]["median_ci"][0]
    def stat(comp,metric,exp=5,profile="heterogeneous"):
        return next(float(r["estimate"]) for r in contrast if r["experiment"]==str(exp) and r["scenario"]==f"rgg-100-8-{profile}-0-directional-ideal" and r["comparison"]==comp and r["metric"]==metric)
    s=Sheet(ROOT/"Silent Signals - Reader Report.pdf",A4);s.c.setTitle("Silent Signals | A reader’s guide to the simulation")
    s.title("Reader report","Who should collect the readings?","Imagine 100 battery-powered sensors scattered across a field. Some volunteer to collect readings from their neighbors and forward them to a base station.")
    s.rect(44,181,507,123,tint);s.para(60,197,474,"EcoBeep placed collectors well. The simplest published feedback rule elected them faster.",18,24,green,True)
    s.para(60,258,472,"Battery life and delivered readings gave different answers about which system worked best.",12,17)
    s.text(44,327,"What a good arrangement looks like",17,BOLD)
    for x,choice,label in [(105,[0,1,0],"One central collector"),(368,[1,0,1],"Two end collectors")]:
        y=395
        for i in range(2):s.line(x+43*i,y,x+43*(i+1),y,"#7E9788",2)
        for i,ishead in enumerate(choice):s.dot(x+43*i,y,11,bool(ishead))
        s.text(x-18,419,label,11,BOLD)
    s.para(44,457,507,"Both choices work. Green sensors lead. Every other sensor can reach a leader in one hop, and no two leaders are neighbors. The second arrangement uses more collectors, yet both satisfy the same spacing rule.",12)
    s.text(44,549,"Three results from the field model",17,BOLD)
    facts=[("16 points","Fewer uncovered sensors per hundred, compared with a random choice of exactly as many collectors."),
           ("2.25×","Median paired election-time ratio for Afek’s global schedule divided by EcoBeep’s time."),
           ("21.09 points","More scheduled readings delivered by EcoBeep than by energy-weighted LEACH with unequal batteries.")]
    for i,(a,b) in enumerate(facts):
        y=591+48*i;s.text(44,y,a,15,BOLD,green);s.para(171,y,379,b,10.9,15)
    s.foot(1,"Evidence for these three results appears on pages 3–4. All are simulation results. The field model is a unit-square random deployment with degree target 8.")
    s.title("How it works","From a beep to a delivered reading","A sensor can hear local activity. It knows its own battery. The simulator can see the entire network and checks what the sensors accomplished.")
    for i,(title,body) in enumerate([
        ("Choose local collectors","LEACH lets eligible sensors volunteer with a changing probability. Afek gives every sensor the same timetable. The published local-feedback rule lowers the chance of volunteering after hearing a neighbor and raises it after silence."),
        ("Build a collection schedule","EcoBeep also gives stronger batteries more chance to volunteer. A provisional winner beeps again to check for competitors. A final announcement tells listeners a head exists. Heads then advertise, members request to join and heads send their schedules."),
        ("Count readings at the station","Every living sensor creates a 32-byte reading each minute. Members send to a reachable head, which combines the readings into one packet for the sink. A reading is credited only if its aggregate arrives before the deadline.")]):
        y=183+i*119;s.text(44,y,str(i+1).zfill(2),17,BOLD,green);s.text(87,y,title,15,BOLD);s.para(87,y+28,462,body,11.2,16.5)
    s.rect(44,555,507,162,tint);s.text(60,569,"What one quiet slot costs",15,BOLD,green)
    s.para(60,599,471,"At 3.3 volts, listening for a whole 40-millisecond slot costs 13.20 millijoules even when no neighbor beeps. Sending for 5 milliseconds and idling for 35 costs 6.27 millijoules. Idling for the full slot costs 2.64 millijoules.",11.5,17)
    s.para(60,674,471,"Energy = voltage × current × time. The model charges every living sensor for exactly the time it spends in each mode.",10.6,15,muted)
    s.foot(2,"Model inputs and worked arithmetic: configs/default.yaml and README §7. Manufacturer context: ESP32 Series Datasheet v5.3, RF Table 5-4. Simultaneous sender feedback is an idealized radio feature.")
    s.title("Coverage and speed","Where the heads land matters","Each comparison below uses the same 50 deployments, 100 sensors per deployment and reliable links. Numbers are deployment medians unless stated otherwise.")
    s.text(44,185,"Equal head counts, different coverage",16,BOLD)
    s.para(44,215,507,"EcoBeep elected a median of 23 heads. Choosing exactly its head count uniformly at random on each map left a median 16% of sensors without a nearby head. EcoBeep left none uncovered. The paired 95% interval for the reduction was 14–18 percentage points.",11.5,17)
    s.text(44,305,"Election time on the same maps",16,BOLD)
    methods=[("Afek global schedule · M=1","P4 M1",blue),("EcoBeep","P5 native",green),("Published local feedback","JSX native","#79558D")]
    for i,(lab,key,col) in enumerate(methods):
        y=351+i*36;v=val("E4 full "+key+" election_slots");s.text(44,y,lab,10.2,BOLD);s.rect(221,y+2,v*3.28,12,col);s.text(228+v*3.28,y-2,f"{v:.0f}",11,BOLD)
    s.para(44,473,507,"One slot lasts 40 ms. The paired Afek/EcoBeep time ratio was 2.25 (95% interval 2.17–2.52). All 50 pairs completed with valid head sets. Adding member association brought EcoBeep setup to 156.5 slots versus 33 for LEACH. LEACH associated a median 29 of 100 sensors, EcoBeep all 100.",11.5,17)
    s.rect(44,591,507,135,"#F7F0E3");s.text(60,608,"What happens if an announcement is missed?",14,BOLD)
    s.para(60,639,470,"A neighbor can keep competing after a head believes its election is finished. At 10% directional loss, all 50 EcoBeep runs with confirmation ended with neighboring heads. The exact 95% interval was 92.9–100%. Confirmation cannot guarantee separation on a lossy link.",11.4,16.5)
    s.foot(3,"Sources: e1_setup_cost.csv, e3_coverage_scaling.csv, e4_headtohead.csv and e6_loss_ablation.csv. Scenario rgg-100-8-full-0-directional-ideal, or loss 0.1 for E6. Seeds 0–49.")
    s.title("Service and lifetime","More readings can cost battery life","Six paired networks started with unequal battery levels. Service counts every reading the initial 100 sensors were scheduled to provide over seven days, including opportunities after death.")
    rows=[]
    for name,k in [("Weighted LEACH","P2 native"),("EcoBeep","P5 native"),("Published feedback","JSX native"),("EcoBeep, bias off","P5 bias-off")]:
        prefix="E5 heterogeneous "+k+" "
        rows.append([name,f"{100*val(prefix+'service_fraction'):.2f}%",f"{val(prefix+'fnd_s')/3600:.2f} h",f"{val(prefix+'joules_per_delivered'):.2f} J"])
    s.table(44,186,[166,108,107,126],["System","Service","First death*","Energy / reading"],rows,11,36)
    s.para(44,376,507,"*Middle observed first-death time across the six runs. Each arm reached first death within the horizon. One aggregate can carry several source readings.",9.4,14,muted)
    s.text(44,429,"Compare two systems",15,BOLD)
    s.para(44,459,507,"EcoBeep delivered 21.09 percentage points more of the scheduled readings than weighted LEACH (95% interval 20.91–21.57). Its first death came 49.33 minutes earlier (47.05–64.14 earlier). The published local-feedback system delivered 3.21 points more than EcoBeep (3.09–3.46).",11.5,17)
    s.text(44,550,"Change only the energy weighting",15,BOLD)
    s.para(44,581,507,"Inside EcoBeep, enabling battery weighting delayed the first death by a paired median 10.51 minutes (4.48–20.58). It also brought the last death forward by 102.27 minutes (58.07–150.03 earlier). On networks starting with equal batteries, the first death came 8.47 minutes earlier with weighting.",11.5,17)
    s.para(44,679,507,"Looking only at the first death would hide both the later reversal and the difference in readings that reached the station.",11.5,17,green,True)
    s.foot(4,"Source: e5_lifetime.csv, rgg-100-8-heterogeneous-0-directional-ideal and full-energy counterpart, seeds 0–5. Each deployment offered 1,007,900 fixed source opportunities. Intervals resample paired deployments.")
    s.title("Verification and use","What was checked","The supplied ZIP contained earlier results. Checking its source revealed two shortcuts that could change what a reader concluded.")
    s.text(44,180,"Why the experiments were rerun",15,BOLD)
    s.para(44,209,507,"An archived winner could mark its neighbors directly, even if its announcement never arrived. The archived energy model also charged full listening cost only after a successful reception. The corrected simulator requires each sensor to act on what it heard and charges every scheduled listen.",11.5,17)
    s.text(44,304,"Checks with answers known in advance",15,BOLD)
    s.para(44,334,507,"A 20 × 20 open grid has 400 sensors and 760 links. The specified greedy rule chose exactly 182 nonadjacent heads and covered all 400 sensors. Another check forced two neighbors to miss every signal and verified that the observer flagged both becoming heads. A six-slot Python example matched the browser engine event by event.",11.5,17)
    s.text(44,441,"How much confidence to place in the numbers",15,BOLD)
    s.para(44,471,507,"All seven full CSVs and all seven smoke CSVs matched their corresponding clean reruns byte for byte. Four E2 elections and two E4 elections exhausted a finite schedule. E7 retained 18 arms that reached the seven-day cutoff with live sensors. These records remain in the results.",11.5,17)
    s.para(44,549,507,"The simulator assumes stationary sensors, a directly reachable sink and ideal clock alignment. Six lifetime deployments and three sensitivity deployments per arm give limited precision. Real-board battery life and field performance remain unmeasured.",11.5,17)
    s.rect(44,640,507,86,tint);s.text(60,652,"Explore a deployment yourself",14,BOLD,green)
    s.para(60,680,470,"Open viz/simulator.html, choose Compare and press Play. Change the loss slider to see why a finished election can still leave two neighboring heads.",11,15)
    s.foot(5,"See ARCHIVE_AUDIT.md for code-level corrections, DECISIONS.md for frozen choices and README.md for sources, exact configurations and reproduction commands. Verification manifests are in analysis/ and smoke/analysis/.")
    s.c.save()

def poster():
    W,H=594*mm,841*mm;s=Sheet(ROOT/"poster/Silent Signals - A1 Poster.pdf",(W,H));s.c.setTitle("Silent Signals | A1 research poster")
    margin=70;gap=34;w=(W-2*margin-2*gap)/3;xs=[margin+i*(w+gap) for i in range(3)]
    raw=(ROOT/"poster/POSTER_CONTENT.md").read_text(encoding="utf8")
    blocks={};name=""
    for line in raw.splitlines():
        if line.startswith("## "):name=line[3:];blocks[name]=[]
        elif name and line:blocks[name].append(line)
    def heading(x,y,t):s.line(x,y,x+w,y,green,2);s.text(x,y+13,t,26,BOLD,green);return y+59
    s.text(margin,54,"WIRELESS SENSOR NETWORKS     /     SIMULATION STUDY",17,BOLD,green)
    s.text(margin,107,"SILENT SIGNALS",85,BOLD,ink)
    s.text(margin,224,"Beeping Maximal Independent Sets for Energy-Aware Wireless Sensor Clustering",32,REG,muted)
    s.line(margin,300,W-margin,300,rule,2)
    x=xs[0];y=heading(x,345,"The problem");y=s.para(x,y,w,blocks["The problem"][0],21,30)+52
    y=heading(x,y,"The biological idea");y=s.para(x,y,w,blocks["The biological idea"][0],19,28)+23
    cx=x+w/2;cy=y+142;rad=41
    for i in range(6):
        ang=math.radians(60*i);xx=cx+math.cos(ang)*100;yy=cy+math.sin(ang)*100
        s.dot(xx,yy,rad);s.line(cx+math.cos(ang)*43,cy+math.sin(ang)*43,xx-math.cos(ang)*40,yy-math.sin(ang)*40,gold,5)
        s.text(xx-25,yy-9,"Notch",15,BOLD,muted)
    s.dot(cx,cy,43,True);s.text(cx-24,cy-10,"Delta",17,BOLD,"#FFFFFF")
    y=cy+158;y=s.para(x,y,w,"Delta on the central cell engages Notch on adjacent receiving cells. These receivers are inhibited from taking the same precursor fate.",17,24,muted)+52
    y=heading(x,y,"The graph");y=s.para(x,y,w,blocks["The graph"][0],20,29)+38
    for i,v in enumerate((1,0,1)):
        xx=x+80+i*120
        if i<2:s.line(xx,y+25,xx+120,y+25,muted,3)
        s.dot(xx,y+25,14,bool(v))
    s.para(x,y+61,w,"Two green heads cover this three-sensor path. The center can reach either collector.",16,23,muted)
    x=xs[1];y=heading(x,345,"How the systems differ");y=s.para(x,y,w,blocks["The systems"][0],18.4,26.5)+26
    tab=[("Fixed / P0","Assigned IDs","Fixed roles","Open"),("LEACH / P1","Epoch","Local draw","Open"),("Weighted / P2","Battery + epoch","Local draw","Open"),("Greedy / P3","Full graph","Central","Graph"),("Afek / P4","N, D, clock","2 slots","Reliable"),("JSX","Local p, clock","2 slots","Reliable"),("EcoBeep / P5","Battery, clock","3 slots","Reliable")]
    y=s.table(x,y,[.28*w,.27*w,.22*w,.23*w],["System","Knowledge","Signal","Spacing"],tab,13.4,46)+15
    y=s.para(x,y,w,"Open = unconstrained. Graph = finite simple graph. Reliable = completed static election, synchronized ideal feedback and reliable links.",14.5,21,muted)+40
    y=heading(x,y,"How we tested it");y=s.para(x,y,w,blocks["The method"][0],18.4,26.5)+25
    for step in blocks["The method"][1:]:
        s.text(x,y,step[0],23,BOLD,green);y=s.para(x+37,y,w-37,step[3:],18.5,26)+21
    x=xs[2];y=heading(x,345,"Measured outcomes")
    figs=["f5_coverage_vs_n","f6_adjacent_ch","f7_headtohead","f8_lifetime"]
    for line,file in zip(blocks["Four chart captions"],figs):
        title,caption=line.split("**",2)[1:];caption=caption.strip()
        s.text(x,y,title.rstrip("."),19,BOLD);y+=35
        y=s.fig(x,y,w,240,ROOT/"figures"/(file+".png"))+9
        # Full scenario identifiers remain in the evidence references below.
        caption=caption.split(" E3,")[0].split(" E4,")[0].split(" E5,")[0]
        y=s.para(x,y,w,caption,15,20)+24
    band=1850;s.rect(0,band,W,227,tint)
    for i,txt in enumerate(blocks["Findings"]):
        xx=xs[i];s.text(xx,band+25,["Coverage","Election speed","Service and battery"][i],23,BOLD,green)
        s.para(xx,band+72,w,txt.removeprefix("- "),21,31)
    s.text(margin,2112,"Limits",22,BOLD,green);s.para(margin,2152,2*w+gap,blocks["Limits"][0],16,23)
    s.text(xs[2],2112,"Evidence",22,BOLD,green);s.para(xs[2],2152,w,"F5–F6 · e3_coverage_scaling.csv. F7 · e4_headtohead.csv. F8 · e5_lifetime.csv. Main captions use rgg, n=100, d=8, reliable ideal links. F5–F7 use full batteries. The F8 contrast uses unequal batteries.",14.5,21)
    s.line(margin,2283,W-margin,2283);s.para(margin,2302,W-2*margin,blocks["References"][0],14,19,muted);s.c.save()

if __name__=="__main__":
    report();poster()

