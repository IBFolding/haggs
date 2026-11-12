import {blankBookPage,newBook} from '../comic/books';
import {newPanel,type LookId,type LayoutId} from '../comic/comic';
export {newBook};
export function newPanelForPlan(label:string,page:{summary:string;panels:{action:string;caption:string;dialogue:string}[]},look:LookId,layout:LayoutId){const made=blankBookPage(`Page ${label}`,look,layout,page.summary);made.draft.panels=page.panels.map(p=>newPanel({action:p.action,caption:p.caption,lines:p.dialogue?[{who:'',text:p.dialogue}]:[]}));return made;}
