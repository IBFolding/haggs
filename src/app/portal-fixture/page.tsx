import {notFound} from 'next/navigation';
import {Fixture} from './fixture';
export const dynamic='force-dynamic';
export default function Page(){if(process.env.NODE_ENV==='production'||process.env.HAGGS_PORTAL_FIXTURE!=='1')notFound();return <Fixture/>;}
