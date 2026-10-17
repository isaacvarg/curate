import type { ReactNode } from "react";
import { product } from "@repo/shared";

export const metadata = { title: product.name };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
