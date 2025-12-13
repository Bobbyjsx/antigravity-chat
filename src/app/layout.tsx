import { AuthProvider } from "@/providers/AuthProvider";
import { ReactQueryProvider } from "@/providers/ReactQueryProvider";
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ['latin'] })


export const metadata = {
  title: 'Antigravity Chat',
  description: 'Antigravity Chat is a...',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div id="root" className="w-full">
          <ReactQueryProvider>
            <AuthProvider>
              <Toaster position="bottom-right"/>
              {children}
            </AuthProvider>
          </ReactQueryProvider>
        </div>
      </body>
    </html>
  )
}