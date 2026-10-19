import Link from "next/link";
import type { ReactNode } from "react";

/**
 * One nav for every surface. Items that have somewhere to go are links; the
 * rest stay inert buttons until the surface behind them exists, because a nav
 * item that navigates to an empty page is worse than one that visibly doesn't
 * go anywhere yet.
 */

type Item = { label: string; href?: string };

const ITEMS: readonly Item[] = [
  { label: "Create", href: "/" },
  { label: "Explore" },
  { label: "Video" },
  { label: "Edit" },
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
