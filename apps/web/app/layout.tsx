import type { Metadata } from "next";
import { DM_Sans, Pacifico } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm",
});

const pacifico = Pacifico({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pacifico",
});

export const metadata: Metadata = {
  title: "MergeGraph — Git stores code. MergeGraph stores context.",
  description:
    "Turn repository activity into a living knowledge graph. Ask why, not just what.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${pacifico.variable}`}>
      <body>{children}</body>
    </html>
  );
}