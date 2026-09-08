import type { Metadata } from "next";
import "./globals.css";
import "./explorer.css";

export const metadata: Metadata = {
  title: "FileMarket | Global Data Network",
  description:
    "Explore FileMarket's demo network of data hubs, facilities, and available data streams around the world.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
