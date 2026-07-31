import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plat/Stitch — Image Alignment",
  description: "Arrange, align, preview, and export image plates as TIFF.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
