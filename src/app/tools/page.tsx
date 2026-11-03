import type { Metadata } from "next";
import Link from "next/link";

import { VIDEO_TOOLS } from "../../tools/video-tools";
import { Nav } from "../nav";
import { SiteFooter } from "../site-footer";
import styles from "./tools.module.css";

export const metadata: Metadata = { title: "Free video tools — haggs" };

export default function ToolsPage() {
  return (
    <>
      <Nav current="Workflows" />
      <main className={styles.page}>
        <header className={styles.head}>
          <span className={styles.kicker}>FREE · OPEN SOURCE · RUNS ON YOUR MACHINE</span>
          <h1>Video tools</h1>
          <p>Open-source programs made by other people, one click each. Nothing is uploaded and no credits are used: HAGGS runs the program you installed on a clip in your local media folder. Every card names the creator, links their GitHub and shows the licence.</p>
        </header>
        <div className={styles.grid}>
          {VIDEO_TOOLS.map((t) => (
            <Link key={t.id} href={`/tools/${t.id}`} className={styles.card}>
              <b>{t.name}</b>
              <span>{t.does}</span>
              <small>By {t.creator} · {t.licence}</small>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
