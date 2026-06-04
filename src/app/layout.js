import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SetupDetector from "../components/SetupDetector";
import { MessageDisplay } from "../components/MessageSystem";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "MUBS EIIC - Interview System",
  description:
    "MUBS Entrepreneurship Incubation and Innovation Centre Interview System",
};

// Allow Next.js to handle caching naturally

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased text-gray-900 min-h-screen flex flex-col`}>
        <SetupDetector>
          {children}
          <MessageDisplay />
        </SetupDetector>
      </body>
    </html>
  );
}
