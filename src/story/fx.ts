/**
 * Looks for a shot: VHS, CRT, glitch, thermal, night vision, retro, noir.
 * Each is a plain ffmpeg filter chain, so it costs nothing to run and works on
 * every render, on the live site and on your own machine. A chain is applied
 * after the shot is framed and before its fades.
 *
 * Commas inside an expression are escaped (\,) so ffmpeg reads them as part of
 * the expression, and no chain contains a quote, so it is safe in a shell script.
 * The editor preview approximates each look in CSS (globals.css, .stage[data-fx]).
 */

export type FxId = "vhs" | "crt" | "glitch" | "thermal" | "night" | "retro" | "noir";

export const FX: { id: FxId; name: string; says: string }[] = [
  { id: "vhs", name: "VHS", says: "Soft, warm, a little colour bleed and tape noise, like a tape found in a drawer." },
  { id: "crt", name: "CRT", says: "A curved old television screen with scan lines and glowing edges." },
  { id: "glitch", name: "Glitch", says: "The colours tear apart in short bursts, about once a second." },
  { id: "thermal", name: "Thermal", says: "A heat camera: cold is blue and purple, warm is orange and yellow." },
  { id: "night", name: "Night vision", says: "Green and grainy, as seen through military goggles." },
  { id: "retro", name: "Retro pop", says: "Punchy contrast, teal shadows and warm highlights, with film grain." },
  { id: "noir", name: "Noir", says: "Black and white, hard contrast, grain and dark corners." },
];

const CHAINS: Record<FxId, string> = {
  vhs: "eq=saturation=1.15:contrast=1.1:brightness=0.03:gamma=1.05,rgbashift=rh=-6:bh=6:rv=1,gblur=sigma=1.1:steps=1,noise=alls=24:allf=t+u,vignette=PI/6,curves=preset=lighter",
  crt: "lenscorrection=k1=-0.22:k2=-0.22,drawgrid=w=0:h=3:t=1:c=black@0.5,rgbashift=rh=-3:bh=3,eq=saturation=1.3:contrast=1.15:brightness=0.06,vignette=PI/5",
  glitch: "rgbashift=rh=9:bh=-9:gv=4:enable=lt(mod(t\\,1.1)\\,0.18),noise=alls=22:allf=t:enable=lt(mod(t\\,1.1)\\,0.18),eq=contrast=1.1:saturation=1.2",
  thermal: "format=gray,eq=contrast=1.15:gamma=0.72,format=rgb24,curves=r=0/0 0.35/0.1 0.6/0.85 1/1:g=0/0 0.5/0.05 0.75/0.65 1/1:b=0/0.25 0.2/0.55 0.45/0.25 0.75/0 1/0.35,format=yuv420p,noise=alls=6:allf=t",
  night: "format=gray,eq=brightness=0.12:contrast=1.5,format=rgb24,colorchannelmixer=rr=0:rg=0:rb=0:gr=0.25:gg=1:gb=0.15:br=0:bg=0:bb=0,format=yuv420p,noise=alls=22:allf=t+u,vignette=PI/3",
  retro: "eq=contrast=1.35:saturation=1.9:gamma=0.95,colorbalance=rs=-0.12:bs=0.14:rh=0.14:bh=-0.12,noise=alls=10:allf=t,vignette=PI/5",
  noir: "hue=s=0,eq=contrast=1.3:brightness=-0.02,noise=alls=12:allf=t,vignette=PI/3.2",
};

export const isFx = (value: unknown): value is FxId => typeof value === "string" && value in CHAINS;

/** The ffmpeg filter chain for a look, or an empty string for none or anything unknown. */
export const fxFilter = (id: string | undefined): string => (isFx(id) ? CHAINS[id] : "");
