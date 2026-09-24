import type { Metadata, Viewport } from "next";
import "@fontsource-variable/jetbrains-mono";
import "lenis/dist/lenis.css";
import "./globals.css";
import Script from "next/script";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  metadataBase: new URL("https://3d.ravindrassk.com"),
  title: "Ravindra SSK — Neural Space",
  description:
    "An immersive 3D portfolio of Ravindra SSK, AI/ML engineer: LLM evaluation, computer vision and production ML, built with React Three Fiber, GLSL and GSAP.",
  openGraph: {
    title: "Ravindra SSK — Neural Space",
    description: "An immersive 3D portfolio: LLM evaluation, computer vision and production ML.",
    images: ["/images/headshot-dark.webp"],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#04070d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="antialiased" data-theme="neural" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,700,800&f[]=satoshi@400,500,700&f[]=zodiak@400,500,700&display=swap"
        />
      </head>
      <body>
        {/* Sets data-theme before hydration so there is no flash of the wrong theme */}
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
