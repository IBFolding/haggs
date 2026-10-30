/** Inventory only: these editor graphs are not yet executable through the managed adapter.
 * Some output nodes write multiple files; a single video URL is not a complete result. */
export const GAME_DIRECTOR_PREVIEW_OUTPUTS = {
 '01-drag-to-action': [{node:'911',type:'video'}],
 '02-boss-fight-choreographer': [{node:'911',type:'video'}],
 '03-playable-scene-forge': [{node:'9000',type:'branch-player-bundle'}],
 '04-game-reskin-director': [{node:'911',type:'video'}],
 '05-animation-moveset-builder': [{node:'911',type:'video'},{node:'950',type:'atlas-and-metadata'}],
 '06-enemy-intent-painter': [{node:'911',type:'video'},{node:'950',type:'atlas-and-metadata'}],
} as const;
