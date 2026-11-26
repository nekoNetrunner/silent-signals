"use strict";
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const {graph,ids,sum,uniform,observe,Ledger,Election}=require('../src/core');
const {associate,lifetime}=require('../src/service');
const root=path.resolve(__dirname,'..'), cfgText=fs.readFileSync(path.join(root,'configs/default.yaml'),'utf8'),C=JSON.parse(cfgText);
const names=['','e1_setup_cost','e2_correctness','e3_coverage_scaling','e4_headtohead','e5_lifetime','e6_loss_ablation','e7_sensitivity'];
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),configHash=hash(cfgText);
const labels={P0:'Fixed heads',P1:'LEACH',P2:'Residual-energy-weighted LEACH',P3:'Central greedy',P4:'Afek 2011',P5:'EcoBeep',JSX:'Jeavons-Scott-Xu Algorithm 1',CTRL:'Count-matched control'};
function keysFor(kind,n,d,seed){
 return Object.fromEntries(['topology','energy','election','loss','traffic','visualization','bootstrap'].map(tag=>[tag,parseInt(hash(JSON.stringify([tag,kind,n,d,seed])).slice(0,8),16)]));
}
function control(g,e,k,variant,key){
 const n=g.n,h=new Uint8Array(n),weighted=variant.startsWith('weighted'),w=Array.from(e,v=>weighted?v:1);
 if(k===0||k===n)return h.fill(+(k===n));
 const u=ids(n).map(i=>uniform(key,1,i,1));
 if(variant.endsWith('exact')){
   const rank=u.map((v,i)=>-Math.log(v)/w[i]);
   for(const i of ids(n).sort((a,b)=>rank[a]-rank[b]||a-b).slice(0,k))h[i]=1;
 }else{
   let low=0,high=1/Math.min(...w);for(let z=0;z<55;z++){const mid=(low+high)/2;
    if(sum(w.map(v=>Math.min(1,mid*v)))<k)low=mid;else high=mid;}
   for(let i=0;i<n;i++)h[i]=+(u[i]<Math.min(1,high*w[i]));
 }return h;
}
function unit(m){
 if(m.endsWith('_s'))return m==='uncovered_node_s'?'node.s':'s';
 if(m.endsWith('_J'))return 'J';if(m==='setup_per_node')return 'mJ/node';if(m==='joules_per_delivered')return 'J/report';
 if(m.includes('slots')||m==='capped_time'||m==='last_decision')return 'slot';
 if(m==='beeps_per_node')return 'beeps/node';
 if(m==='adjacent_pairs_per_head')return 'pairs/head';
 if(['valid_mis','independent','dominating','p5_valid'].includes(m)||m.endsWith('_event'))return 'boolean';
 if(m.includes('fraction')||m.endsWith('_share')||['coverage','orphan_rate','density','gini_at_fnd'].includes(m))return 'fraction';
 if(m==='x'||m==='y')return 'unit square';if(m==='edge')return 'link';return 'count';
}
function run(exp,out,smoke=false){
 fs.mkdirSync(path.join(out,'results'),{recursive:true});
 const file=path.join(out,'results',names[exp]+'.csv'),fd=fs.openSync(file+'.partial','w');
 const cols='experiment,scenario_id,pair_id,run_id,protocol,variant,label,topology,n,seed,target_degree,profile,loss,mode,radio,M,oracle,p_floor,p_cap,bias,confirm,maintenance,rotation,full_J,idle_mA,rx_mA,cap,status,graph_hash,requested_n,mean_degree,radius,config_sha256,metric,value,unit,slot,node,edge'.split(',');
 fs.writeSync(fd,cols.join(',')+'\n');
 const c0={...C,...(smoke?{horizon_s:C.smoke_horizon_s,full_J:C.smoke_full_J}:{})};
 const sizes=smoke?[C.smoke_n]:C.sizes,ref=smoke?C.smoke_n:C.reference_n,ds=smoke?[8]:C.degrees;
 const count=smoke?C.smoke_seeds:exp===5?C.life_seeds:exp===7?C.sensitivity_seeds:exp===6?C.loss_seeds:C.static_seeds;
 const protocols=['P0','P1','P2','P3','P4','P5'];
 let blocks=0;
 function group(kind,n,d,profile,callback){
  for(let s=0;s<count;s++){
   const keys=keysFor(kind,n,d,s),g=graph(kind,n,d,keys.topology,C.cluster_sigma);
   const graphHash=hash(Buffer.concat(g.A.map(r=>Buffer.from(r))));
   const base={...c0,profile,maintenance:exp===5||exp===7},e=ids(g.n).map(i=>base.full_J*(profile==='full'?1:C.heterogeneity_min+(1-C.heterogeneity_min)*uniform(keys.energy,i)));
   function arm(proto,variant='native',over={},k=null,p5valid=null){
    const c={...base,...over};if(proto!=='P5'){c.bias=false;c.confirm=false;c.maintenance=false;c.rotation=false;}if(!c.maintenance)c.rotation=false;
    const life=exp===5||exp===7,L=new Ledger(e,c);let m,status,q,events=[],trace=[];
    if(life){const o=lifetime(g,c,keys,e,proto);m=o.result;events=o.deaths;status=m.terminal_alive?'admin_censored':'all_dead';}
    else if(proto==='CTRL'){
      m=observe(g,control(g,e,k,variant,keys.election),e);status='completed';m.requested_heads=k;m.p5_valid=p5valid;
    } else {
      q=new Election(g,c,keys,L,proto).finish();
      m=observe(g,q.heads,L.e);status=q.status;
      Object.assign(m,{election_slots:L.slot,logical_steps:q.step,local_decisions:proto==='P1'||proto==='P2'?g.n:0,
        scheduled_slots:proto==='P4'?q.scheduled*(c.radio==='emulated'?(2*c.pairs+1)/2:1):null,
        last_decision:q.lastDecision,undecided:q.state.filter(v=>v===0).length,beeps_per_node:q.beeps/g.n,
        capped_time:status==='completed'&&m.valid_mis?L.slot:c.cap,election_J:L.budget.setup,
        declared_uncovered_mismatch:['P4','P5','JSX'].includes(proto)?q.state.reduce((a,v,i)=>a+((v===1||v===2)!==Boolean(q.heads[i]||g.adj[i].some(j=>q.heads[j]))),0):null});
      if(exp===1){
        const dest=associate(g,c,keys,L,q.heads);m.associated=dest.filter(h=>h>=0).length;m.setup_slots=L.slot;m.setup_J=L.budget.setup;m.setup_per_node=1000*m.setup_J/g.n;
      }
      if(exp===2&&s===0&&proto==='P5'){
        g.pos.forEach(([x,y],i)=>trace.push(['x',x,'',i,''],['y',y,'',i,''],['head',q.heads[i],L.slot,i,'']));
        g.edges.forEach(([u,v])=>trace.push(['edge',1,'','',u+'-'+v]));
      }
      if(exp===3&&k!==null){m.requested_heads=k;m.p5_valid=p5valid;}
    }
    const pair=[kind,n,d,profile,s].join('-'),sc=[kind,n,d,profile,c.loss,c.mode,c.radio].join('-');
    const runID=[names[exp],pair,sc,proto,variant].join('/');
    const prefix=[names[exp],sc,pair,runID,proto,variant,labels[proto],kind,g.n,s,d,profile,c.loss,c.mode,c.radio,c.M,+c.oracle,
       proto==='JSX'?0:proto==='P5'?c.p_floor:'NA',proto==='P5'?c.p_cap:proto==='JSX'?1:'NA',+c.bias,+c.confirm,+c.maintenance,+c.rotation,
       c.full_J,c.idle_mA,c.rx_mA,c.cap,status,graphHash,n,2*g.edges.length/g.n,g.radius??'NA',configHash].join(',')+',';
    const rows=Object.entries(m).map(([name,val])=>[name,val,'','','']);
    for(const [t,i] of events)rows.push(['death_s',t,Math.floor(t/c.slot_s),i,'']);
    rows.push(...trace);
    fs.writeSync(fd,rows.map(([name,v,slot,node,edge])=>prefix+[name,v===null?'NA':Number.isInteger(v)?v:Number(v.toPrecision(12)),unit(name),slot,node,edge].join(',')+'\n').join(''));blocks++;
    return m;
   }
   callback(arm);
  }
 }
 const profiles=['full','heterogeneous'];
 if(exp===1){for(const n of sizes)group('rgg',n,8,'full',a=>protocols.forEach(p=>a(p)));group('grid',smoke?16:400,4,'full',a=>protocols.forEach(p=>a(p)));}
 if(exp===2){for(const kind of ['grid','rgg','sparse','line','clique','tree','clustered','butterfly']){
  group(kind,kind==='clique'?8:kind==='butterfly'?(smoke?16:128):ref,kind==='sparse'?3:8,'full',a=>['P1','P2','P3','P4','P5','JSX'].forEach(p=>a(p)));}}
 if(exp===3)for(const n of sizes)for(const d of ds)for(const prof of profiles)group('rgg',n,d,prof,a=>{
   const target=a('P5');for(const p of ['P1','P2'])a(p,'native',{},target.heads,target.valid_mis);
   for(const v of ['uniform-expected','weighted-expected','uniform-exact','weighted-exact'])a('CTRL',v,{},target.heads,target.valid_mis);});
 if(exp===4)for(const n of sizes)for(const d of smoke?[8]:[6,8])for(const prof of profiles)group('rgg',n,d,prof,a=>{
   for(const M of C.M_values)a('P4','M'+M,{M});a('P4','oracle-M1',{oracle:true});a('JSX');a('P5');a('P5','bias-off',{bias:false});});
 if(exp===5)for(const prof of profiles)group('rgg',ref,8,prof,a=>{for(const p of [...protocols,'JSX'])a(p);a('P5','bias-off',{bias:false});});
 if(exp===6)group('rgg',ref,8,'full',a=>{for(const mode of ['directional','symmetric'])for(const loss of C.loss_rates){
   a('P4','M1',{loss,mode});a('P5','confirm',{loss,mode});a('P5','no-confirm',{loss,mode,confirm:false});}});
 if(exp===7)group('rgg',ref,8,'heterogeneous',a=>{
   a('P5','primary');a('P5','bias-off',{bias:false});a('P5','confirm-off',{confirm:false});a('P5','maintenance-off',{maintenance:false});a('P5','rotation-off',{rotation:false});a('P5','half-duplex',{radio:'emulated'});
   for(const floor of C.floors)a('P5','floor-'+floor,{p_floor:floor});
   for(const idle of C.idle_scales)for(const rx of C.rx_scales)for(const p of ['P2','P5'])a(p,'current-'+idle+'-'+rx,{idle_mA:C.idle_mA*idle,rx_mA:C.rx_mA*rx});
 });
 fs.closeSync(fd);fs.renameSync(file+'.partial',file);console.log(names[exp],blocks,'runs');
}
if(require.main===module)run(+process.argv[2],path.resolve(process.argv[3]),process.argv.includes('--smoke'));
module.exports={run,keysFor,control,names,C};

