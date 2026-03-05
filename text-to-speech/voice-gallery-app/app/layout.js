import "./globals.css";

export const metadata = {
  title: "Smallest AI Voice Gallery",
  description: "Browse, filter, and preview 80+ AI voices",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white min-h-screen">{children}</body>
    </html>
  );
}
