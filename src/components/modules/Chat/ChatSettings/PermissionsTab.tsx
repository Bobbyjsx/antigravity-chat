import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { useUpdateConversationSettings } from "@/api/conversations";
import { toast } from "react-hot-toast";
import { getServerError } from "@/lib/https";

interface PermissionsTabProps {
  conversationId: string;
  settings: {
    only_admins_can_rename?: boolean;
    only_admins_can_add_members?: boolean;
    only_admins_can_change_image?: boolean;
  };
  isAdmin: boolean;
}

type PermissionKey = keyof PermissionsTabProps["settings"];

interface PermissionRowProps {
  label: string;
  description: string;
  settingKey: PermissionKey;
  value?: boolean;
  disabled?: boolean;
  onToggle?: (key: PermissionKey, value: boolean) => void;
}

function PermissionRow({
  label,
  description,
  settingKey,
  value,
  disabled,
  onToggle
}: PermissionRowProps) {
  const isEnabled = !!value;

  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-3 transition-all duration-200 bg-primary/10 border-primary/20 cursor-pointer ${disabled ? "opacity-60 pointer-events-none" : ""}`}
      onClick={() => onToggle?.(settingKey, !isEnabled)}
    >
      <div className="space-y-0.5">
        <p
          className={`text-sm font-medium transition-colors text-gray-200`}
        >
          {label}
        </p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>

      <Toggle
        size="sm"
        pressed={isEnabled}
        onPressedChange={(pressed) =>
          onToggle?.(settingKey, pressed)
        }
        disabled={disabled}
        aria-label={`Toggle ${label}`}
      >
        {isEnabled ? (
          <Badge className="bg-red-500/20">Disable</Badge>
        ) : (
          <Badge className="!rounded-sm- bg-green-500/20" >Enable</Badge>
        )}
      </Toggle>
    </div>
  );
}

export function PermissionsTab({
  conversationId,
  settings,
  isAdmin
}: PermissionsTabProps) {
  const { mutateAsync: updateSettings, isPending: isUpdating } = useUpdateConversationSettings();

  const handleUpdate = async (key: string, value: boolean) => {
    try {
      await updateSettings({ 
        conversationId, 
        settings: { [key]: value } 
      });
      toast.success("Settings updated");
    } catch (err: any) {
      toast.error(getServerError(err));
    }
  };

  const permissions: Array<Omit<PermissionRowProps, "onToggle">> = [
    {
      label: "Rename Group",
      description: "Only admins can change the group name",
      settingKey: "only_admins_can_rename",
      value: settings.only_admins_can_rename
    },
    {
      label: "Add Members",
      description: "Only admins can add new members",
      settingKey: "only_admins_can_add_members",
      value: settings.only_admins_can_add_members
    },
    {
      label: "Change Image",
      description: "Only admins can update the group image",
      settingKey: "only_admins_can_change_image",
      value: settings.only_admins_can_change_image
    }
  ];

  if (!isAdmin) {
    return (
      <div className="mt-4 rounded-xl border border-gray-700/30 bg-gray-800/40 p-4">
        <p className="mb-4 text-center text-sm text-gray-400">
          Only admins can change group permissions.
        </p>

        <div className="space-y-3">
          {permissions.map((permission, index) => (
            <Fragment key={permission.settingKey}>
              <PermissionRow
                {...permission}
                disabled
              />
              {index < permissions.length - 1 && <Separator />}
            </Fragment>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6">
      <div className="space-y-3">
        {permissions.map((permission, index) => (
          <Fragment key={permission.settingKey}>
            <PermissionRow
              {...permission}
              disabled={isUpdating}
              onToggle={handleUpdate}
            />
            {index < permissions.length - 1 && <Separator className="bg-gray-700/50"/>}
          </Fragment>
        ))}
      </div>

      {isUpdating && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating settings…
        </div>
      )}
    </div>
  );
}
