import {z} from "zod";
import {planInput} from "../simple/plan";
import type Anthropic from "@anthropic-ai/sdk";
import {AGENT_OPEN_PAGE_DESCRIPTION} from "../brand/product-copy";

const {$schema:_schema,...productionSchema}=z.toJSONSchema(planInput);
export const HAGGY_TOOLS: Anthropic.Beta.BetaTool[] = [
 {name:'propose_production_plan',description:'Propose or revise a complete Simple production plan for review. Does not edit the project, generate or spend. Choose image/video per shot, concrete camera movement, lighting, existing reference URLs or generated character/location assets, and optional narration, sound effects and music. Reuse existing shots by ID when appropriate. Execution is only a user button, never a tool.',input_schema:{type:'object',properties:{project:{type:'string'},plan:productionSchema},required:['project','plan'],additionalProperties:false}},
 {name:'read_production_plan',description:'Read the saved Simple production plan and execution progress. Read this before revising a plan. No generation or spending.',input_schema:{type:'object',properties:{project:{type:'string'}},required:['project'],additionalProperties:false}},
  { name: "list_projects", description: "The person's projects, each with its boards and how many shots they have.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "read_board",
    description: "One board's shots in order: id, number, beat, seconds, what it shows (still, video or nothing), how many takes, whether it's kept as it is, and its voice-over lines.",
    input_schema: { type: "object", properties: { project: { type: "string" }, board: { type: "string", description: "Board id; the first board if left out." } }, required: ["project"], additionalProperties: false },
  },
  {
    name: "read_sheets",
    description: "The project's sheets: characters (looks, how many reference pictures), places, and the board's story beats.",
    input_schema: { type: "object", properties: { project: { type: "string" }, board: { type: "string" } }, required: ["project"], additionalProperties: false },
  },
  {
    name: "edit_shots",
    description: "Change shots on a board: the beat, the seconds it holds, or keep it as it is (locked, so batch tools leave it alone). Only the fields given change.",
    input_schema: {
      type: "object",
      properties: {
        project: { type: "string" },
        board: { type: "string" },
        edits: { type: "array", items: { type: "object", properties: { shot: { type: "string" }, beat: { type: "string" }, seconds: { type: "number" }, locked: { type: "boolean" } }, required: ["shot"], additionalProperties: false } },
      },
      required: ["project", "board", "edits"],
      additionalProperties: false,
    },
  },
  {
    name: "move_shot",
    description: "Move a shot to a new position on its board (1 is first).",
    input_schema: { type: "object", properties: { project: { type: "string" }, board: { type: "string" }, shot: { type: "string" }, to: { type: "integer", minimum: 1 } }, required: ["project", "board", "shot", "to"], additionalProperties: false },
  },
  {
    name: "add_board",
    description: "Add a new board to a project. Each shot reuses an existing shot by id (keeping its takes) or starts empty from a beat. Nothing already there changes.",
    input_schema: {
      type: "object",
      properties: {
        project: { type: "string" },
        name: { type: "string" },
        shots: { type: "array", items: { type: "object", properties: { beat: { type: "string" }, seconds: { type: "number" }, from: { type: "string" }, dialogue: { type: "string" }, locked: { type: "boolean" } }, required: ["beat", "seconds"], additionalProperties: false } },
      },
      required: ["project", "name", "shots"],
      additionalProperties: false,
    },
  },
  {
    name: "add_voice_line",
    description: "Put a voice-over line on a shot. It is not spoken yet; the person presses Speak in the Cut, which shows the price. Voices: Sarah (female, american), Laura (female, american), Chris (male, american), Brian (male, american), George (male, british), Alice (female, british) and others from ElevenLabs.",
    input_schema: { type: "object", properties: { project: { type: "string" }, board: { type: "string" }, shot: { type: "string" }, speaker: { type: "string" }, text: { type: "string" }, voice: { type: "string" }, offset: { type: "number", description: "Seconds after the shot starts." } }, required: ["project", "board", "shot", "speaker", "text", "voice"], additionalProperties: false },
  },
  {
    name: "find_workflows",
    description: "Search Comfy's workflows that run here, by what they do (character swap, product video, upscale…).",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
  },
  {
    name: "open_page",
    description: AGENT_OPEN_PAGE_DESCRIPTION,
    input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false },
  },
];

