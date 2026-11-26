const assert=require('node:assert/strict');
const {graph,ids,observe,greedy,Election,Ledger,upper,lossAt,sum}=require('../src/core');
const {C,keysFor,control}=require('../experiments/batch');
const {frame,associate,lifetime}=require('../src/service');
const k=keysFor('line',3,2,0),g=graph('line',3,2,k.topology),e=Array(3).fill(C.full_J);
function trial(proto,cfg={},opt={},G=g,E=e){return new Election(G,{...C,...cfg},k,new Ledger(E,{...C,...cfg}),proto,opt);}
function near(x,y,tol=1e-8){assert.ok(Math.abs(x-y)<tol,`${x} != ${y}`);}
function unit(name,fn){fn();console.log('PASS',name);}
unit('Boolean radio and one-way erasures',()=>{
 for(const [tx,expected] of [[[1,0,0],[0,1,0]],[[1,0,1],[0,1,0]],[[1,1,0],[1,1,1]]]){
  const q=trial('P5');assert.deepEqual([...q.exchange(tx,true,'contention').next().value],expected);
 }
 const a=trial('P5',{}, {drop:(s,u,v)=>u===0&&v===1});
 assert.deepEqual([...a.exchange([1,1,0],true,'contention').next().value],[1,0,1]);
 for(let s=0;s<50;s++)assert.equal(lossAt({...C,loss:.3,mode:'symmetric'},1,s,1,2),lossAt({...C,loss:.3,mode:'symmetric'},1,s,2,1));
 const back=g.adj.map(ns=>ns.slice().reverse());
 const b=trial('P5',{}, {},{...g,adj:back}).finish();assert.deepEqual(b.heads,trial('P5').finish().heads);
});
unit('independent verifier, edge cases and exhaustive maximality',()=>{
 for(const G of [graph('line',0,2,3),graph('line',1,2,5),g,graph('clique',5,2,2),graph('rgg',6,.00001,7),
 {n:4,adj:[[1],[0],[3],[2]],edges:[[0,1],[2,3]]}]){
 const E=Array(G.n).fill(1);
 for(let mask=0;mask<2**G.n;mask++){
   const H=ids(G.n).map(i=>(mask>>i)&1);
   const independent=h=>G.edges.every(([u,v])=>!h[u]||!h[v]);
   const maximal=independent(H)&&H.every((v,i)=>v||!independent(H.map((x,j)=>j===i?1:x)));
   assert.equal(observe(G,H,E).valid_mis,+maximal);
 }}
 assert.equal(observe(g,[0,0,0],e).orphan_rate,1);assert.equal(observe(g,[0,0,0],e).adjacent_pairs_per_head,null);
});
unit('fixed original-degree greedy grid',()=>{
 const G=graph('grid',400,4,0),E=Array(400).fill(1),m=observe(G,greedy(G,E),E);
 assert.equal(G.edges.length,760);assert.equal(m.heads,182);assert.equal(m.density,.455);assert.equal(m.valid_mis,1);
 assert.deepEqual([...greedy(g,e)],[1,0,1]);
});
unit('LEACH eligibility, integer epoch and rated-energy weighting',()=>{
 const eligible=new Uint8Array(3).fill(1);
 for(let round=0;round<5;round++){
 const q=trial('P1',{epoch:4},{round,eligible,tape:()=>.999}).finish();near(q.eff[0],1/(4-round%4));
 assert.equal(sum(q.heads),round===3?3:0);}
 const a=trial('P1',{epoch:4},{round:1,eligible:new Uint8Array(3)}).finish();assert.equal(a.eff[0],0);
 assert.deepEqual(trial('P1').finish().heads,trial('P2').finish().heads);
 const p=trial('P2',{epoch:4},{round:3},g,e.map(x=>x/2)).finish();near(p.eff[0],.5);
});
unit('Afek inclusive schedule and missed final announcement',()=>{
 const q=trial('P4',{}, {tape:()=>0}).finish();assert.equal(q.repeat,3);assert.equal(q.scheduled,18);assert.equal(q.status,'schedule_exhausted');
 const sequence=[],r=trial('P4',{}, {tape:()=>0});while(r.status==='running'){r.next();if(r.phase==='contention')sequence.push(r.eff[0]);}
 assert.deepEqual(sequence,[.25,.25,.25,.5,.5,.5,1,1,1]);
 const a=trial('P4',{}, {tape:(s,i)=>i===0?0:.999,drop:(s,u,v)=>s===1&&u===0&&v===1});a.next();a.next();assert.equal(a.state[1],0);
});
unit('published JSX uses two slots, 0.5 initial probability, no floor',()=>{
 const q=trial('JSX',{}, {tape:()=>0});for(let i=0;i<14;i++)q.next();near(q.p[1],.5/128);assert.equal(q.step,7);assert.equal(q.ledger.slot,14);
 const a=trial('JSX',{}, {tape:()=>.99});a.next();assert.equal(a.p[0],1);
});
unit('loss can defeat confirmation and half-duplex can miss collisions',()=>{
 const q=trial('P5',{}, {tape:()=>0,drop:()=>true}).finish();assert.equal(observe(g,q.heads,e).adjacent_pairs,2);
 const z=trial('P5',{radio:'emulated'}, {tape:()=>0}).finish();assert.equal(z.ledger.slot,17);assert.equal(observe(g,z.heads,e).valid_mis,0);
});
unit('energy conservation, death inside intervals, silent RX',()=>{
 const L=new Ledger([1,1,1],C);L.advance(.04,[1,0,0],[0,1,0],.005,'setup');
 near((1-L.e[0])*1000,6.27);near((1-L.e[1])*1000,13.2);near(sum(Object.values(L.durations)),.12);
 const b=new Ledger([.033],C);b.advance(1,null,null,0,'idle');near(b.deaths[0][0],.5);assert.equal(b.e[0],0);assert.equal(b.giniFND,null);
});
unit('exact-k expectations enumerated on the path',()=>{
 const sets=[[1,1,0],[1,0,1],[0,1,1]],m=sets.map(h=>observe(g,h,e));near(sum(m.map(x=>x.adjacent_pairs))/3,2*2/(3*2));
 const one=[[1,0,0],[0,1,0],[0,0,1]];near(sum(one.map(h=>observe(g,h,e).orphans))/3,2/3);
 for(const v of ['uniform-exact','weighted-exact'])for(let k=0;k<=3;k++)assert.equal(sum(control(g,e,k,v,8)),k);
});
unit('service, orphan policy, censoring, dead transmitters and local repair',()=>{
 const L=new Ledger([1,1,1],C);assert.deepEqual([...associate(g,C,k,L,[0,1,0])],[1,1,1]);
 L.e[0]=0;assert.deepEqual(frame(g,C,k,L,0,[1],32,'data'),[]);
 const c={...C,horizon_s:180};const a=lifetime(g,c,k,e,'P0').result;
 assert.equal(a.fixed_opportunities,6);assert.equal(a.generated,6);assert.equal(a.delivered,0);assert.equal(a.fnd_event,0);assert.equal(a.fnd_s,180);
 const b=lifetime(g,{...c,round_s:500,heartbeat_ticks:5,cooldown_ticks:7,miss_limit:1,rotate_frac:1},k,e,'P5').result;
 assert.ok(b.rotations>0);assert.ok(b.repairs>0);assert.ok(b.delivered<=b.generated);
});
unit('independent Python fixture matches each JS physical slot',()=>{
 const fixture=require('../viz/python-trace.json'),q=trial('P5',{bias:false},{tape:(s,i)=>fixture.tape[s-1][i]});
 for(const f of fixture.frames){q.next();assert.equal(q.phase,f.phase);assert.equal(q.step,f.step);assert.equal(q.ledger.slot,f.slot);
 for(const [actual,want] of [[q.state,f.state],[q.p,f.p],[q.eff,f.eff],[q.lastTx,f.tx],[q.lastHeard,f.heard],[q.ledger.e,f.energy]])
 for(let i=0;i<3;i++)near(actual[i],want[i]);}assert.equal(q.status,'completed');
});
