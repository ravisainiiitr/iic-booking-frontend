import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { lazyPage } from "@/lib/lazyPage";

const EquipmentProfile = lazyPage(() => import("@/pages/EquipmentProfile"));
const PublicEquipmentPage = lazyPage(() => import("@/pages/PublicEquipmentPage"));

/**
 * /equipment/:id — the URL printed in every equipment QR code.
 * Signed-out visitors get the light, mobile-first public page (allowlisted public data only); signed-in users keep
 * the full equipment page with slots, booking and staff tools, unchanged.
 */
export default function EquipmentPageRoute() {
  const { id = "" } = useParams();
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div role="status" className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading…
      </div>
    );
  }
  return isAuthenticated ? <EquipmentProfile /> : <PublicEquipmentPage equipmentId={id} />;
}
