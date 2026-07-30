import type { Metadata } from "next";
import "./globals.css";
import "./static-atlas.css";
import "./wander-almanac.css";

const title = "晃悠 · Wander Wide";
const description =
  "把晃过的国家、城市和景点留在一张好玩的地图上。Been there. Wandered that.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
