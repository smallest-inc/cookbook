import "./globals.css";

export const metadata = {
  title: "Voice Wordle — Smallest AI",
  description: "Play Wordle by voice. Pulse STT hears your guess, Lightning TTS speaks the feedback.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
