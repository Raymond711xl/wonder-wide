import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./static-atlas.css";

const title = "晃悠 · Wander Wide";
const description =
  "把晃过的国家、城市和景点留在一张好玩的地图上。Been there. Wandered that.";

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host =
    incomingHeaders.get("x-forwarded-host") ?? incomingHeaders.get("host");
  const protocol =
    incomingHeaders.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host ?? "localhost:3000"}`;
  const socialImage = new URL("/og-wander-wide.png", origin).toString();

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
          width: 1672,
          height: 941,
          alt: "晃悠，一张记录个人旅行足迹的波普世界地图",
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
