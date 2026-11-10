import type { Metadata } from "next";
import { Nav } from "../nav";
import WorldsStudio from "./worlds";

export const metadata: Metadata = {
  title: "Haggs Worlds — build worlds, shoot films",
  description: "Build editable procedural Three.js worlds, animate cameras and export scene files for Blender and film production.",
};

export default function WorldsPage() {
  return <div className="app"><Nav current="Worlds" /><WorldsStudio /></div>;
}
