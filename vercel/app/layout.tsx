import "./globals.css";

export const metadata = {
  title: "File Chat Analyzer",
  description: "จัดการไฟล์และแชทกับ AI รองรับภาษาไทย",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
