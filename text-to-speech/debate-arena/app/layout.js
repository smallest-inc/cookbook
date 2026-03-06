import "./globals.css";

export const metadata = {
  title: "The Agora — AI Philosophical Debate",
  description:
    "Watch Socrates and Aristotle debate any topic with AI-generated voices",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gradient-to-b from-[#1a1510] via-[#13100b] to-[#0f0d0a] text-cream min-h-screen overflow-x-hidden font-body">
        {/* Ambient warm glow orbs */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#c9a84c]/[0.03] rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-[#8b9d7a]/[0.03] rounded-full blur-[130px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#d4956a]/[0.02] rounded-full blur-[180px]" />
        </div>
        {children}
      </body>
    </html>
  );
}
