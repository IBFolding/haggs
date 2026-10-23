"use client";

export function PrintButton() {
  return <button className="pill" onClick={() => window.print()}>Print or save as PDF</button>;
}
