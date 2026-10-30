import {notFound} from 'next/navigation';import {Preview} from './preview';export const dynamic='force-dynamic';
export default function Page(){if(process.env.NODE_ENV==='production'||process.env.HAGGS_STUDIO_FIXTURE!=='1')notFound();return <Preview/>;}
