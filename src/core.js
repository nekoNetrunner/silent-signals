"use strict";
// Shared byte-for-byte by the batch runner and the offline browser.
const ids = n => Array.from({length:n}, (_,i)=>i);
const sum = a => a.reduce((x,y)=>x+y,0);
const upper = n => 2 ** Math.ceil(Math.log2(Math.max(2,n)));
function mix(x) {
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return (x ^ (x >>> 15)) >>> 0;
}
function uniform(key, a, b=0, c=0, d=0) {
  return (mix(key ^ mix(a+11) ^ Math.imul(mix(b+29),3) ^ Math.imul(mix(c+47),5) ^ Math.imul(mix(d+71),7)) + .5) / 4294967296;
}
function graph(kind, requested, degree, key, sigma=.08) {
  const side=Math.round(Math.sqrt(requested)), n=kind==='grid'?side*side:requested;
  const A=ids(n).map(()=>new Uint8Array(n)), adj=ids(n).map(()=>[]), edges=[];
  const radius=Math.sqrt(degree/(Math.PI*n)), k=3+Math.floor(uniform(key,0,0,9)*3);
  const pos=ids(n).map(i=>{
    if(kind==='grid') return [(i%side+.5)/side,(Math.floor(i/side)+.5)/side];
    if(kind==='line') return [(i+.5)/n,.5];
    if(kind==='clique'||kind==='butterfly') return [.5+.43*Math.cos(2*Math.PI*i/n),.5+.43*Math.sin(2*Math.PI*i/n)];
    if(kind==='clustered'){
      const cluster=Math.floor(k*uniform(key,i,0,5)), angle=2*Math.PI*uniform(key,i,0,6);
      const rad=sigma*Math.sqrt(-2*Math.log(uniform(key,i,0,7)));
      return [Math.cos(angle),Math.sin(angle)].map((v,j)=>Math.min(1,Math.max(0,.2+.6*uniform(key,cluster,j,8)+v*rad)));
    }
    return [uniform(key,i,0,1),uniform(key,i,1,1)];
  });
  for(let i=0;i<n;i++) for(let j=0;j<i;j++){
    const dx=pos[i][0]-pos[j][0],dy=pos[i][1]-pos[j][1];
    let edge;
    switch(kind){
      case 'grid': edge=i-j===side || (i-j===1 && i%side!==0); break;
      case 'tree': edge=j===Math.floor(uniform(key,i,0,2)*i); break;
      case 'line': edge=i-j===1; break;
      case 'clique': edge=true; break;
      case 'butterfly': edge=((i^j)&((i^j)-1))===0; break;
      default: edge=dx*dx+dy*dy<=radius*radius;
    }
    if(edge){A[i][j]=A[j][i]=1; adj[i].push(j);adj[j].push(i);edges.push([j,i]);}
  }
  return {kind,n,requested,degree,A,adj,pos,edges,radius:['rgg','sparse','clustered'].includes(kind)?radius:null};
}
function observe(g,heads,energy){
  let live=0,h=0,pairs=0,orphan=0;
  const components=new Set(),unseen=new Set();
  let isolates=0;
  for(let i=0;i<g.n;i++) if(energy[i]>0){
    unseen.add(i);live++;h+=+heads[i];
    let covered=!!heads[i],degree=0;
    for(const j of g.adj[i]) if(energy[j]>0){degree++;if(heads[j]){covered=true;if(heads[i]&&i<j)pairs++;}}
    if(!covered)orphan++; if(!degree)isolates++;
  }
  while(unseen.size){const start=unseen.values().next().value,stack=[start];components.add(start);unseen.delete(start);
    while(stack.length){for(const j of g.adj[stack.pop()]) if(unseen.delete(j))stack.push(j);}
  }
  return {heads:h,density:live?h/live:null,adjacent_pairs:pairs,adjacent_pairs_per_head:h?pairs/h:null,
    orphans:orphan,orphan_rate:live?orphan/live:null,coverage:live?1-orphan/live:null,
    independent:+!pairs,dominating:+!orphan,valid_mis:+(!pairs&&!orphan),isolates,components:components.size};
}
function greedy(g,e){
  const h=new Uint8Array(g.n), blocked=new Uint8Array(g.n);
  const degree=g.adj.map(js=>js.filter(j=>e[j]>0).length);
  for(const i of ids(g.n).filter(i=>e[i]>0).sort((a,b)=>degree[a]-degree[b]||a-b)){
    if(blocked[i])continue;h[i]=1;for(const j of g.adj[i])blocked[j]=1;
  }return h;
}
function lossAt(c,key,slot,u,v){
  if(!c.loss)return false;
  if(c.mode==='symmetric'&&u>v)[u,v]=[v,u];
  return uniform(key,slot,u,v,13)<c.loss;
}
function gini(values){
  const x=Array.from(values).sort((a,b)=>a-b),total=sum(x);
  return total?sum(x.map((v,i)=>(2*i+1-x.length)*v))/(x.length*total):null;
}
class Ledger {
  constructor(e,c){this.e=Float64Array.from(e);this.c=c;this.slot=0;this.budget={setup:0,maintenance:0,data:0,idle:0};
    this.durations={tx:0,rx:0,idle:0};this.deaths=[];this.giniFND=null;this.live=e.length;}
  // Each node has one constant-rate active segment followed by idle.
  advance(seconds,tx,rx,air,bucket){
    const {e,c}=this, start=this.slot*c.slot_s, idle=c.V*c.idle_mA/1000;
    const first=this.deaths.length===0, crosses=[];
    let used=0;
    for(let i=0;i<e.length;i++)if(e[i]>0){
      const mode=tx&&tx[i]?'tx':rx&&rx[i]?'rx':'idle';
      const rate=mode==='tx'?c.V*c.tx_mA/1000:mode==='rx'?c.V*c.rx_mA/1000:idle;
      const dur=mode==='tx'?air:seconds, a=rate*dur, cost=a+idle*(seconds-dur);
      if(e[i]<=cost){
        const lived=e[i]<=a?e[i]/rate:dur+(e[i]-a)/idle;
        crosses.push([start+lived,i]);this.durations[mode]+=Math.min(dur,lived);this.durations.idle+=Math.max(0,lived-dur);
        used+=e[i];
      }else {this.durations[mode]+=dur;this.durations.idle+=seconds-dur;used+=cost;}
    }
    crosses.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    if(first&&crosses.length){
      const dt=crosses[0][0]-start;
      this.giniFND=gini(e.map((v,i)=>{
        const rate=c.V*(tx&&tx[i]?c.tx_mA:rx&&rx[i]?c.rx_mA:c.idle_mA)/1000,dur=tx&&tx[i]?air:seconds;
        return Math.max(0,v-rate*Math.min(dt,dur)-idle*Math.max(0,dt-dur));
      }));if(crosses.length===e.length && crosses.at(-1)[0]===crosses[0][0])this.giniFND=null;
    }
    for(let i=0;i<e.length;i++)if(e[i]>0){
      const cost=tx&&tx[i]?air*c.V*c.tx_mA/1000+(seconds-air)*idle:seconds*(rx&&rx[i]?c.V*c.rx_mA/1000:idle);
      e[i]=Math.max(0,e[i]-cost);
    }
    for(const [t,i] of crosses){e[i]=0;this.deaths.push([t,i]);this.live--;}
    this.budget[bucket]+=used;this.slot+=Math.round(seconds/c.slot_s);
  }
}
class Election {
  constructor(g,c,keys,ledger,protocol,opt={}){
    Object.assign(this,{g,c,keys,ledger,protocol,opt});const n=g.n;
    this.start=ledger.slot;this.step=0;this.beeps=0;this.lastDecision=0;
    this.state=new Int8Array(n); // 0 undecided, 1 head, 2 covered, 3 dead, 4 cooldown
    this.p=new Float64Array(n).fill(protocol==='JSX'?.5:c.p_init);this.eff=new Float64Array(n);
    this.heads=new Uint8Array(n);this.lastTx=new Uint8Array(n);this.lastHeard=new Uint8Array(n);
    this.N=upper(n);this.D=c.oracle?upper(Math.max(0,...g.adj.map(a=>a.length))):this.N;
    this.repeat=1+Math.floor(c.M*Math.log2(this.N));this.scheduled=2*this.repeat*(1+Math.log2(this.D));
    this.status='running';this.phase='ready';this.candidates=new Uint8Array(n);
    for(let i=0;i<n;i++){
      if(ledger.e[i]<=0)this.state[i]=3;
      else if(opt.initialState){this.state[i]=opt.initialState[i];this.heads[i]=+(this.state[i]===1);}
    }
    this.generator=this.run();
  }
  u(i,purpose,extra=0){return this.opt.tape?.(this.step,i,purpose,extra)??uniform(this.keys.election,this.step,i,purpose,(this.opt.round||0)*8192+extra);}
  *exchange(intents,feedback,phase){
    const {g,c,ledger}=this,n=g.n,emulate=feedback&&c.radio==='emulated';
    const combined=new Uint8Array(n),halves=new Uint8Array(n);
    for(let sub=0;sub<(emulate?c.pairs*2:1);sub++){
      if(ledger.slot-this.start>=c.cap){this.status='timed_out';return combined;}
      const tx=new Uint8Array(n),rx=new Uint8Array(n),heard=new Uint8Array(n);
      const traced=this.opt.trace?Array.from({length:n},()=>[]):null;
      for(let i=0;i<n;i++)if(ledger.e[i]>0){
        const active=this.state[i]===0 || (this.opt.repair&&this.state[i]===1);
        if(emulate&&!(sub%2))halves[i]=+(this.u(i,phase==='contention'?21:22,sub)<.5);
        tx[i]=+(intents[i]&&(!emulate||halves[i]===sub%2));rx[i]=+(active&&!tx[i]);
      }
      const airtime=c.beep_s;
      for(let u=0;u<n;u++)if(tx[u]&&ledger.e[u]>=airtime*c.V*c.tx_mA/1000){
        for(const v of g.adj[u])if((rx[v]||(!emulate&&feedback&&tx[v]))&&ledger.e[v]>=airtime*c.V*(tx[v]?c.tx_mA:c.rx_mA)/1000){
          if(this.opt.drop?.(ledger.slot,u,v)??lossAt(c,this.keys.loss,ledger.slot,u,v))continue;
          heard[v]=combined[v]=1;if(traced)traced[v].push(u);
        }
      }
      this.phase=phase;this.lastTx=tx;this.lastHeard=heard;this.senders=traced;this.beeps+=sum(tx);
      ledger.advance(c.slot_s,tx,rx,airtime,this.opt.repair?'maintenance':'setup');
      for(let i=0;i<n;i++)if(ledger.e[i]<=0){this.state[i]=3;this.heads[i]=0;}
      // Commit the logical transition before the driver observes the last physical slot.
      if(emulate&&sub+1<c.pairs*2)yield;
    }
    return combined;
  }
  *run(){
    const {g,c,protocol,ledger,opt}=this,n=g.n;
    if(['P0','P1','P2','P3'].includes(protocol)){
      let heads=protocol==='P3'?greedy(g,ledger.e):this.heads;
      const r=opt.round||0,eligible=opt.eligible||new Uint8Array(n).fill(1);
      for(let i=0;i<n;i++)if(ledger.e[i]>0){
        if(protocol==='P0')heads[i]=+(i<Math.floor(n/c.static_divisor));
        if(protocol==='P1'||protocol==='P2'){
          if(r%c.epoch===0)eligible[i]=1;
          this.eff[i]=eligible[i]?Math.min(1,(protocol==='P2'?ledger.e[i]/c.full_J:1)/(c.epoch-r%c.epoch)):0;
          heads[i]=+(this.u(i,1)<this.eff[i]);if(heads[i])eligible[i]=0;
        }
        this.state[i]=heads[i]?1:2;
      }
      this.heads=heads;this.status='completed';this.phase='local selection';return;
    }
    while(this.state.includes(0)){
      if(ledger.slot-this.start>=c.cap){this.status='timed_out';return;}
      if(protocol==='P4'&&this.step>=this.scheduled/2){this.status='schedule_exhausted';return;}
      const intents=new Uint8Array(n);this.step++;
      for(let i=0;i<n;i++){
        if(opt.repair&&this.state[i]===1){intents[i]=1;continue;}
        if(this.state[i]!==0)continue;
        if(protocol==='P4')this.p[i]=2**(Math.floor((this.step-1)/this.repeat)-Math.log2(this.D));
        const factor=protocol==='P5'&&c.bias?ledger.e[i]/(c.full_J*(c.profile==='full'?1:(1+c.heterogeneity_min)/2)):1;
        this.eff[i]=protocol==='P5'?Math.max(c.p_floor,Math.min(c.p_cap,this.p[i]*factor)):this.p[i];
        intents[i]=+(this.u(i,1)<this.eff[i]);
      }
      const detected=yield* this.exchange(intents,true,'contention');
      if(this.status!=='running')return;
      for(let i=0;i<n;i++)if(this.state[i]===0){
        this.candidates[i]=+(intents[i]&&!detected[i]);
        if(protocol!=='P4')this.p[i]=Math.max(protocol==='P5'?c.p_floor:0,Math.min(1,detected[i]?this.p[i]/2:this.p[i]*2));
      }
      yield;
      if(protocol==='P5'&&c.confirm){
        const signals=this.candidates.map((v,i)=>v||+(opt.repair&&this.state[i]===1));
        const conflict=yield* this.exchange(signals,true,'confirmation');
        if(this.status!=='running')return;
        for(let i=0;i<n;i++)if(conflict[i]&&this.candidates[i]){this.candidates[i]=0;this.p[i]=Math.max(c.p_floor,this.p[i]/2);}
        yield;
      }
      const signals=this.candidates.map((v,i)=>v||+(opt.repair&&this.state[i]===1));
      const heard=yield* this.exchange(signals,false,'announcement');
      if(this.status!=='running')return;
      for(let i=0;i<n;i++)if(this.state[i]===0){
        if(this.candidates[i]){this.heads[i]=1;this.state[i]=1;}
        else if(heard[i])this.state[i]=2;
        if(this.state[i]!==0)this.lastDecision=ledger.slot-this.start;
      }
      this.candidates.fill(0);
      if(!this.state.includes(0))this.status='completed';
      else if(protocol==='P4'&&this.step>=this.scheduled/2)this.status='schedule_exhausted';
      else if(ledger.slot-this.start>=c.cap)this.status='timed_out';
      yield;if(this.status!=='running')return;
    }
    this.status='completed';
  }
  next(){if(this.status==='running')this.generator.next();return this;}
  finish(){while(this.status==='running')this.next();return this;}
}
const Core={ids,sum,upper,uniform,graph,observe,greedy,lossAt,gini,Ledger,Election};
if(typeof module!=='undefined')module.exports=Core;
