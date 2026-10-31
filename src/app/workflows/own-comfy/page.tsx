import {notFound} from 'next/navigation';
import {Setup} from './setup';
export const dynamic='force-dynamic';
export default function OwnComfyPage(){
 if(process.env.HAGGS_OWN_COMFY_SETUP_PREVIEW!=='1') notFound();
 return <Setup/>;
}
