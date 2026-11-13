/** RunPod queue API only. No provisioning, arbitrary hosts or implicit submission retries. */
import { z } from "zod";
export const endpointSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{3,100}$/, "Enter the endpoint ID, not a URL.");
export const jobIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]{3,160}$/, "Invalid RunPod job ID.");
export const graphSchema = z
  .record(
    z.string().min(1).max(100),
    z
      .object({
        class_type: z.string().min(1).max(150),
        inputs: z.record(z.string(), z.unknown()),
        _meta: z.unknown().optional(),
      })
      .strict(),
  )
  .refine(
    (v) => Object.keys(v).length > 0 && Object.keys(v).length <= 300,
    "Use a workflow with 1–300 nodes.",
  );
export const fileSchema = z
  .object({
    name: z
      .string()
      .regex(/^[a-zA-Z0-9_.-]{1,150}$/)
      .refine(
        (n) =>
          !n.startsWith(".") &&
          /\.(png|jpe?g|webp|mp4|webm|mp3|wav|flac)$/i.test(n),
        "Use a plain media filename.",
      ),
    data: z
      .string()
      .min(4)
      .max(8 * 1024 * 1024)
      .regex(/^[A-Za-z0-9+/]*={0,2}$/),
  })
  .strict();
export const renderSchema = z
  .object({
    schema: z.literal("haggs.runpod/1"),
    workflow: graphSchema,
    files: z.array(fileSchema).max(8),
    outputNode: z.string().min(1).max(100),
    executionSeconds: z.number().int().min(30).max(1800),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!v.workflow[v.outputNode])
      ctx.addIssue({
        code: "custom",
        message: "The output node is not in this workflow.",
      });
    if (new Set(v.files.map((f) => f.name)).size !== v.files.length)
      ctx.addIssue({
        code: "custom",
        message: "Input filenames must be unique.",
      });
    if (JSON.stringify(v).length > 16 * 1024 * 1024)
      ctx.addIssue({
        code: "custom",
        message: "Keep the complete job under 16 MB.",
      });
  });
export type RenderInput = z.infer<typeof renderSchema>;
export const RUNPOD_STATES = [
  "IN_QUEUE",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
] as const;
export type JobState = (typeof RUNPOD_STATES)[number];
const outputSchema = z.object({
  schema: z.literal("haggs.runpod-result/1"),
  artifacts: z
    .array(
      z.object({
        url: z
          .string()
          .url()
          .refine((v) => {
            try {
              const u = new URL(v);
              return u.protocol === "https:" && !u.username && !u.password;
            } catch {
              return false;
            }
          }),
        kind: z.enum(["image", "video", "audio"]),
        name: z.string().max(180),
        bytes: z.number().int().positive(),
        expiresAt: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(20),
});
export type Output = z.infer<typeof outputSchema>;
export type RemoteJob = {
  id: string;
  status: JobState;
  output?: Output;
  error?: string;
  delayTime?: number;
  executionTime?: number;
};
export class SubmissionRejected extends Error {
  constructor(status: number) {
    super(
      `RunPod rejected the submission (HTTP ${status}). No automatic retry was made.`,
    );
  }
}
export class SubmissionUnknown extends Error {
  constructor() {
    super(
      "RunPod may have accepted this request. Do not submit it again. Check the endpoint request history and reconcile the original job.",
    );
  }
}
export function createRunpodClient({
  endpoint,
  key,
  fetch: send = fetch,
}: {
  endpoint: string;
  key: string;
  fetch?: typeof fetch;
}) {
  endpoint = endpointSchema.parse(endpoint);
  if (
    typeof key !== "string" ||
    key.length < 8 ||
    key.length > 1024 ||
    /[\r\n]/.test(key)
  )
    throw Error("Enter a valid RunPod API key locally.");
  const base = `https://api.runpod.ai/v2/${endpoint}`;
  async function call(path: string, method: "GET" | "POST", body?: unknown) {
    let response: Response;
    try {
      response = await send(base + path, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      if (path === "/run") throw new SubmissionUnknown();
      throw Error("RunPod could not be reached. No automatic retry was made.");
    }
    if (!response.ok) {
      if (
        path === "/run" &&
        [400, 401, 402, 403, 404, 413, 422, 429].includes(response.status)
      )
        throw new SubmissionRejected(response.status);
      if (path === "/run" && response.status >= 500)
        throw new SubmissionUnknown();
      throw Error(
        `RunPod returned HTTP ${response.status}. No automatic retry was made.`,
      );
    }
    try {
      return await response.json();
    } catch {
      if (path === "/run") throw new SubmissionUnknown();
      throw Error("RunPod returned an invalid response.");
    }
  }
  function readJob(raw: unknown): RemoteJob {
    const row = z
      .object({
        id: jobIdSchema,
        status: z.enum(RUNPOD_STATES),
        output: z.unknown().optional(),
        error: z.unknown().optional(),
        delayTime: z.number().nonnegative().optional(),
        executionTime: z.number().nonnegative().optional(),
      })
      .parse(raw);
    if (row.status === "COMPLETED")
      return {
        id: row.id,
        status: row.status,
        output: outputSchema.parse(row.output),
        ...(typeof row.delayTime === "number"
          ? { delayTime: row.delayTime }
          : {}),
        ...(typeof row.executionTime === "number"
          ? { executionTime: row.executionTime }
          : {}),
      };
    return {
      id: row.id,
      status: row.status,
      ...(typeof row.delayTime === "number"
        ? { delayTime: row.delayTime }
        : {}),
      ...(typeof row.executionTime === "number"
        ? { executionTime: row.executionTime }
        : {}),
      ...(row.status === "FAILED"
        ? {
            error:
              "The worker reported failure. Inspect its logs; no success or retry is assumed.",
          }
        : {}),
    };
  }
  return {
    /** Does not submit a job or wake a worker. It does not prove worker configuration. */
    async health() {
      const raw = await call("/health", "GET");
      return z
        .object({
          workers: z.record(z.string(), z.number().nonnegative()),
          jobs: z.record(z.string(), z.number().nonnegative()),
        })
        .passthrough()
        .parse(raw);
    },
    async submit(input: RenderInput, requestId: string) {
      z.string().uuid().parse(requestId);
      const checked = renderSchema.parse(input);
      const raw = await call("/run", "POST", {
        input: { ...checked, requestId },
        policy: {
          executionTimeout: checked.executionSeconds * 1000,
          ttl: (checked.executionSeconds + 3600) * 1000,
        },
      });
      try {
        return readJob(raw);
      } catch {
        throw new SubmissionUnknown();
      }
    },
    async status(id: string) {
      const checked = jobIdSchema.parse(id),
        job = readJob(await call(`/status/${checked}`, "GET"));
      if (job.id !== checked)
        throw Error("RunPod returned a different job ID.");
      return job;
    },
    async cancel(id: string) {
      jobIdSchema.parse(id);
      await call(`/cancel/${id}`, "POST");
      return { requested: true as const };
    },
  };
}
