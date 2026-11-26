"use strict";
const {ids,sum,Ledger,Election,lossAt,observe}=require('./core');
function frame(g,c,keys,L,u,receivers,bytes,category){
  const tx=new Uint8Array(g.n),rx=new Uint8Array(g.n),air=8*(c.frame_bytes+bytes)/c.bitrate;
  if(air>c.slot_s)throw Error('Frame exceeds reserved slot');
  if(L.e[u]<=0)return [];
  tx[u]=1;const ok=[],emits=L.e[u]>=air*c.V*c.tx_mA/1000;
  for(const v of receivers){
    if(v!==g.n && L.e[v]<=0)continue;
    if(v!==g.n)rx[v]=1;
    if(emits && (v===g.n || L.e[v]>=air*c.V*c.rx_mA/1000) && !lossAt(c,keys.loss,L.slot,u,v))ok.push(v);
  }
  L.advance(c.slot_s,tx,rx,air,category);return ok;
}
function associate(g,c,keys,L,heads,category='setup'){
  const n=g.n, dest=new Int32Array(n).fill(-1),dist=new Float64Array(n).fill(Infinity);
  const members=ids(n).map(()=>[]),listeners=ids(n).filter(i=>L.e[i]>0&&!heads[i]);
  for(let h=0;h<n;h++)if(heads[h]&&L.e[h]>0){
    const tx=new Uint8Array(n),rx=new Uint8Array(n),air=8*(c.frame_bytes+c.adv_bytes)/c.bitrate;
    tx[h]=1;for(const i of listeners)rx[i]=+(L.e[i]>0);
    for(const i of g.adj[h])if(rx[i] && L.e[h]>=air*c.V*c.tx_mA/1000 && L.e[i]>=air*c.V*c.rx_mA/1000 && !lossAt(c,keys.loss,L.slot,h,i)){
      const d=(g.pos[h][0]-g.pos[i][0])**2+(g.pos[h][1]-g.pos[i][1])**2;
      if(d<dist[i]){dist[i]=d;dest[i]=h;}
    }
    L.advance(c.slot_s,tx,rx,air,category);
  }
  for(const i of listeners)if(dest[i]>=0&&L.e[i]>0){
    const h=dest[i];if(frame(g,c,keys,L,i,[h],c.join_bytes,category).length)members[h].push(i);
  }
  const accepted=new Int32Array(n).fill(-1);
  for(let h=0;h<n;h++)if(heads[h]&&L.e[h]>0){
    const heard=frame(g,c,keys,L,h,listeners.filter(i=>dest[i]===h),c.schedule_base_bytes+c.schedule_member_bytes*members[h].length,category);
    const ack=new Set(members[h]);for(const i of heard)if(ack.has(i))accepted[i]=h;
    if(L.e[h]>0)accepted[h]=h;
  }
  return accepted;
}
function lifetime(g,c,keys,e0,proto){
 const n=g.n,L=new Ledger(e0,c), zero=new Uint8Array(n),eligible=new Uint8Array(n).fill(1);
 const horizon=Math.round(c.horizon_s/c.slot_s),period=Math.round(c.period_s/c.slot_s),roundSlots=Math.round(c.round_s/c.slot_s);
 const tick=Math.round(c.tick_s/c.slot_s),hb=tick*c.heartbeat_ticks;
 let nextRound=0,nextData=period,nextHB=hb,round=0,heads=new Uint8Array(n),state=new Int8Array(n);
 let dest=new Int32Array(n).fill(-1),cool=new Float64Array(n),miss=new Uint32Array(n);
 let generated=0,delivered=0,busyDropped=0,missed=0,rotations=0,repairs=0,unresolved=0;
 let adjacentMax=0,uncoveredSeconds=0,coverageAt=0,orphans=n;
 const electionAudit={observed_elections:0,valid_elections:0,nonindependent_elections:0,nondominating_elections:0,exhausted_elections:0,timed_out_elections:0};
 const deathsSeen=new Float64Array(n).fill(Infinity);
 const endGuard=Symbol('horizon');
 const advance=L.advance.bind(L);
 const refresh=(at)=>{
   uncoveredSeconds+=(at-coverageAt)*orphans;coverageAt=at;
   let cnt=0,pairs=0;
   for(let i=0;i<n;i++)if(deathsSeen[i]>at){
     if(heads[i]){for(const j of g.adj[i])if(j>i&&heads[j]&&deathsSeen[j]>at)pairs++;}
     else if(!g.adj[i].some(j=>heads[j]&&deathsSeen[j]>at))cnt++;
   }
   orphans=cnt;adjacentMax=Math.max(adjacentMax,pairs);
 };
 L.advance=(seconds,tx,rx,air,bucket)=>{
   if(L.slot>=horizon)throw endGuard;
   const before=L.deaths.length;
   advance(Math.min(seconds,(horizon-L.slot)*c.slot_s),tx,rx,air,bucket);
   for(let j=before;j<L.deaths.length;j++){const [at,i]=L.deaths[j];deathsSeen[i]=at;refresh(at);}
 };
 function handleBusyTraffic(){
   while(nextData<L.slot && nextData<horizon){
     const alive=deathsSeen.reduce((a,t)=>a+(t>nextData*c.slot_s),0);
     generated+=alive;busyDropped+=alive;nextData+=period;
   }
 }
 function elect(repair=false){
   const initialState=repair?state:proto==='P5'?cool.map(t=>t>L.slot?4:0):null;
   const q=new Election(g,c,keys,L,proto,{round:round*10000+(repair?Math.floor(L.slot/hb)+1:0),eligible,repair,initialState});
   // LEACH epochs count clustering rounds only.
   if(proto==='P1'||proto==='P2')q.opt.round=round;
   if(!repair){heads=zero;refresh(L.slot*c.slot_s);}
   const previous=Uint8Array.from(heads);
   while(q.status==='running'){
     q.next();
     if(q.phase==='announcement'||q.status!=='running'){
       heads=q.heads;refresh(L.slot*c.slot_s);
     }
   }
   state=q.state;heads=q.heads;
   const observed=observe(g,heads,L.e);
   electionAudit.observed_elections++;
   electionAudit.valid_elections+=observed.valid_mis;
   electionAudit.nonindependent_elections+=1-observed.independent;
   electionAudit.nondominating_elections+=1-observed.dominating;
   electionAudit.exhausted_elections+=+(q.status==='schedule_exhausted');
   electionAudit.timed_out_elections+=+(q.status==='timed_out');
   if(repair){repairs++;unresolved+=state.filter(v=>v===0).length;}
   if(!repair||heads.some((v,i)=>v!==previous[i]))dest=associate(g,c,keys,L,heads,repair?'maintenance':'setup');
 }
 function maintain(heartbeat){
   let changed=false;
   for(let i=0;i<n;i++)if(L.e[i]>0){
     if(c.rotation&&heads[i]&&L.e[i]<c.rotate_frac*c.full_J){
       heads[i]=0;state[i]=4;cool[i]=L.slot+tick*c.cooldown_ticks;rotations++;changed=true;
     }else if(state[i]===4&&cool[i]<=L.slot)state[i]=0;
   }
   if(changed){refresh(L.slot*c.slot_s);dest=associate(g,c,keys,L,heads,'maintenance');}
   if(!heartbeat)return;
   const tx=heads.map((h,i)=>+(h&&L.e[i]>0)),rx=tx.map((h,i)=>+(!h&&L.e[i]>0));
   for(let i=0;i<n;i++)if(rx[i]){
     const heard=g.adj[i].some(h=>tx[h]&&L.e[h]>=c.beep_s*c.V*c.tx_mA/1000&&!lossAt(c,keys.loss,L.slot,h,i));
     if(heard){miss[i]=0;state[i]=2;}
     else {miss[i]++;missed++;if(miss[i]>=c.miss_limit&&cool[i]<=L.slot)state[i]=0;}
   }
   L.advance(c.slot_s,tx,rx,c.beep_s,'maintenance');
   if(state.some((v,i)=>v===0&&L.e[i]>0))elect(true);
 }
 function data(){
   const generatedNow=L.e.map(v=>+(v>0)),counts=new Uint32Array(n),deadline=nextData+period;
   generated+=sum(generatedNow);nextData+=period;
   for(let i=0;i<n;i++)if(generatedNow[i]&&L.slot<deadline){
     const h=dest[i];if(h<0||!heads[h]||L.e[h]<=0)continue;
     if(i===h)counts[h]++;
     else if(frame(g,c,keys,L,i,[h],c.source_bytes,'data').length)counts[h]++;
   }
   for(let h=0;h<n;h++)if(counts[h]&&L.slot<deadline&&frame(g,c,keys,L,h,[n],c.aggregate_bytes,'data').length)delivered+=counts[h];
 }
 try{
   while(L.slot<horizon && L.live){
     if(L.slot>=nextRound){
       if(proto!=='P0'||round===0)elect();
       else dest=associate(g,c,keys,L,heads);
       round++;nextRound+=roundSlots;handleBusyTraffic();continue;
     }
     const upkeep=proto==='P5'&&c.maintenance;
     if(upkeep&&L.slot>=nextHB){while(nextHB<=L.slot)nextHB+=hb;maintain(true);handleBusyTraffic();continue;}
     if(upkeep&&L.slot%tick===0&&c.rotation&&heads.some((v,i)=>v&&L.e[i]>0&&L.e[i]<c.rotate_frac*c.full_J)){
       maintain(false);handleBusyTraffic();continue;
     }
     if(L.slot===nextData){data();handleBusyTraffic();continue;}
     let next=Math.min(horizon,nextRound,nextData,upkeep?nextHB:Infinity);
     if(upkeep&&c.rotation){
       const idle=c.V*c.idle_mA/1000;
       for(let i=0;i<n;i++)if(heads[i]&&L.e[i]>0){
         const threshold=L.slot+(L.e[i]-c.rotate_frac*c.full_J)/idle/c.slot_s;
         next=Math.min(next,Math.max((Math.floor(L.slot/tick)+1)*tick,(Math.floor(threshold/tick)+1)*tick));
       }
     }
     if(next<=L.slot)throw Error('Scheduler lost its next event');
     L.advance((next-L.slot)*c.slot_s,null,null,0,'idle');
   }
 }catch(error){if(error!==endGuard)throw error;}
 handleBusyTraffic();
 refresh(L.slot*c.slot_s);
 const fixed=n*Math.floor((horizon-1)/period),total=sum(Object.values(L.budget));
 const result={generated,delivered,fixed_opportunities:fixed,service_fraction:fixed?delivered/fixed:null,
   generated_fraction:generated?delivered/generated:null,busy_dropped:busyDropped,joules_per_delivered:delivered?total/delivered:null,
   spent_J:total,setup_J:L.budget.setup,maintenance_J:L.budget.maintenance,data_J:L.budget.data,idle_J:L.budget.idle,
   gini_at_fnd:L.giniFND,missed_heartbeats:missed,rotations,repairs,undecided_after_repairs:unresolved,transient_adjacent_max:adjacentMax,
   uncovered_node_s:uncoveredSeconds,terminal_alive:L.live,...observe(g,heads,L.e),...electionAudit,
   tx_s:L.durations.tx,rx_s:L.durations.rx,idle_mode_s:L.durations.idle};
 for(const [name,idx] of [['fnd',0],['hnd',Math.ceil(n/2)-1],['lnd',n-1]]){
   result[name+'_s']=L.deaths[idx]?.[0]??c.horizon_s;result[name+'_event']=+(idx<L.deaths.length);
 }
 for(const [key,val] of Object.entries(L.budget))result[key+'_share']=total?val/total:null;
 return {result,deaths:L.deaths};
}
module.exports={frame,associate,lifetime};
