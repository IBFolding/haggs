import { app } from '../../scripts/app.js';

app.registerExtension({name:'Haggs.Studio.WorldMotionVFX',async beforeRegisterNodeDef(nodeType,data){
  if(data.name==='HaggsPlayableWorld'){
    const old=nodeType.prototype.onExecuted;
    nodeType.prototype.onExecuted=function(message){
      old?.apply(this,arguments);
      const url=message?.world_url?.[0];if(!/^\/haggs-studio\/session\/[0-9a-f]{32}\/index\.html$/.test(url||''))return;
      if(!this.haggsWorldFrame){
        const box=document.createElement('div'),bar=document.createElement('div'),frame=document.createElement('iframe');
        box.style.cssText='background:#111826;color:#dfedff';bar.style.cssText='display:flex;gap:12px;padding:10px';
        const proxy=document.createElement('button'),live=document.createElement('button');proxy.textContent='Playable proxy';live.textContent='Connect Eden Live backend';
        for(const b of [proxy,live])b.style.cssText='padding:8px;border:0;border-radius:6px;cursor:pointer';
        bar.append(proxy,live);frame.style.cssText='width:100%;height:600px;border:0';frame.title='Haggs playable world';frame.allow='autoplay; fullscreen';
        box.append(bar,frame);this.haggsWorldFrame=frame;this.haggsWorldLive=live;this.haggsWorldProxy=proxy;
        const w=this.addDOMWidget('haggs_world','haggs_world',box,{serialize:false});w.computeSize=()=>[820,650];
        this.setSize([Math.max(this.size[0],840),Math.max(this.size[1],950)]);
      }
      this.haggsWorldFrame.src=url;this.haggsWorldProxy.onclick=()=>this.haggsWorldFrame.src=url;
      const eden=message?.eden_url?.[0];
      this.haggsWorldLive.onclick=()=>{try{const u=new URL(eden);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error();this.haggsWorldFrame.src=u.href;}catch{alert('Configure the local Eden service URL in this node first.');}};
    };
  }
  if(data.name==='HaggsVFXTimeline'){
    const old=nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated=function(){
      old?.apply(this,arguments);const node=this,box=document.createElement('div'),canvas=document.createElement('canvas'),label=document.createElement('div');
      const choose=document.createElement('select'),time=document.createElement('input');time.type='range';time.min=0;time.max=5;time.step=.05;time.value=1;
      canvas.width=480;canvas.height=270;canvas.style.cssText='width:100%;height:270px;touch-action:none;cursor:crosshair';box.style.cssText='padding:8px;background:#121c2b;color:#dceaff;font:12px system-ui';
      box.append(label,choose,time,canvas);const ctx=canvas.getContext('2d');
      const find=name=>node.widgets.find(w=>w.name===name);let selected=0;
      const read=()=>JSON.parse(find('timeline_json').value);
      function refresh(){
        ctx.fillStyle='#121c2b';ctx.fillRect(0,0,480,270);if(node.haggsVFXImage)ctx.drawImage(node.haggsVFXImage,0,0,480,270);label.textContent='Select an effect; set time; click to place a path keyframe. Time '+Number(time.value).toFixed(2)+'s';
        try{const obj=read(),e=obj.effects?.[selected];if(!e)return;
          if(choose.options.length!==obj.effects.length){choose.replaceChildren();obj.effects.forEach((a,i)=>{const o=document.createElement('option');o.value=i;o.textContent=(i+1)+': '+a.type+' '+a.start+'–'+a.end+'s';choose.append(o);});}
          choose.value=String(selected);time.max=String(Math.max(5,...obj.effects.map(a=>a.end)));
          ctx.strokeStyle='#9cf2d0';ctx.lineWidth=3;ctx.beginPath();(e.path||[]).forEach(([t,x,y],i)=>i?ctx.lineTo(x*480,y*270):ctx.moveTo(x*480,y*270));ctx.stroke();
          (e.path||[]).forEach(([t,x,y])=>{ctx.fillStyle='#f2b66c';ctx.beginPath();ctx.arc(x*480,y*270,5,0,Math.PI*2);ctx.fill();ctx.fillText(t.toFixed(2)+'s',x*480+8,y*270);});
        }catch{label.textContent='Fix timeline JSON to enable effect placement.';}
      }
      choose.onchange=()=>{selected=Number(choose.value);refresh();};time.oninput=refresh;
      canvas.onpointerdown=e=>{try{const obj=read(),effect=obj.effects[selected],t=Number(time.value);if(t<effect.start||t>=effect.end){label.textContent='Choose a time inside this effect’s start/end interval.';return;}const r=canvas.getBoundingClientRect();const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y=Math.max(0,Math.min(1,(e.clientY-r.top)/r.height));effect.path=(effect.path||[]).filter(p=>Math.abs(p[0]-t)>.02);effect.path.push([t,Number(x.toFixed(4)),Number(y.toFixed(4))]);effect.path.sort((a,b)=>a[0]-b[0]);find('timeline_json').value=JSON.stringify(obj,null,2);app.graph.setDirtyCanvas(true,true);refresh();}catch{label.textContent='Fix timeline JSON first.';}};
      const w=this.addDOMWidget('haggs_vfx_placement','haggs_vfx_placement',box,{serialize:false});w.computeSize=()=>[480,330];
      this.haggsVfxRefresh=refresh;requestAnimationFrame(refresh);const configured=this.onConfigure;this.onConfigure=function(){configured?.apply(this,arguments);requestAnimationFrame(refresh);};
    };
    const executed=nodeType.prototype.onExecuted;nodeType.prototype.onExecuted=function(message){executed?.apply(this,arguments);const url=message?.vfx_reference_url?.[0];if(!url?.startsWith('/view?'))return;const im=new Image();im.onload=()=>{this.haggsVFXImage=im;this.haggsVfxRefresh?.();};im.src=url;};
  }
}});
