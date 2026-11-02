import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createHistory, setLook, type GreyScene } from "./grey-scene";
import { finishCutout, undoPending, type GreyEditState } from "./grey-edit-safety";

describe("Grey Room edit safety", () => {
  const source = { url: "/shot.mp4", kind: "video" as const, revision: "one", trimIn: 2 };
  const matte = { url: "/matte.webm", at: 1, price: "$0" };

  it("keeps edits made while a cut-out runs and refuses a changed source", () => {
    const edited: GreyScene = setLook({ source }, { exposure: 0.4 });
    assert.deepEqual(finishCutout(edited, source, matte), { ...edited, matte });
    assert.equal(finishCutout({ ...edited, source: { ...source, revision: "two" } }, source, matte), null);
    assert.equal(finishCutout({ ...edited, source: { ...source, trimIn: 3 } }, source, matte), null);
    const { source: _removed, ...withoutSource } = edited;
    assert.equal(finishCutout(withoutSource, source, matte), null);
  });

  it("undoes a pending edit first and makes it available to redo", () => {
    const first: GreyScene = { source };
    const edited: GreyScene = setLook({ source }, { exposure: 0.2 });
    const pending: GreyScene = setLook({ source }, { exposure: 0.5 });
    const history = createHistory(first);
    assert.equal(undoPending(history, edited), first);
    assert.equal(history.redo(), edited);
    assert.equal(undoPending(history, pending), edited);
    assert.equal(history.redo(), pending);
    assert.equal(history.current, pending);
  });
});

it("combined setup undo restores AI people, camera and scene together without reverting newer takes",async()=>{
 const {restoreGreyEdit}=await import("./grey-edit-safety"),{defaultGrey}=await import("./grey"),{newShot}=await import("./model");
 const before={grey:defaultGrey(),scene:{space:{floor:"wood" as const,wall:"plaster" as const}}};
 const after={grey:{...before.grey,subjects:[...before.grey.subjects,{id:"new",label:"Avery",x:1,z:1}],cam:{...before.grey.cam,lens:85},light:{az:90,el:30}},scene:{space:{floor:"metal" as const,wall:"concrete" as const}}};
 const history=createHistory<GreyEditState>(before);history.push(after);
 const render={url:"new-take.mp4",kind:"video" as const,at:2,usd:1,promptHash:"new"};
 const current={...newShot(),grey:after.grey,greyScene:after.scene,render,takes:[{...render,id:"take"}],approved:true};
 const restored=restoreGreyEdit(current,history.undo()!);assert.deepEqual(restored.grey,before.grey);assert.deepEqual(restored.greyScene,before.scene);assert.deepEqual(restored.render,current.render);assert.deepEqual(restored.takes,current.takes);assert.equal(restored.approved,true);
 const redone=restoreGreyEdit(restored,history.redo()!);assert.deepEqual(redone.grey,after.grey);assert.deepEqual(redone.greyScene,after.scene);assert.deepEqual(redone.takes,current.takes);
});
it("undoing a first blockout edit preserves a legacy shot with no stored frame",async()=>{
 const {restoreGreyEdit}=await import("./grey-edit-safety");
 const {defaultGrey}=await import("./grey"),{newShot}=await import("./model");
 const scene={source:{url:"original.mp4",kind:"video" as const}};
 const result=restoreGreyEdit({...newShot(),grey:defaultGrey(),greyScene:scene},{grey:undefined,scene});
 assert.equal("grey" in result,false);assert.deepEqual(result.greyScene,scene);
});


it("selecting or cancelling without changing setup data does not create a redundant undo step",async()=>{
 const {sameGreyEdit}=await import("./grey-edit-safety"),{defaultGrey}=await import("./grey");const grey=defaultGrey();
 assert.equal(sameGreyEdit({grey,scene:{source:{url:"original.mp4",kind:"video"}}},{scene:{source:{kind:"video",url:"original.mp4"}},grey:{light:grey.light,subjects:grey.subjects,cam:grey.cam}}),true);
 assert.equal(sameGreyEdit({grey,scene:{}},{grey:{...grey,cam:{...grey.cam,lens:85}},scene:{}}),false);
 assert.equal(sameGreyEdit({grey:undefined,scene:{}},{grey,scene:{}}),false);
});
