import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "nftoken · login-url utility",
  description:
    "Exchange a Netflix session cookie for a one-tap login URL. Paste NetflixId, generate, open.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
