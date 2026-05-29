import "./globals.css";

export const metadata = {
  title: "Smallest AI — live STT + streaming TTS chat",
  description: "Demo widget combining Pulse STT WS + Lightning v3.1 TTS WS for fully real-time voice chat.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
