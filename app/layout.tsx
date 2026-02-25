import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Image from "next/image";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AnalyticsProvider } from "@/components/AnalyticsProvider";
import { Navbar } from "@/components/Navbar";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Showcase | Smallest AI",
    template: "%s | Smallest AI Showcase",
  },
  description:
    "Explore voice and audio experiences built with Smallest AI. Try live demos, discover community projects, and build your own.",
  keywords: [
    "Smallest AI",
    "voice AI",
    "speech to text",
    "text to speech",
    "voice agents",
    "STT",
    "TTS",
    "Atoms SDK",
    "Pulse STT",
    "Lightning TTS",
  ],
  openGraph: {
    title: "Showcase | Smallest AI",
    description:
      "Explore voice and audio experiences built with Smallest AI.",
    siteName: "Smallest AI Showcase",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@smallest_AI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider>
          <AnalyticsProvider>
            <Navbar />
            <main className="min-h-[calc(100vh-4rem)]">{children}</main>
            <Footer />
          </AnalyticsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/smallest-icon.png"
              alt="Smallest AI"
              width={24}
              height={24}
              className="rounded-md"
            />
            <span className="text-sm text-muted-foreground">
              Smallest AI Showcase
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a
              href="https://smallest.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              smallest.ai
            </a>
            <a
              href="https://waves-docs.smallest.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Docs
            </a>
            <a
              href="https://github.com/smallest-inc/cookbook"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://discord.gg/5evETqguJs"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Discord
            </a>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Built with Smallest AI APIs. The source code is available on{" "}
          <a
            href="https://github.com/smallest-inc/cookbook"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal hover:underline"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
