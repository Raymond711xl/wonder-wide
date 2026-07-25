import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./static-atlas.css";

const title = "远迹 · Footprint Atlas";
const description =
  "在两级静态世界地图上点亮国家，以城市为单位记录日期、停留方式、地点与足迹积分。";

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host =
    incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host");
  const protocol =
    incomingHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host ?? "localhost:3000"}`;
  const socialImage = new URL("/og.png", origin).toString();

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [
        {
          url: socialImage,
          width: 1733,
          height: 909,
          alt: "远迹，一张可以留下个人旅行足迹的世界地图",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
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
