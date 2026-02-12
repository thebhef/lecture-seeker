import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lecture Seeker",
  description: "Bay Area event aggregator and calendar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
