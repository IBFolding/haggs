import type { Metadata } from 'next';
import { Toolkits } from './toolkits';
export const metadata: Metadata = { title: 'Community toolkits — haggs' };
export default function Page(){return <Toolkits/>;}
