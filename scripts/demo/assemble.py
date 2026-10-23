import json,subprocess,os
from PIL import Image,ImageDraw,ImageFont
W=1920;H=1080
segs=json.load(open("segs-v2.json"))
SPEED={"editor":1.45,"seriesgen":8.0}
CAP={"home":"haggs","workflows":"Ready-made apps","canvas":"Build your own","series":"Series, faceless channels too","seriesgen":"Pictures appear on the page","editor":"The editor","academy":"Academy","gpu":"Bring your own GPU","mcp":"Works with Claude over MCP"}
VO={"home":"home","workflows":"workflows","canvas":"canvas","series":"series","editor":"editor","academy":"academy","gpu":"gpu","end":"end"}
def run(a): subprocess.run(["ffmpeg","-v","error","-y",*a],check=True)
os.makedirs("out2",exist_ok=True)
durs=[]
for s in segs:
    sp=SPEED.get(s["name"],1.0)
    run(["-i",s["file"],"-vf",f"setpts=PTS/{sp},fps=30,scale=1920:1080,format=yuv420p","-an","-c:v","libx264","-crf","17","-preset","medium",f"out2/{s['name']}.mp4"])
    d=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f"out2/{s['name']}.mp4"]))
    durs.append((s["name"],d)); print(s["name"],round(d,1))
# end card on the last scene's tail
open("list2.txt","w").write("".join(f"file 'out2/{n}.mp4'\n" for n,_ in durs))
run(["-f","concat","-safe","0","-i","list2.txt","-c","copy","joined2.mp4"])
total=sum(d for _,d in durs)
font=ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc",42,index=1)
t=0;overlays=[];voices=[]
for n,d in durs:
    if n in CAP:
        im=Image.new("RGBA",(W,H),(0,0,0,0));dr=ImageDraw.Draw(im);txt=CAP[n];tw=dr.textlength(txt,font=font);bw=tw+70;x=60;y=H-120
        dr.rounded_rectangle((x,y,x+bw,y+76),radius=38,fill=(10,10,10,225),outline=(210,245,90,255),width=3);dr.text((x+35,y+14),txt,font=font,fill=(255,255,255,255));im.save(f"cap2_{n}.png");overlays.append((f"cap2_{n}.png",t+0.4,t+d-0.4))
    if n in VO: voices.append((f"vo/{VO[n]}.mp3",t+0.5))
    t+=d
inputs=[];filt="[0:v]"
for i,(fn,a,b) in enumerate(overlays):
    inputs+=["-i",fn]; nxt=f"[v{i}]"
    filt+=(f"[{i+1}:v]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'{nxt};{nxt}" if i<len(overlays)-1 else f"[{i+1}:v]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'[outv]")
n_ov=len(overlays)
ai=[]
for fn,_ in voices: ai+=["-i",fn]
MUSIC="/Users/brain/.codex/.chatgpt-projects/g-p-6a9615ab19208191bcc9ac0ddc90fe4e/open-higgs/app/artifacts/waylight/production-v011-journey/audio-work/song-levelled.wav"
ai+=["-i",MUSIC]
vo_filters=";".join(f"[{n_ov+1+i}:a]aresample=48000,adelay={int(st*1000)}|{int(st*1000)}[v{i}]" for i,(_,st) in enumerate(voices))
mus_idx=n_ov+1+len(voices)
mix=vo_filters+f";[{mus_idx}:a]aresample=48000,atrim=0:{total},volume=-17dB,afade=t=in:d=2,afade=t=out:st={total-3}:d=3[m];"+"".join(f"[v{i}]" for i in range(len(voices)))+f"[m]amix=inputs={len(voices)+1}:normalize=0:duration=longest,loudnorm=I=-16:TP=-1.5:LRA=9[a]"
run(["-i","joined2.mp4",*inputs,*ai,"-filter_complex",filt+";"+mix,"-map","[outv]","-map","[a]","-t",str(total),"-c:v","libx264","-crf","18","-preset","medium","-c:a","aac","-b:a","192k","-movflags","+faststart","haggs-commercial.mp4"])
print("total",round(total,1))
