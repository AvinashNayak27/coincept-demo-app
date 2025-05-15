import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "../lib/providers";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Coincept",
  description: "For the minds who curate ideas and for the hands who build.",
  openGraph: {
    title: 'Coincept',
    description: 'For the minds who curate ideas and for the hands who build.',
    url: 'https://coincept.world',
    siteName: 'Coincept',
    images: [
      {
        url: 'https://coincept.world/coincept.png', // Must be an absolute URL
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/icon.png" type="image/png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
