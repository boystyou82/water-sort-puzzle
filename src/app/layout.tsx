import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Water Sort Puzzle — Free Online Brain Game",
  description:
    "Play the addictive Water Sort Puzzle online for free. Sort the colored water in the tubes. No download, no signup. Train your brain!",
  keywords: [
    "water sort",
    "puzzle",
    "color sort",
    "brain game",
    "free puzzle",
    "online puzzle",
    "logic game",
  ],
  openGraph: {
    title: "Water Sort Puzzle",
    description: "Free online color sorting puzzle. Play instantly in your browser.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
