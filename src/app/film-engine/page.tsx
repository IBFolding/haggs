import type { Metadata } from "next";
import { Nav } from "../nav";
import FilmEngineStudio from "./studio";

export const metadata: Metadata = {
  title: "Haggs Film Engine — direct the impossible",
  description: "Film production workspace: AI-directed shot plans, real-time 3D cameras, review and exports for Blender, Three.js and ComfyUI.",
};

export default function FilmEnginePage() {
  return <div className="app"><Nav current="Worlds"/><FilmEngineStudio/></div>;
}
