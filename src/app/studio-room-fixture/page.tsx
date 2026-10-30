import {notFound} from 'next/navigation';import {RoomFixture} from './room';export const dynamic='force-dynamic';
export default function Page(){if(process.env.NODE_ENV==='production'||process.env.HAGGS_STUDIO_FIXTURE!=='1')notFound();return <RoomFixture/>;}
