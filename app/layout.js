import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorker from "@/components/ServiceWorker";
import InstallPrompt from "@/components/InstallPrompt";
import PushNotifications from "@/components/PushNotifications";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata = {
  title: "CineNest",
  description: "A private cinema for the barkada.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CineNest",
  },
};

export const viewport = {
  themeColor: "#0f1216",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${instrument.variable} ${jetbrains.variable}`}>
      <body className="bg-ink text-text">
        <ServiceWorker />
        <InstallPrompt />
        <PushNotifications />
        {children}
      </body>
    </html>
  );
}