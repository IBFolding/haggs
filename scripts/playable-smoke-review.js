/** Run with Playwright CLI on an already-open LOCAL Haggs code-game page.
 * Free scripted input, screenshots and runtime diagnostics. No AI judge or model calls.
 * Adjust the key sequence to the game's controls; a smoke pass is not playability certification.
 */
async (page) => {
 const url=new URL(page.url());
 if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!/^\/playable\/[^/]+$/.test(url.pathname))throw Error('Open a local Haggs game project before running this review.');
 const report={schema:'haggs.playable-smoke/1',project:url.pathname,at:new Date().toISOString(),kind:'scripted-smoke',actions:[],events:[],screenshots:[],errors:[],limitations:['Synthetic control sequence, not an autonomous player','Game-reported score/end events are diagnostics, not independent quality scores','Winning this sequence does not prove all levels or devices work']};
 await page.evaluate(()=>{
  window.__haggsSmoke=[];
  window.__haggsSmokeListener=event=>{if(event.source!==document.querySelector('iframe.pl-code-frame')?.contentWindow||!event.data?.haggs)return;const d=event.data;if(!['ready','score','end','error'].includes(d.type))return;window.__haggsSmoke.push({type:d.type,...(typeof d.score==='number'&&Number.isFinite(d.score)?{score:d.score}:{}),...(typeof d.won==='boolean'?{won:d.won}:{}),...(d.type==='error'?{message:String(d.message??'').slice(0,500)}:{})});window.__haggsSmoke=window.__haggsSmoke.slice(-200);};
  addEventListener('message',window.__haggsSmokeListener);
 });
 try{
  await page.getByRole('button',{name:'Replay',exact:true}).click();
  const game=page.frameLocator('iframe.pl-code-frame');await game.getByRole('button',{name:'Play',exact:true}).click();
  await game.locator('#game').click({position:{x:30,y:30}});
  const sequence=[{key:'ArrowUp',ms:8000},{key:'ArrowRight',ms:800},{key:'Space',ms:250},{key:'ArrowLeft',ms:800}];
  for(const [i,action] of sequence.entries()){
   report.actions.push(action);await page.keyboard.down(action.key);await page.waitForTimeout(action.ms);await page.keyboard.up(action.key);
   const path=`output/playwright/game-smoke-${i+1}.png`;await page.locator('iframe.pl-code-frame').screenshot({path});report.screenshots.push(path);
  }
  report.events=await page.evaluate(()=>window.__haggsSmoke??[]);report.errors=report.events.filter(e=>e.type==='error');
  report.observedWin=report.events.some(e=>e.type==='end'&&e.won===true);
  const download=page.waitForEvent('download');
  await page.evaluate(report=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='playable-smoke-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);},report);
  await (await download).saveAs('output/playwright/playable-smoke-report.json');
  if(report.errors.length)throw Error(`Game reported ${report.errors.length} runtime errors. Inspect output/playwright/playable-smoke-report.json.`);
 }finally{
  for(const key of ['ArrowUp','ArrowRight','Space','ArrowLeft'])await page.keyboard.up(key);
  await page.evaluate(()=>{removeEventListener('message',window.__haggsSmokeListener);delete window.__haggsSmokeListener;delete window.__haggsSmoke;});
 }
}
