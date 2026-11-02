import {zodOutputFormat} from "@anthropic-ai/sdk/helpers/zod";
import {sceneProposalSchema} from "../story/grey-space";

/** Anthropic supports a JSON Schema subset. Its installed SDK moves unsupported
 * bounds into descriptions. Keep the original Zod schema for all response/apply validation. */
export const GREY_PROVIDER_SCHEMA = zodOutputFormat(sceneProposalSchema).schema;
