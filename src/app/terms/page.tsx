import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms — haggs" };

/** Plain terms for the hosted service. A first draft: have a lawyer read it before you charge anyone. */
export default function Terms() {
  return (
    <div className="app">
      <div className="canvas">
        <article className="legal">
          <p className="wf-small"><Link href="/">← haggs</Link></p>
          <h1>Terms of use</h1>
          <p className="wf-small">Last updated 23 October 2026.</p>
          <h2>What haggs is</h2>
          <p>haggs is an open-source film studio. The code is MIT licensed. This site is a hosted copy of it. It makes pictures, video and sound by sending your requests to Comfy and its partners, and it edits what comes back.</p>
          <h2>Your account and your keys</h2>
          <p>You can use haggs without an account. An account lets you keep projects across devices and, when plans are on, unlocks the platform. If you add your own Comfy key, runs are billed to your Comfy account and the price on each button is an estimate, not an invoice. Keep your keys private. We store them in a cookie in your browser and never show them back.</p>
          <h2>What you make</h2>
          <p>You own what you make. You are responsible for having the right to anything you upload, including photos of people. Do not use haggs to make content that is illegal, that sexualises minors, or that imitates a real person to deceive. Do not build a character from someone&rsquo;s photos without their permission.</p>
          <h2>Files we keep</h2>
          <p>Pictures, clips and renders you make here are stored in our file store so you can play and download them. Files are kept for 60 days and then removed. Download anything you want to keep. Projects live in your browser, and in your account if you sign in.</p>
          <h2>Plans and credits</h2>
          <p>Paid plans, where offered, unlock the studio and may include credits for generation. Credits are used at the price shown before each run and do not roll over unless a plan says so. You can cancel any time from your account; cancelling stops the next charge.</p>
          <h2>Third parties</h2>
          <p>Generation is done by Comfy and the model makers it works with. Their terms apply to what you send them. Archive footage from the Internet Archive carries its own licences; check each film before you publish.</p>
          <h2>No warranty</h2>
          <p>haggs is provided as it is. Models can get things wrong. We are not liable for lost projects or for charges you incur on your own provider accounts. You can export your projects at any time.</p>
          <h2>Contact</h2>
          <p>Questions or a problem: use the issues page on the project&rsquo;s GitHub, <a href="https://github.com/IBFolding/haggs">github.com/IBFolding/haggs</a>.</p>
          <p className="wf-small"><Link href="/privacy">Privacy</Link></p>
        </article>
      </div>
    </div>
  );
}
