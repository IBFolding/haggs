import Link from "next/link";

import { modeLinks, type ModeGroup } from "./mode-links";

/** The tab strip shared by the Photos pages and the Video pages. `current` is the href of the page you are on. */
export function ModeTabs({ group, current, canEdit = false }: { group: ModeGroup; current: string; canEdit?: boolean }) {
  return (
    <nav className="modes" aria-label={group}>
      {modeLinks(group, canEdit).map((link) => (
        <Link key={link.href} href={link.href} aria-current={link.href === current ? "page" : undefined}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
