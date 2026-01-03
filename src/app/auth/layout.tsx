

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div id="auth-root">
      {children}
    </div>
  )
}