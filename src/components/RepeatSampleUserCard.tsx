import { Link } from "react-router-dom";
import { ArrowLeft, CopyPlus, UserCheck } from "lucide-react";
import UserProfile from "@/components/UserProfile";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api";

export type RepeatSampleUserCardSource = {
  real_booking_id: number;
  booking_id: string | number;
  virtual_booking_id?: string | null;
  user?: number | string | null;
  user_name?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
  user_department?: string | null;
  user_profile_picture?: string | null;
  wallet_owner_name?: string | null;
};

type Props = {
  loading: boolean;
  source: RepeatSampleUserCardSource | null;
  onBack: () => void;
};

/** Who a staff-booked repeat sample is for; replaces the "Book slots for user" picker (the user cannot be changed). */
export function RepeatSampleUserCard({ loading, source, onBack }: Props) {
  const displayId = source ? String(source.virtual_booking_id || source.booking_id || source.real_booking_id) : "";
  return (
    <div className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-3" data-testid="repeat-sample-user-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <CopyPlus className="h-4 w-4 shrink-0" />
          {source ? (
            <span>
              Repeat of booking{" "}
              <Link
                to={`/booking-management?expand=${source.real_booking_id}`}
                className="text-primary underline underline-offset-2"
              >
                {displayId}
              </Link>
            </span>
          ) : (
            <span>Repeat sample</span>
          )}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to booking details
        </Button>
      </div>
      {loading || !source ? (
        <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
          {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />}
          {loading ? "Loading user details…" : "User details are not available."}
        </div>
      ) : (
        <div>
          <UserProfile
            name={source.user_name}
            email={source.user_email}
            phone={source.user_phone}
            department={source.user_department}
            profilePicture={
              source.user_profile_picture && source.user != null
                ? apiClient.getProfilePictureUrl(source.user)
                : undefined
            }
            size="md"
            nameClassName="font-semibold"
          />
          {source.wallet_owner_name && (
            <div className="flex items-center gap-1.5 text-base text-muted-foreground mt-2 ml-[3.25rem]">
              <UserCheck className="h-4 w-4 shrink-0" />
              <span>
                Supervisor Name: <span className="font-medium text-foreground">{source.wallet_owner_name}</span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
