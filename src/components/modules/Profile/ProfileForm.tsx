"use client";

import { useState } from "react";
import { useViewer } from "@/api/users";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@components/ui/avatar";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

export function ProfileForm() {
  const { data: user } = useViewer();
  const [name, setName] = useState(user?.name || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const supabase = createClient();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      // Update user profile
      const { error: updateError } = await supabase
        .from("users")
        .update({ image: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["viewer"] });
      toast.success("Profile picture updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ name })
        .eq("id", user.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["viewer"] });
      toast.success("Profile updated!");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return <div className="text-white">Loading...</div>;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-6">
      {/* Profile Picture */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Avatar className="w-32 h-32">
            <AvatarImage src={user.image} />
            <AvatarFallback className="bg-blue-600 text-white text-3xl">
              {user.name?.[0] || user.email[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <label
            htmlFor="avatar-upload"
            className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors"
          >
            <Camera className="w-5 h-5 text-white" />
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={uploading}
            />
          </label>
        </div>
        {uploading && <p className="text-sm text-gray-400">Uploading...</p>}
      </div>

      {/* Name */}
      <div>
        <Input
          label="Display Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-gray-700 border-gray-600 text-white"
        />
      </div>

      {/* Email (read-only) */}
      <div>
        <Input
          label="Email"
          value={user.email}
          disabled
          className="bg-gray-700 border-gray-600 text-gray-400"
        />
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        isLoading={saving}
        className="w-full bg-blue-600 hover:bg-blue-700"
      >
        Save Changes
      </Button>
    </div>
  );
}
