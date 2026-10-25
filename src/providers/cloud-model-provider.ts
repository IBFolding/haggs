import { createCloudRunner, type CloudOptions } from "./cloud";
import { cloudModel, cloudPrice, cloudWorkflow } from "./cloud-models";
import { ProviderError, type Capability, type GenerationResult, type Provider, type Quote } from "./types";

const VIDEO: Capability[] = ["text-to-video", "image-to-video"];
const IMAGE: Capability[] = ["text-to-image", "image-edit"];

/**
 * Runs one of the cloud models (Kling, Seedance, Veo, Nano Banana, Kontext) as a Comfy Cloud workflow.
 * Pictures are uploaded first, the request is checked before anything is sent, and the price reported is
 * the one shown on the button for those settings.
 */
export function createCloudModelProvider(options: CloudOptions & { modelId: string }): Provider {
  const def = cloudModel(options.modelId);
  if (!def) throw new ProviderError("comfy-cloud", `${options.modelId} isn't a cloud model.`);
  const cloud = createCloudRunner(options);
  const answers: Capability[] = def.kind === "video" ? VIDEO : IMAGE;

  const price = (settings: Record<string, unknown> | undefined) => cloudPrice(def.id, settings ?? {}) ?? null;

  return {
    name: "comfy-cloud",
    supports: (capability) => answers.includes(capability),
    async quote(request): Promise<Quote> {
      return { provider: "comfy-cloud", endpoint: def.id, usd: price(request.passthrough), basis: "Comfy's published rate for this model; an estimate, billed by Comfy" };
    },
    async run(request): Promise<GenerationResult> {
      // Check the request on its own first, so a mistake costs no upload and no money.
      def.build({ prompt: request.prompt, settings: request.passthrough ?? {}, images: (request.images ?? []).slice(0, def.maxImages).map(() => "placeholder.png") });
      const uploaded: string[] = [];
      for (const image of (request.images ?? []).slice(0, def.maxImages)) uploaded.push(await cloud.upload(image));
      const result = await cloud.run(cloudWorkflow(def.id, { prompt: request.prompt, settings: request.passthrough ?? {}, images: uploaded }));
      if (result.kind === "audio") throw new ProviderError("comfy-cloud", `${def.id} returned sound without a picture.`);
      return { provider: "comfy-cloud", endpoint: def.id, assets: [{ url: result.url, kind: result.kind }], usd: price(request.passthrough), raw: { jobId: result.jobId } } satisfies GenerationResult;
    },
  };
}
