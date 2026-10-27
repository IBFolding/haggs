import assert from 'node:assert/strict';
import {test} from 'node:test';
import {FORMATS,layoutFormat} from './formats';
import {useSheetAsset,useSheetAssets} from './assets';
import {exportSheets,importSheets} from './sheets';
const base=()=>layoutFormat(FORMATS[0]!, 'Keep the original idea', 'Draft');
const character={id:'saved-person',kind:'character' as const,name:'Mara',image:'data:image/png;base64,fixture',words:'Approved identity'};
test('existing bank references preserve beats and shots, roundtrip, and do not duplicate on return',()=>{
 const before=base();const next=useSheetAsset(before,character);
 assert.deepEqual(next.story,before.story);assert.deepEqual(next.shots,before.shots);
 assert.equal(next.characters.length,before.characters.length+1);
 assert.equal(next.characters.at(-1)?.bankId,'character:saved-person');
 const restored=importSheets(exportSheets(next));
 assert.deepEqual(useSheetAsset(restored,character),restored);
 assert.deepEqual(character,{id:'saved-person',kind:'character',name:'Mara',image:'data:image/png;base64,fixture',words:'Approved identity'});
});
test('replacing an existing project reference keeps project row and other edits',()=>{
 const first=useSheetAsset(base(),character);const row=first.characters.at(-1)!;
 row.wardrobe='Project override';row.voice='Keep voice';
 const next=useSheetAsset(first,{...character,id:'other',image:'other-image'},row.id);
 assert.equal(next.characters.at(-1)?.id,row.id);assert.equal(next.characters.at(-1)?.wardrobe,'Project override');
 assert.equal(next.characters.at(-1)?.voice,'Keep voice');assert.equal(next.characters.length,first.characters.length);
});
test('multiple asset kinds attach without changing source records; unfinished or missing targets reject',()=>{
 const location={...character,id:'place',kind:'place' as const,name:'Saloon'};
 const result=useSheetAssets(base(),[character,location]);assert.equal(result.locations.at(-1)?.bankId,'place:place');
 assert.throws(()=>useSheetAsset(result,{...character,image:null}),/Finish/);
 assert.throws(()=>useSheetAsset(result,character,'missing'),/no longer/);
 assert.throws(()=>useSheetAsset(result,{...character,kind:'accessory'}),/character or location/);
});
