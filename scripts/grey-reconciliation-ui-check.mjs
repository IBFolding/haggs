/** Local production compatibility smoke for main's workflow pages after Grey Room reconciliation. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
const require=createRequire(import.meta.url),puppeteer=require(process.env.PUPPETEER_CORE||'puppeteer-core');
const out=join(process.cwd(),'output/reconciliation-workflows');mkdirSync(out,{recursive:true});
const fixture={schema:'haggs.scene-forge/1',labels:['Left','Hold','Right'],clips:[null,null,null]};
writeFileSync(join(out,'fixture.json'),JSON.stringify(fixture));
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,userDataDir:join(out,'profile'),args:['--disable-dev-shm-usage'],defaultViewport:{width:1440,height:1000}});
const checks=[],errors=[];
try {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
 const cdp=await page.createCDPSession();await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:out});
 for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  await page.setViewport({width,height,isMobile:name==='mobile',hasTouch:name==='mobile'});
  await page.goto('http://127.0.0.1:3123/workflows?notour#haggs',{waitUntil:'networkidle2',timeout:120000});
  await page.waitForSelector('.haggs-intro');
  assert.equal(await page.$eval('.haggs-intro-steps',e=>getComputedStyle(e).display),'grid');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.ok(await page.$('a[href="/workflows/haggs_scene_forge"]'));
  await page.screenshot({path:join(out,name+'-workflows.png')});
  checks.push(name+': main workflow introduction and Scene Forge link survive shared CSS reconciliation without horizontal overflow');
  await page.goto('http://127.0.0.1:3123/workflows/haggs_scene_forge?notour',{waitUntil:'networkidle2',timeout:120000});
  await page.waitForSelector('[aria-label="Scene choices"]');
  const input=await page.$('input[type="file"][accept="application/json,.json"]');assert.ok(input);await input.uploadFile(join(out,'fixture.json'));
  await page.waitForFunction(()=>document.querySelector('[aria-label="Scene choices"] input')?.value==='Left');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.equal(await page.$$eval('button',es=>es.find(e=>e.textContent==='Download playable scene').disabled),true);
  await page.screenshot({path:join(out,name+'-scene-forge.png')});
  checks.push(name+': Scene Forge opens saved labels, retains empty clips and keeps playable export disabled');
 }
 const buttons=await page.$$('button');for(const button of buttons)if(await button.evaluate(e=>e.textContent==='Save editable project'))await button.click();
 for(let i=0;i<40&&!readdirSync(out).includes('scene-forge-project.json');i++)await new Promise(r=>setTimeout(r,100));
 assert.deepEqual(JSON.parse(readFileSync(join(out,'scene-forge-project.json'),'utf8')),fixture);
 checks.push('Scene Forge saves the reopened project without changing labels or clip slots');
 assert.deepEqual(errors,[]);writeFileSync(join(out,'results.json'),JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors},null,2));
}finally{await Promise.race([browser.close(),new Promise(resolve=>setTimeout(resolve,10000))]);if(browser.process()?.exitCode===null)browser.process().kill("SIGTERM");}
process.exit(0);
