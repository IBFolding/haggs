import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "haggs — see the prompt, see the price",
  description:
    "A workflow runner for generative media. Routes a brief to a shoot, shows you the prompt it will send and what it will cost, then runs it on whichever provider you choose.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
