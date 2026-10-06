import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** Toasts keep clear of the notch / home indicator once the page uses viewport-fit=cover. */
const SAFE_OFFSET = {
  top: "max(16px, env(safe-area-inset-top))",
  right: "max(16px, env(safe-area-inset-right))",
  bottom: "max(16px, env(safe-area-inset-bottom))",
  left: "max(16px, env(safe-area-inset-left))",
};

const SAFE_MOBILE_OFFSET = {
  top: "max(12px, env(safe-area-inset-top))",
  right: "max(12px, env(safe-area-inset-right))",
  bottom: "max(12px, env(safe-area-inset-bottom))",
  left: "max(12px, env(safe-area-inset-left))",
};

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // "system" follows prefers-color-scheme and its live changes; the page colours come from tokens below.
      theme="system"
      className="toaster group"
      offset={SAFE_OFFSET}
      mobileOffset={SAFE_MOBILE_OFFSET}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
