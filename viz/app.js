const $=id=>document.getElementById(id), cv=$('cv'),ctx=cv.getContext('2d');
const names={P1:'LEACH',P2:'Energy-weighted LEACH',P3:'Central greedy',P4:'Afek 2011',P5:'EcoBeep'};
for(const key of ['protocol','other'])for(const [id,name] of Object.entries(names))$(key).add(new Option(id+' · '+name,id));
$('protocol').value='P5';$('other').value='P4';
let streams=[],G,playing=false,slot=0,limit=0,compare=false,generation=0,zoom=1,pan=[0,0],drag=null;
let changes=[],lastStamp=0,activeSeed=0,scenario='',fixtureMode=false,traceCfg={},previousTime=0,lastSlotTime=0;
function stamp(setting,value){changes.push({slot,setting,value,order:changes.length});}
async function makeKeys(kind,n,d,seed){
 const tags=['topology','energy','election','loss','traffic','visualization','bootstrap'];
 const entries=await Promise.all(tags.map(async tag=>{
 const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([tag,kind,n,d,seed])));
 return [tag,new DataView(b).getUint32(0,false)];}));return Object.fromEntries(entries);
}
function snapshot(q,extra={}){
 return {slot:q.ledger.slot,step:q.step,phase:q.phase,status:q.status,state:q.state.slice(),p:q.p.slice(),eff:q.eff.slice(),
 energy:q.ledger.e.slice(),tx:q.lastTx.slice(),heard:q.lastHeard.slice(),senders:q.senders,beeps:q.beeps,...extra};
}
function prepare(proto,c,keys,e){
 const L=new Ledger(e,c),q=new Election(G,c,keys,L,proto,{trace:true}),frames=[snapshot(q)];
 while(q.status==='running'){q.next();frames[L.slot]=snapshot(q);}
 const electionEnd=L.slot;
 if($('view').value==='setup'){
  const advance=L.advance.bind(L);let count=0;
  L.advance=(secs,tx,rx,air,bucket)=>{advance(secs,tx,rx,air,bucket);count++;
    frames[L.slot]={...frames[electionEnd],slot:L.slot,phase:'association frame '+count,status:'associating',tx:tx.slice(),heard:new Uint8Array(G.n),senders:null,energy:L.e.slice()};};
  const dest=associate(G,c,keys,L,q.heads);
  frames[L.slot]={...frames[L.slot],status:'setup complete',associated:dest.filter(v=>v>=0).length};
 }
 return {proto,frames,electionEnd};
}
async function reset(){
 const ticket=++generation;stop();fixtureMode=false;slot=0;changes=[];zoom=1;pan=[0,0];
 const topo=$('topo').value,n=+$('size').value,d=topo==='sparse'?3:+$('degree').value;
 activeSeed=Math.max(0,Math.trunc(Number($('seed').value)||0));$('seed').value=activeSeed;
 const h=+$('het').value,c={...DEFAULTS,radio:$('radio').value,loss:+$('loss').value,M:+$('repeat').value,profile:h?'heterogeneous':'full',heterogeneity_min:1-.9*h};
 $('dVal').textContent=['rgg','sparse','clustered'].includes(topo)?d:'—';$('degree').disabled=!['rgg','clustered'].includes(topo);
 $('lVal').textContent=(100*c.loss).toFixed(0)+'%';$('hVal').textContent=h.toFixed(2);$('otherField').style.display=compare?'grid':'none';
 $('compare').textContent=compare?'Single view':'Compare';$('status').textContent='Preparing…';
 const keys=await makeKeys(topo,n,d,activeSeed);if(ticket!==generation)return;
 G=graph(topo,n,d,keys.topology,c.cluster_sigma);$('nVal').textContent=G.n+(topo==='grid'?' · '+Math.sqrt(G.n)+' × '+Math.sqrt(G.n):'');
 const e=ids(G.n).map(i=>c.full_J*(1-.9*h+.9*h*uniform(keys.energy,i)));
 scenario=[topo,n,d,c.profile,c.loss,c.mode,c.radio].join('-');
 traceCfg={topology:topo,n,degree:d,seed:activeSeed,heterogeneity:h,loss:c.loss,radio:c.radio,M:c.M,view:$('view').value};
 streams=(compare?[$('protocol').value,$('other').value]:[$('protocol').value]).map(p=>prepare(p,c,keys,e));
 limit=Math.max(...streams.map(s=>s.frames.length-1));$('timeline').max=limit;render();
}
const current=(s,t=slot)=>s.frames[Math.min(t,s.frames.length-1)];
function measures(s,f){
 const heads=f.state.map(v=>+(v===1)),m=observe(G,heads,f.energy);
 const en=Array.from(f.energy);return {...m,min:Math.min(...en),max:Math.max(...en),mean:sum(en)/en.length,
 decided:f.state.filter(x=>x===1||x===2).length,validity:f.status==='running'?'Partial':m.valid_mis?'Valid MIS':'Fails MIS check'};
}
function render(){
 if(!streams.length)return;
 $('timeline').value=slot;$('clock').textContent='Slot '+slot+' / '+limit;
 $('status').textContent=fixtureMode?'Python trace':slot===limit?'Finished':playing?'Playing':'Paused';
 $('readings').replaceChildren();
 for(const s of streams){
   const f=current(s),m=measures(s,f),box=document.createElement('section');box.className='tele';
   const title=document.createElement('b');title.textContent=s.proto+' · '+(names[s.proto]||s.proto);box.append(title);
   const fields=[['Physical slot',f.slot],['Logical step',f.step],['Phase',f.phase],['Status',f.status],['Graph check',m.validity],['Beeps',f.beeps??sum(f.tx)],['Heads',m.heads+' / '+G.n],['Density',(m.density*100).toFixed(1)+'%'],['Orphans',m.orphans],['Adjacent pairs',m.adjacent_pairs],['Decided',m.decided],['Battery min / mean / max',[m.min,m.mean,m.max].map(x=>x.toFixed(1)).join(' / ')+' J'],['First death',s.frames.slice(0,Math.min(slot+1,s.frames.length)).find(f=>Array.from(f.energy).some(x=>x<=0))?.slot??'Unreached']];
   if(f.associated!==undefined)fields.push(['Associated',f.associated]);
   const dl=document.createElement('dl');for(const [label,v] of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=v;dl.append(dt,dd);}
   box.append(dl);$('readings').append(box);
 }
 const events=[];for(let j=slot;j>=0&&events.length<6;j--)for(const s of streams){
  if(j>=s.frames.length)continue;const f=current(s,j),prev=j?current(s,j-1):null;
  if(!prev||prev.phase!==f.phase||prev.status!==f.status){events.push('s'+j+' · '+s.proto+' · '+f.phase);if(events.length===6)break;}
 }
 $('ticker').replaceChildren(...events.map(t=>Object.assign(document.createElement('div'),{textContent:t})));draw();
}
function canvasBox(){return cv.getBoundingClientRect();}
function point(i,arm,w,h){
 const area=w/streams.length,scale=Math.min(area-56,h-95)*zoom;
 return [(arm+.5)*area+(G.pos[i][0]-.5)*scale+pan[0],h/2+(G.pos[i][1]-.5)*scale+pan[1]];
}
function draw(){
 const {width:w,height:h}=canvasBox(),dpr=devicePixelRatio||1;
 if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);}
 ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(!G)return;
 streams.forEach((s,arm)=>{
 const f=current(s),xy=G.pos.map((_,i)=>point(i,arm,w,h)),area=w/streams.length;
 ctx.save();ctx.beginPath();ctx.rect(arm*area,0,area,h);ctx.clip();ctx.lineWidth=.8;ctx.strokeStyle='#35454f';ctx.beginPath();
 for(const [i,j] of G.edges){ctx.moveTo(...xy[i]);ctx.lineTo(...xy[j]);}ctx.stroke();
 for(let i=0;i<G.n;i++){
  const [x,y]=xy[i],v=f.state[i],r=G.n>220?3.3:4.8;
  ctx.fillStyle=v===1?'#f5b44e':v===2?'#8db3c0':'#151f29';ctx.strokeStyle=v===1?'#f5b44e':v===3?'#9c7383':'#a4bdc9';ctx.lineWidth=1.1;ctx.beginPath();
  if(v===1){ctx.moveTo(x,y-r-2);ctx.lineTo(x+r+2,y);ctx.lineTo(x,y+r+2);ctx.lineTo(x-r-2,y);ctx.closePath();}
  else if(v===3){ctx.moveTo(x-r,y-r);ctx.lineTo(x+r,y+r);ctx.moveTo(x+r,y-r);ctx.lineTo(x-r,y+r);}
  else ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fill();ctx.stroke();
  const fraction=f.energy[i]/DEFAULTS.full_J;ctx.strokeStyle='#65b885';ctx.beginPath();ctx.arc(x,y,r+2.2,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(1,fraction)));ctx.stroke();
  if(f.tx[i]&&slot<=s.frames.length-1){const age=Math.min(1,(performance.now()-lastSlotTime)/220);ctx.strokeStyle='#51decf';ctx.beginPath();ctx.arc(x,y,r+4+4*age,0,Math.PI*2);ctx.stroke();}
 }
 if(compare){ctx.fillStyle='#cededc';ctx.font='600 13px Segoe UI';ctx.fillText(s.proto+' · '+names[s.proto],arm*area+20,65);ctx.fillRect(arm*area,64,1,h-135);}
 ctx.restore();
 });}
