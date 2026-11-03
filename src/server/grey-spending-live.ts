import {userNow} from './auth';
import {greySpendingStore,verifiedGreyMaximum,withGreySpending,type GreySpendKind} from './grey-spending';
export async function runWithGreyCap<T>(kind:GreySpendKind,run:(recordActual:(usd:number)=>void)=>Promise<T>,approvedUsd?:number){
 const user=await userNow(),store=greySpendingStore(process.env);
 return withGreySpending({userId:user?.id,maximumUsd:verifiedGreyMaximum(kind,process.env,approvedUsd),reserve:store.reserve,finish:store.finish},run);
}
