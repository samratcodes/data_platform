import type { Metadata } from "next";
import "./globals.css";
import "./explorer.css";

export const metadata: Metadata = {
  title: { default: "map.filemarket | Verified AI Data Network", template: "%s | map.filemarket" },
  description:
    "Discover verified data companies, robotics operators, and physical collection facilities through a transparent global sourcing map.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
