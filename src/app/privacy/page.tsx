import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy — haggs" };

/** What the hosted service does with data, in plain words. A first draft: have a lawyer read it before you charge anyone. */
export default function Privacy() {
  return (
    <div className="app">
      <div className="canvas">
        <article className="legal">
          <p className="wf-small"><Link href="/">← haggs</Link></p>
          <h1>Privacy</h1>
          <p className="wf-small">Last updated 23 October 2026.</p>
          <h2>What stays in your browser</h2>
          <p>Your projects, characters, places, runs and Academy progress are stored in your browser. Nothing is sent anywhere until you run something or sign in.</p>
          <h2>What we receive</h2>
          <ul>
            <li><b>When you run something:</b> your prompt and any pictures, video or audio you attach go to our server and on to Comfy to be processed. The result is kept in our file store for 60 days.</li>
            <li><b>When you add a key:</b> it is kept in a cookie in your browser and sent only with your own requests. We do not store it on our servers.</li>
            <li><b>When you sign in:</b> your email address, or your Google or GitHub identity, handled by Supabase. If you turn on cross-device projects, your project data is stored there too, readable only by you.</li>
            <li><b>When you pay:</b> Stripe handles your card. We receive your plan and its status, never the card number.</li>
            <li><b>Usage:</b> page views and performance, through Vercel Analytics and Speed Insights, without cookies or personal profiles.</li>
          </ul>
          <h2>What we do not do</h2>
          <p>We do not sell your data, train models on your work, or share your projects. Files in our store have long unguessable links; anyone with a link can open that file, so do not post links you want private.</p>
          <h2>Photos of people</h2>
          <p>Characters built from photos use your pictures only to make your pictures. Only use photos of people who have said you may.</p>
          <h2>Your choices</h2>
          <p>Clear your browser&rsquo;s site data to remove local projects. Ask us to delete your account and stored files through the project&rsquo;s GitHub issues, and we will.</p>
          <p className="wf-small"><Link href="/terms">Terms</Link></p>
        </article>
      </div>
    </div>
  );
}
