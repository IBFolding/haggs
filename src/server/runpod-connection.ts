import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { userNow } from "./auth";
import { endpointSchema } from "../runpod/client";
export const RUNPOD_COOKIE = "haggs_runpod";
export type RunpodConnection = {
  id: string;
  endpoint: string;
  key: string;
  owner: string;
  expires: number;
};
const dev = globalThis as typeof globalThis & { __haggsRunpodKey?: Buffer };
function secret() {
  const value = process.env.HAGGS_GPU_CONNECTION_SECRET;
  if (value && /^[a-f\d]{64}$/i.test(value)) return Buffer.from(value, "hex");
  if (process.env.NODE_ENV === "production")
    throw Error("The host must configure HAGGS_GPU_CONNECTION_SECRET first.");
  return (dev.__haggsRunpodKey ??= randomBytes(32));
}
export function sealRunpod(value: RunpodConnection) {
  endpointSchema.parse(value.endpoint);
  if (
    value.key.length < 8 ||
    value.key.length > 1024 ||
    /[\r\n]/.test(value.key)
  )
    throw Error("Enter a valid RunPod API key.");
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", secret(), iv);
  cipher.setAAD(Buffer.from(RUNPOD_COOKIE));
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(value)),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString("base64url");
}
export function unsealRunpod(
  value: string,
  owner: string,
): RunpodConnection | undefined {
  try {
    if (value.length > 3500) return;
    const bytes = Buffer.from(value, "base64url"),
      decipher = createDecipheriv(
        "aes-256-gcm",
        secret(),
        bytes.subarray(0, 12),
      );
    decipher.setAAD(Buffer.from(RUNPOD_COOKIE));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const result = JSON.parse(
      Buffer.concat([
        decipher.update(bytes.subarray(28)),
        decipher.final(),
      ]).toString(),
    ) as RunpodConnection;
    endpointSchema.parse(result.endpoint);
    if (
      result.owner !== owner ||
      typeof result.id !== "string" ||
      typeof result.key !== "string" ||
      !Number.isFinite(result.expires) ||
      result.expires <= Date.now()
    )
      return;
    return result;
  } catch {
    return;
  }
}
export async function runpodOwner() {
  const owner =
    process.env.NODE_ENV === "production"
      ? (await userNow())?.id
      : "local-development";
  if (!owner) throw Error("Sign in to use RunPod.");
  return owner;
}
export async function runpodConnection() {
  const value = (await cookies()).get(RUNPOD_COOKIE)?.value;
  if (!value) throw Error("Connect your RunPod endpoint first.");
  const result = unsealRunpod(value, await runpodOwner());
  if (!result)
    throw Error("Reconnect RunPod: this saved connection expired or changed.");
  return result;
}
