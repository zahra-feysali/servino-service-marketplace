import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import "./globals.css";

const vazirmatn = localFont({
  src: "../../node_modules/vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2",
  variable: "--font-vazirmatn",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "سروینو | بازار آنلاین خدمات",
    template: "%s | سروینو",
  },
  description: "سروینو؛ ثبت درخواست خدمات، دریافت پیشنهاد قیمت از متخصصان تأییدشده و انتخاب بهترین گزینه.",
};

export const viewport: Viewport = {
  themeColor: "#0f8a84",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
