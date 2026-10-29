import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { greyPlan } from "./grey-render";
import { addLight, addProp, setAtmos, setLook, updateProp, type GreyScene } from "./grey-scene";

const size = { w: 1080, h: 1920 };
const base: GreyScene = { matte: { url: "/api/local/m.webm", at: 1, price: "x" }, backdrop: { url: "/api/local/room.png", name: "Room", scale: 1.5, x: 0.25, y: 0.5, blur: 0.5 } };

describe("greyPlan", () => {
  it("stacks backdrop, props behind, the actor, props in front, then lights and the look, in that order", () => {
    let s = addProp(base, { name: "Table", url: "/api/local/table.png", behind: true });
    s = addProp(s, { name: "Chair", url: "/api/local/chair.png" });
    s = addLight(s, "key");
    s = setLook(s, { warmth: 0.5, exposure: 0.1 });
    const p = greyPlan(s, size, 4, "/api/local/footage.mp4");
    assert.deepEqual(p.inputs.map((i) => i.role), ["backdrop", "prop", "actor", "prop", "light", "footage"], "table behind, then the actor, then the chair");
    assert.deepEqual(p.inputs.map((i) => i.ref).slice(1, 4), ["/api/local/table.png", "/api/local/matte-placeholder", "/api/local/chair.png"].map((x, i) => (i === 1 ? "/api/local/m.webm" : x)));
    const f = p.filter;
    const at = (needle: string) => f.indexOf(needle);
    assert.ok(at("[floor][bd]") < at("[bg][pp1]") && at("[bg][pp1]") < at("[pb1][ac]") && at("[pb1][ac]") < at("[wa][pp3]") && at("[wa][pp3]") < at("[pf3][4:v]"), "layers go on in stacking order");
    assert.match(f, /colorbalance/);
    assert.match(f, /eq=/);
    assert.match(f, /\[out\]$/);
    assert.equal(p.audioFrom, 5);
  });

  it("decodes the cut-out with the decoder that keeps its transparency", () => {
    const p = greyPlan(base, size, 4, "/api/local/footage.mp4");
    assert.deepEqual(p.inputs.find((i) => i.role === "actor")!.args, ["-c:v", "libvpx-vp9"]);
  });

  it("places and turns a prop where the preview shows it", () => {
    let s = addProp(base, { name: "Lamp", url: "/api/local/lamp.png" });
    const id = s.props![0]!.id;
    s = updateProp(s, id, { x: 0.25, y: 0.75, w: 0.5, rotate: 90, opacity: 0.5, flip: true });
    const f = greyPlan(s, size, 4, "/f.mp4").filter;
    assert.match(f, /scale=540:-1/);
    assert.match(f, /hflip/);
    assert.match(f, /rotate=/);
    assert.match(f, /aa=0\.5/);
    assert.match(f, /x=270-overlay_w\/2/);
    assert.match(f, /y=1440-overlay_h\/2/);
  });

  it("skips hidden props, uses the original footage when there is no cut-out, and slides the air past the frame", () => {
    let s = addProp({}, { name: "Hidden", url: "/h.png" });
    s = updateProp(s, s.props![0]!.id, { hidden: true });
    s = setAtmos(s, "rain", 0.7);
    const p = greyPlan(s, size, 4, "/api/local/footage.mp4");
    assert.deepEqual(p.inputs.map((i) => i.role), ["footage-picture", "air", "footage"]);
    assert.match(p.filter, /overlay=x=0:y='mod\(t\*3072,1920\)-1920'/, "rain falls one tile per beat of its speed");
    assert.ok(p.notes.some((n) => /cut/i.test(n)), "warns that there is no cut-out");
  });
});

