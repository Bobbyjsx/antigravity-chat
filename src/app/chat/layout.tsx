import { DashboardLayout } from "@/components/layout/DashboardLayout"

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div id="chat-layout">
        <DashboardLayout>
          {children}
        </DashboardLayout>
    </div>
  )
}