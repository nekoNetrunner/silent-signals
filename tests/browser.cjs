// Run with Playwright available on NODE_PATH and EDGE_EXE pointing at installed Edge.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.EDGE_EXE,headless:true,args:['--disable-gpu','--no-first-run','--disable-background-networking']});
 try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(pathToFileURL(path.resolve(__dirname,'../viz/simulator.html')).href);await page.waitForFunction(()=>streams.length===1);
 const ready=()=>page.waitForFunction(()=>document.querySelector('#status').textContent!=='Preparing…');
 for(const proto of ['P1','P2','P3','P4','P5']){
   await page.selectOption('#protocol',proto);await ready();
   await page.evaluate(()=>go(limit));assert.equal(await page.evaluate(()=>G.n),100);
   assert.equal(await page.evaluate(()=>current(streams[0]).status),'completed');
 }
 const saved=await page.evaluate(()=>JSON.stringify(Array.from(current(streams[0]).state)));
 await page.click('#reset');await ready();await page.evaluate(()=>go(limit));assert.equal(await page.evaluate(()=>JSON.stringify(Array.from(current(streams[0]).state))),saved);
 await page.click('#compare');await ready();assert.equal(await page.evaluate(()=>streams.length),2);
 await page.click('#ten');const stamp=await page.evaluate(()=>slot);await page.evaluate(()=>go(1));await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>slot),2);
 await page.evaluate(t=>go(t),stamp);await page.selectOption('#view','setup');await ready();await page.evaluate(()=>go(limit));
 assert.equal(await page.evaluate(()=>streams.every(s=>current(s).status==='setup complete')),true);
 await page.locator('#speed').fill('25');await page.locator('#speed').dispatchEvent('input');
 for(const type of ['json','csv']){
   const p=page.waitForEvent('download');await page.click('#'+type);const download=await p;
   const text=fs.readFileSync(await download.path(),'utf8');
   if(type==='json'){const a=JSON.parse(text);assert.ok(a.rows.length>=100);assert.ok(a.changes.length);}
   else assert.ok(text.includes('beeped,heard_any'));
 }
 await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight),true);
 if(process.env.UI_SCREENSHOT)await page.screenshot({path:process.env.UI_SCREENSHOT});
 await page.locator('#import').setInputFiles(path.resolve(__dirname,'../viz/python-trace.json'));await page.waitForFunction(()=>fixtureMode);
 const ref=require('../viz/python-trace.json');
 for(const f of ref.frames){await page.keyboard.press('ArrowRight');const a=await page.evaluate(()=>current(streams[0]));assert.equal(a.slot,f.slot);assert.deepEqual(a.state,f.state);assert.deepEqual(a.energy,f.energy);}
 await page.keyboard.press('r');await ready();await page.keyboard.press('3');await ready();assert.equal(await page.locator('#protocol').inputValue(),'P3');
 await page.keyboard.press('c');await ready();await page.keyboard.press('Space');await page.keyboard.press('Space');
 await page.keyboard.press('Escape');assert.ok(await page.locator('#left').evaluate(el=>el.classList.contains('closed')));
 assert.deepEqual(errors,[]);console.log('PASS '+(process.env.EDGE_EXE?'system browser':'Chromium Headless Shell')+' '+browser.version()+'; file://; five protocols at n=100; deterministic reset; shared-clock comparison; rewind; full setup; both exports; keyboard; 1920x1080 and 1280x720; independent Python replay; no console errors.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
