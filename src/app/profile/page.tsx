import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProfileForm } from "@/components/modules/Profile/ProfileForm";

export default function ProfilePage() {
  return (
    <DashboardLayout>
      <div className="flex-1 bg-gray-900 p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">Profile Settings</h1>
          <ProfileForm />
        </div>
      </div>
    </DashboardLayout>
  );
}
