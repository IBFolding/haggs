import Link from "next/link";

/**
 * The four places every project has, in the order the work moves through
 * them: plan it on Sheets, shoot it on the Board, assemble it in the Cut, and
 * keep everything it is made of in Media. Each tab is the same project.
 */

const TABS = [
  { id: "sheets", label: "Sheets", path: "/sheets" },
  { id: "board", label: "Board", path: "" },
  { id: "cut", label: "Cut", path: "/cut" },
  { id: "media", label: "Media", path: "/media" },
] as const;

export type ProjectTab = (typeof TABS)[number]["id"];

export function ProjectTabs({ id, name, current }: { id: string; name?: string; current: ProjectTab }) {
  return (
    <div className="ptabs">
      <Link className="ptabs-back" href="/library" aria-label="All projects">
        Projects
      </Link>
      <span className="ptabs-sep">/</span>
      <span className="ptabs-name">{name ?? ""}</span>
      <nav className="ptabs-list" aria-label="Project">
        {TABS.map((tab, i) => (
          <Link key={tab.id} href={`/board/${id}${tab.path}`} aria-current={tab.id === current ? "page" : undefined}>
            <i>{i + 1}</i>
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