function stop(){playing=false;$('play').textContent='▶ Play';}
function go(t){slot=Math.min(limit,Math.max(0,t));lastSlotTime=performance.now();if(slot===limit)stop();render();
 if(!matchMedia('(prefers-reduced-motion:reduce)').matches){const stamp=lastSlotTime;function ring(){if(stamp===lastSlotTime&&performance.now()-stamp<230){draw();requestAnimationFrame(ring);}}requestAnimationFrame(ring);}}
function playback(now){if(!playing)return;const wait=1000/+$('speed').value;if(now-previousTime>=wait){const steps=Math.floor((now-previousTime)/wait);previousTime+=steps*wait;go(slot+steps);}if(playing)requestAnimationFrame(playback);}
function play(){if(playing){stop();render();return;}if(slot===limit)go(0);playing=true;$('play').textContent='Ⅱ Pause';previousTime=performance.now();requestAnimationFrame(playback);render();}
function flip(){compare=!compare;reset();}
$('play').onclick=play;$('reset').onclick=reset;$('compare').onclick=flip;$('one').onclick=()=>{stop();go(slot+1);};$('ten').onclick=()=>{stop();go(slot+10);};
$('timeline').oninput=()=>{stop();go(+$('timeline').value);};$('speed').oninput=()=>{$('speedVal').textContent=$('speed').value+'/s';stamp('speed',+$('speed').value);};
$('senders').onchange=()=>stamp('observer_sender_ids',$('senders').checked);
for(const id of ['topo','size','degree','seed','loss','het','protocol','other','view','radio','repeat'])$(id).onchange=reset;
$('dice').onclick=()=>{$('seed').value=crypto.getRandomValues(new Uint32Array(1))[0];reset();};
$('controls').onclick=()=>$('left').classList.toggle('closed');$('metrics').onclick=()=>$('right').classList.toggle('closed');
$('fit').onclick=()=>{zoom=1;pan=[0,0];draw();};
cv.onwheel=e=>{e.preventDefault();zoom=Math.max(.35,Math.min(5,zoom*Math.exp(-e.deltaY*.001)));draw();};
cv.onpointerdown=e=>{drag=[e.clientX,e.clientY,...pan];cv.setPointerCapture(e.pointerId);};cv.onpointerup=()=>{drag=null;};
cv.onpointermove=e=>{
 if(drag){pan=[drag[2]+e.clientX-drag[0],drag[3]+e.clientY-drag[1]];draw();return;}
 if(!streams.length)return;const b=canvasBox(),x=e.clientX-b.left,y=e.clientY-b.top,arm=Math.min(streams.length-1,Math.floor(x/(b.width/streams.length)));
 let id=-1,dist=100;G.pos.forEach((_,i)=>{const [px,py]=point(i,arm,b.width,b.height),d=(px-x)**2+(py-y)**2;if(d<dist){dist=d;id=i;}});
 const tip=$('tip');tip.style.display=id<0?'none':'block';if(id<0)return;const f=current(streams[arm]);
 tip.textContent='Node '+id+' · '+['undecided','head','nonhead / covered','dead','cooldown'][f.state[id]]+'\np = '+f.p[id].toFixed(3)+'   effective = '+f.eff[id].toFixed(3)+'\nBattery '+f.energy[id].toFixed(3)+' J'+($('senders').checked?'\nSenders (observer only) '+(f.senders?.[id]?.join(', ')||'none'):'');
 tip.style.left=Math.min(x+10,b.width-200)+'px';tip.style.top=Math.min(y+10,b.height-85)+'px';
};cv.onpointerleave=()=>$('tip').style.display='none';
function exportTrace(type){
 const rows=[];for(const s of streams)for(const f of s.frames.slice(0,slot+1))for(let i=0;i<G.n;i++)rows.push({scenario,protocol:s.proto,seed:activeSeed,slot:f.slot,step:f.step,node:i,state:f.state[i],p_i:f.p[i],p_eff:f.eff[i],energy:f.energy[i],beeped:f.tx[i],heard_any:f.heard[i],observer_sender_count:f.senders?.[i]?.length??'',phase:f.phase});
 const cols=Object.keys(rows[0]);const csv=cols.join(',')+'\n'+rows.map(r=>cols.map(k=>r[k]).join(',')).join('\n');
 const settings=changes.map(z=>'# setting,'+[z.slot,z.order,z.setting,z.value].join(',')).join('\n');
 const text=type==='csv'?csv+'\n'+settings:JSON.stringify({configuration:traceCfg,changes,rows});
 const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:type==='csv'?'text/csv':'application/json'}));a.href=url;a.download='silent-signals-trace.'+type;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
}
$('csv').onclick=()=>exportTrace('csv');$('json').onclick=()=>exportTrace('json');
$('import').onchange=async e=>{try{
 const f=JSON.parse(await e.target.files[0].text());if(f.format!=='silent-signals-python-v1'||!f.frames.length)throw Error('Expected Python fixture format');
 stop();++generation;fixtureMode=true;compare=false;changes=[];G={n:f.pos.length,pos:f.pos,edges:f.edges,adj:f.pos.map(()=>[])};for(const [a,b] of f.edges){G.adj[a].push(b);G.adj[b].push(a);}
 const frames=f.frames.map((x,i)=>({...x,status:i===f.frames.length-1?'completed':'running',beeps:f.frames.slice(0,i+1).reduce((t,v)=>t+sum(v.tx),0)}));
 const zeros=Array(G.n).fill(0);frames.unshift({slot:0,step:0,phase:'ready',status:'running',state:zeros,p:zeros.map(()=>1),eff:zeros,energy:zeros.map(()=>DEFAULTS.full_J),tx:zeros,heard:zeros,beeps:0});
 streams=[{proto:f.protocol,frames}];scenario=f.scenario;activeSeed=f.seed;traceCfg={fixture:f.scenario};limit=frames.length-1;$('timeline').max=limit;go(0);
 }catch(err){$('status').textContent='Trace error · '+err.message;}};
document.addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(e.target.tagName)&&e.key!=='Escape')return;
 if(e.code==='Space'){e.preventDefault();play();}else if(e.key==='ArrowRight'){e.preventDefault();stop();go(slot+1);}
 else if(e.key.toLowerCase()==='r')reset();else if(e.key.toLowerCase()==='c')flip();else if(/^[1-5]$/.test(e.key)){$('protocol').value='P'+e.key;reset();}
 else if(e.key==='Escape'){for(const id of ['left','right'])$(id).classList.add('closed');}});
new ResizeObserver(draw).observe(cv);reset();
