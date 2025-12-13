

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div id="auth-root">
            {children}
        </div>
      </body>
    </html>
  )
}