import { hosted } from './blob';
import { userNow } from './auth';
import { storageAllowance } from './storage-quota';
/** Refuse known zero-storage accounts before charging a provider. Uploads still enforce quota. */
export async function checkGenerationStorage(): Promise<void> {
 if (!hosted()) return;
 const user = await userNow();
 if (!user) throw new Error('Sign in to save generated results. Nothing was submitted.');
 if (!(await storageAllowance(user))) throw new Error('This account has no cloud storage. Use the local Haggs app or an account with cloud storage. Nothing was submitted to Comfy.');
}
