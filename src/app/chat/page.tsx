import { Sidebar } from "@/components/modules/Chat/Sidebar";
import { MessageSquare } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

const Page = () => {

  return (
   <div className="w-full h-full flex flex-col">
     <div className="hidden sm:flex flex-1 flex-col h-full min-h-[100dvh] bg-gray-900 justify-center items-center">
        <Empty className="border-none bg-transparent">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="mx-auto">
              <MessageSquare className="h-6 w-6" />
            </EmptyMedia>
            <EmptyTitle>Select a chat</EmptyTitle>
            <EmptyDescription>
              Choose a conversation from the sidebar to start messaging
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
    </div>

     <div className="w-full h-full sm:hidden">
        <Sidebar />
    </div>
   </div>
  );
};

export default Page;