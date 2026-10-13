import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";
import ThemeProvider from "@/components/ThemeProvider";

import { Suspense } from "react";

import AppLayoutWrapper from "@/components/AppLayoutWrapper";

export const metadata: Metadata = {
  title: "Breiner | Gestión Textil SaaS",
  description: "Plataforma premium para la gestión de producción textil, cortes e inventarios.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39+Text&family=Libre+Barcode+128+Text&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider />
          <AuthGuard>
            <AppLayoutWrapper
              sidebar={
                <Suspense fallback={null}>
                  <Sidebar />
                </Suspense>
              }
              navbar={
                <Suspense fallback={null}>
                  <Navbar />
                </Suspense>
              }
            >
              {children}
            </AppLayoutWrapper>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
