import { useRef, useState, type ChangeEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiClient } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  userId?: number | null;
  userName?: string | null;
  userEmail?: string | null;
  hasProfilePicture?: boolean;
  onUploaded?: () => void | Promise<void>;
  avatarClassName?: string;
  fallbackClassName?: string;
  imageClassName?: string;
  overlayRoundedClassName?: string;
};

export default function ClickableProfileAvatar({
  userId,
  userName,
  userEmail,
  hasProfilePicture,
  onUploaded,
  avatarClassName,
  fallbackClassName,
  imageClassName,
  overlayRoundedClassName = "rounded-2xl",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cacheBust, setCacheBust] = useState(0);

  const initial = (userName || userEmail || "U").charAt(0).toUpperCase();
  const imageSrc =
    hasProfilePicture && userId != null
      ? `${apiClient.getProfilePictureUrl(userId)}?v=${cacheBust}`
      : undefined;

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      event.target.value = "";
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error("Image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const response = await apiClient.uploadProfileAvatar(file);
      if (response.error) {
        throw new Error(response.error);
      }
      setCacheBust((n) => n + 1);
      await onUploaded?.();
      toast.success("Profile photo updated");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload photo";
      toast.error(message);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
        disabled={uploading}
        aria-hidden
      />
      <button
        type="button"
        className="group relative shrink-0 cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Change profile photo"
        aria-label="Change profile photo"
      >
        <Avatar className={avatarClassName}>
          <AvatarImage
            src={imageSrc}
            alt={userName || "Profile"}
            className={cn("object-cover", imageClassName)}
          />
          <AvatarFallback className={fallbackClassName}>{initial}</AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100",
            uploading && "opacity-100",
            overlayRoundedClassName,
          )}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          ) : (
            <>
              <Camera className="h-5 w-5 text-white sm:h-6 sm:w-6" />
              <span className="text-[10px] font-medium text-white/90 sm:text-xs">Change</span>
            </>
          )}
        </div>
      </button>
    </>
  );
}
