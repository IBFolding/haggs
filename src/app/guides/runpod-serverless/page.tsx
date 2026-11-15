import Link from "next/link";
import { LearnShell } from "../../learn-shell";
export default function Page() {
  return (
    <LearnShell current="/docs">
      <article style={{ maxWidth: 850, padding: 32 }}>
        <h1>RunPod Serverless for Haggs</h1>
        <p>
          The account is the first step. Haggs still needs a queue endpoint
          running the compatible worker, persistent request receipts and private
          output storage. The Serverless integration is separate from the
          running-Pod ComfyUI gateway.
        </p>
        <h2>Prepared deployment shape</h2>
        <ul>
          <li>
            Queue-based endpoint, zero active workers, maximum one worker, one
            GPU per worker.
          </li>
          <li>
            Ten-second idle timeout as a starting configuration; workers scale
            down after work finishes. Startup and idle waiting can be billed.
          </li>
          <li>
            At least 48 GB VRAM is a selection requirement, not a performance
            guarantee. Compare current US Serverless capacity and benchmark the
            actual model/workflow.
          </li>
          <li>
            A proposed 200 GB persistent volume for models and request receipts.
            Storage remains billed while compute is scaled down.
          </li>
          <li>
            A private S3-compatible output bucket. Completed videos are uploaded
            before the worker reports success, so they can be downloaded after
            compute stops.
          </li>
        </ul>
        <h2>Build before renting</h2>
        <ol>
          <li>
            Review{" "}
            <a href="https://github.com/IBFolding/haggs/tree/feature/creator-studios/tools/runpod">
              the worker source and draft deployment plan
            </a>
            .
          </li>
          <li>
            Choose an actual CUDA/PyTorch base image by immutable digest, a
            ComfyUI commit and pinned custom-node/model versions. The Dockerfile
            deliberately requires those choices.
          </li>
          <li>
            Build with the reviewed image and commit. Resolve a full Python
            dependency lock, then run local/container contract tests. The
            provided version ranges are not a validated production lock.
          </li>
          <li>
            Review each model’s commercial and territorial terms. Code licensing
            does not grant model-weight rights.
          </li>
          <li>
            Before creating the endpoint or volume, review live GPU/storage
            pricing and approve provisioning plus a specific proof-render
            budget.
          </li>
        </ol>
        <h2>Configure the worker privately</h2>
        <p>
          Worker environment: <code>HAGGS_S3_ENDPOINT</code>,{" "}
          <code>HAGGS_S3_BUCKET</code>, <code>HAGGS_S3_ACCESS_KEY</code>,{" "}
          <code>HAGGS_S3_SECRET_KEY</code> and optionally{" "}
          <code>HAGGS_S3_REGION</code>. Use scoped storage credentials in
          RunPod’s secret settings. Do not put these in a workflow or paste them
          into chat. Models go under the mounted volume’s model directories; the
          handler never installs models on demand.
        </p>
        <h2>Connect Haggs</h2>
        <ol>
          <li>
            Apply the account-scoped RunPod job-journal migration separately in
            production. Configure the server-only{" "}
            <code>HAGGS_GPU_CONNECTION_SECRET</code>.
          </li>
          <li>
            Enter the endpoint ID and RunPod API key locally in{" "}
            <Link href="/runpod">the RunPod workspace</Link>. The health check
            submits no job and does not verify that the custom worker works.
          </li>
          <li>
            Keep <code>HAGGS_RUNPOD_EXECUTION_ENABLED</code> disabled during
            setup. Enable it only for the approved proof after the
            endpoint/storage configuration is reviewed.
          </li>
          <li>
            Import ComfyUI API JSON, select its output node and attach matching
            input filenames. Confirm the billed request before submitting.
          </li>
          <li>
            Verify upload → queue → execution → private output → download,
            refresh/reconnect recovery and actual scale-down. Record the bill
            and output quality before release.
          </li>
        </ol>
        <h2>Recovery and costs</h2>
        <p>
          Haggs durably claims the request before submission and never
          automatically resends an ambiguous request. The worker uses a
          persistent logical request claim so provider retries do not repeat
          known or unresolved inference. If a worker crashes, an unresolved
          claim may require manual reconciliation rather than automatic
          recovery. Cancelling is a request; inspect the provider’s final
          job/worker state. The execution timeout is not an exact dollar cap.
        </p>
        <p>
          RunPod job-result retention is short. Haggs saves the job reference,
          while the worker saves output artifacts separately. Signed download
          links expire; retain your own copy. This workspace does not yet send
          RunPod jobs from every existing image/video model button or
          automatically insert a result into an editor take.
        </p>
        <p>
          <a href="https://docs.runpod.io/serverless/endpoints/send-requests">
            Queue API and retention
          </a>{" "}
          ·{" "}
          <a href="https://docs.runpod.io/serverless/endpoints/endpoint-configurations">
            Worker settings
          </a>{" "}
          ·{" "}
          <a href="https://docs.runpod.io/serverless/pricing">
            Current billing documentation
          </a>
        </p>
      </article>
    </LearnShell>
  );
}
