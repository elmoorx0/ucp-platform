import type { Metadata } from "next";
import { Cairo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "منصة UCP — منصة الاتصالات الموحدة",
  description: "منصة اتصالات موحدة مستقلة تعمل كطبقة وسيطة بين تطبيقاتك والمستخدمين — Communication as a Service",
  keywords: ["UCP", "CPaaS", "منصة اتصالات", "إشعارات", "realtime", "Next.js"],
  authors: [{ name: "UCP Platform" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "منصة UCP — منصة الاتصالات الموحدة",
    description: "منصة اتصالات موحدة مستقلة تعمل كطبقة وسيطة بين تطبيقاتك والمستخدمين",
    siteName: "UCP Platform",
    type: "website",
    locale: "ar_SA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${cairo.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