describe("greyPlan with motion", () => {
  it("moves a prop, a light and the backdrop over time with expressions in seconds", () => {
    let s = addProp(base, { name: "Ball", url: "/api/local/ball.png" });
    s = { ...s, props: [{ ...s.props![0]!, keys: [{ t: 0, x: 0.2 }, { t: 2, x: 0.8 }, { t: 0, w: 0.2 }, { t: 2, w: 0.4 }, { t: 0, rotate: 0 }, { t: 2, rotate: 90 }] }] };
    s = addLight(s, "glow");
    s = { ...s, lights: [{ ...s.lights![0]!, keys: [{ t: 0, x: 0.3 }, { t: 4, x: 0.7 }] }], backdrop: { ...s.backdrop!, keys: [{ t: 0, x: 0.2 }, { t: 4, x: 0.8 }] } };
    const f = greyPlan(s, size, 4, "/f.mp4").filter;
    assert.match(f, /overlay=x='1080\*\(if\(lt\(t,0\),0\.2,if\(lt\(t,2\),0\.2\+/, "prop x follows its keys");
    assert.match(f, /scale=w='round\(1080\*\(if\(lt\(t,0\),0\.2,if\(lt\(t,2\)/, "prop size follows its keys");
    assert.match(f, /eval=frame/);
    assert.match(f, /rotate=a='\(if\(lt\(t,0\),0,if\(lt\(t,2\)/, "prop turn follows its keys");
    assert.match(f, /overlay=x='\(if\(lt\(t,0\),0\.3,if\(lt\(t,4\),0\.3\+/, "the light's glow slides with its position");
    assert.match(f, /\(1080-overlay_w\)\*\(if\(lt\(t,0\),0\.2,if\(lt\(t,4\),0\.2\+/, "the backdrop pans");
  });
});

import { shadowSize } from "./grey-render";
import { setShadow } from "./grey-scene";

describe("greyPlan shadows", () => {
  it("lays a contact shadow under each prop that has one, sized from its picture", () => {
    let s = addProp(base, { name: "Chair", url: "/api/local/chair.png" });
    const id = s.props![0]!.id;
    s = updateProp(s, id, { x: 0.5, y: 0.5, w: 0.25 });
    const p = greyPlan(s, size, 4, "/f.mp4", { [id]: 1.5 });
    assert.deepEqual(p.inputs.map((i) => i.role), ["backdrop", "actor", "shadow", "prop", "footage"]);
    assert.deepEqual(shadowSize(s.props![0]!, size, 1.5), { w: 248, h: 41 });
    assert.match(p.filter, /overlay=x=540-overlay_w\/2:y=1163-overlay_h\/2/, "under the bottom edge of the prop");
    const off = updateProp(s, id, { shadow: 0 });
    assert.deepEqual(greyPlan(off, size, 4, "/f.mp4", { [id]: 1.5 }).inputs.map((i) => i.role), ["backdrop", "actor", "prop", "footage"]);
    assert.deepEqual(greyPlan(s, size, 4, "/f.mp4").inputs.map((i) => i.role), ["backdrop", "actor", "prop", "footage"], "no picture size, no shadow");
  });

  it("throws the actor's shadow behind them, toward the angle you chose", () => {
    const p = greyPlan(setShadow(base, { amount: 0.6, angle: 90 }), size, 4, "/f.mp4");
    assert.match(p.filter, /split/);
    assert.match(p.filter, /colorchannelmixer=rr=0:gg=0:bb=0:aa=0\.42/);
    assert.match(p.filter, /gblur=sigma=/);
    assert.match(p.filter, /y=\(1920-overlay_h\)\/2\+24/, "falls downward at 90°");
    assert.doesNotMatch(greyPlan(base, size, 4, "/f.mp4").filter, /split/);
  });
});

import { addSurface, updateSurface } from "./grey-scene";

describe("greyPlan surfaces", () => {
  it("lays a wall's new texture over the wall cut from the footage, under the props and the actor", () => {
    let s = addProp(base, { name: "Table", url: "/api/local/table.png", behind: true });
    s = addSurface(s, "Wall");
    s = updateSurface(s, s.surfaces![0]!.id, { mask: { url: "/api/local/wall.webm", at: 1, price: "x" }, texture: { url: "/api/local/brick.png", name: "brick", scale: 2 }, strength: 0.6 });
    const p = greyPlan(s, size, 4, "/f.mp4");
    assert.deepEqual(p.inputs.map((i) => i.role), ["backdrop", "surface", "texture", "prop", "actor", "footage"]);
    assert.deepEqual(p.inputs[1]!.args, ["-c:v", "libvpx-vp9"]);
    assert.deepEqual(p.inputs[2]!.tile, 540, "a tile half the frame wide at twice the size");
    assert.match(p.filter, /alphaextract/);
    assert.match(p.filter, /blend=all_mode=overlay:all_opacity=0\.6/);
    assert.match(p.filter, /alphamerge/);
    assert.ok(p.filter.indexOf("alphamerge") < p.filter.indexOf("[pb"), "before the props");
  });

  it("skips a surface that hasn't been found or has no texture", () => {
    let s = addSurface(base, "Floor");
    assert.deepEqual(greyPlan(s, size, 4, "/f.mp4").inputs.map((i) => i.role), ["backdrop", "actor", "footage"]);
    s = updateSurface(s, s.surfaces![0]!.id, { mask: { url: "/m.webm", at: 1, price: "x" } });
    assert.deepEqual(greyPlan(s, size, 4, "/f.mp4").inputs.map((i) => i.role), ["backdrop", "actor", "footage"]);
  });
});

 it("keeps floor replacement visible over uncut footage", () => {
  let s = addSurface({}, "Floor");
  s = updateSurface(s, s.surfaces![0]!.id, { mask: {url:"/floor.webm",at:1,price:"x"}, texture:{url:"/oak.png",name:"Oak",scale:1} });
  const p = greyPlan(s, size, 3, "/original.mp4");
  assert.deepEqual(p.inputs.map(i=>i.role), ["footage-picture", "surface", "texture", "footage"]);
  assert.ok(p.filter.indexOf("[wa]") < p.filter.indexOf("alphamerge"));
  assert.match(p.filter, /\[wa\]\[sf1\]overlay/);
 });
