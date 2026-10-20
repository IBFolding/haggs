import Link from "next/link";
import type { ReactNode } from "react";

/**
 * One nav for every surface.
 *
 * There is no Explore here. Higgsfield's Explore is a feed of other people's
 * work, and we have no community to put in one — so the slot shows the thing
 * we do have, which is your own runs and what they cost.
 */

type Item = { label: string; href?: string };

const ITEMS: readonly Item[] = [
  { label: "Sheets", href: "/sheets" },
  { label: "Create", href: "/" },
  { label: "Gallery", href: "/gallery" },
  { label: "Video", href: "/video" },
  { label: "Edit", href: "/edit" },
  { label: "Library", href: "/library" },
];

export function Nav({ current, children }: { current: string; children?: ReactNode }) {
  return (
    <nav className="nav">
      <span className="logo">
        haggs<i>.</i>
      </span>
      {ITEMS.map((item) =>
        item.href ? (
          <Link
            key={item.label}
            className="nav-item"
            href={item.href}
            aria-current={item.label === current}
          >
            {item.label}
          </Link>
        ) : (
          <button key={item.label} className="nav-item" disabled>
            {item.label}
          </button>
        ),
      )}
      <span className="nav-right">{children}</span>
    </nav>
  );
}
