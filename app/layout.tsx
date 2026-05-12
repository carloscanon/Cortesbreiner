import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/hooks/useAuth";
import AuthGuard from "@/components/AuthGuard";

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
      <body>
        <AuthProvider>
          <AuthGuard>
            <div className="app-container">
              <Sidebar />
              <main className="main-content">
                <Navbar />
                {children}
              </main>
            </div>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
