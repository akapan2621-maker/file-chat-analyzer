import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AI Workspace",
  description: "Minimalist Luxury AI Workspace & RAG Knowledge Base",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `dark` is the default theme; the client-side useTheme() hook removes it
    // when the user picks light mode. suppressHydrationWarning covers the
    // class flip that happens before React hydrates.
    <html lang="th" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint to avoid a flash of the
            wrong colour scheme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ai-workspace-theme");if(t==="light"){document.documentElement.classList.remove("dark")}}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
