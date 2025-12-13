import { ChatWindow } from "@/components/modules/Chat/ChatWindow";

type Props = {
  params: Promise<{ chatId: string }>;
};

export default async function ChatPage({ params }: Props) {
  const { chatId } = await params;

  return (
      <ChatWindow conversationId={chatId} />
  );
}
