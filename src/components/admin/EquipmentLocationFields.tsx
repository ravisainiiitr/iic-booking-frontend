import { useMemo, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildGoogleMapsUrl,
  captureCurrentLocation,
  formatCoordinate,
  GpsCaptureError,
  parseCoordinate,
} from "@/lib/equipmentGps";

export type EquipmentLocationFieldsValue = {
  location: string;
  latitude: string;
  longitude: string;
  google_maps_url: string;
};

type Props = {
  value: EquipmentLocationFieldsValue;
  onChange: (next: Partial<EquipmentLocationFieldsValue>) => void;
  /** When false, GPS capture button is hidden (manual entry still allowed). */
  allowGpsCapture?: boolean;
};

/**
 * Laboratory address + GPS coordinates + Google Maps URL with optional
 * "Use Current Location" capture via the HTML5 Geolocation API.
 */
export function EquipmentLocationFields({
  value,
  onChange,
  allowGpsCapture = true,
}: Props) {
  const [capturing, setCapturing] = useState(false);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const latNum = parseCoordinate(value.latitude);
  const lngNum = parseCoordinate(value.longitude);
  const previewUrl = useMemo(() => {
    if (latNum == null || lngNum == null) return null;
    return buildGoogleMapsUrl(latNum, lngNum);
  }, [latNum, lngNum]);

  const embedUrl = useMemo(() => {
    if (latNum == null || lngNum == null) return null;
    return `https://maps.google.com/maps?q=${latNum},${lngNum}&z=17&output=embed`;
  }, [latNum, lngNum]);

  const syncMapsUrlFromCoords = (latRaw: string, lngRaw: string) => {
    const lat = parseCoordinate(latRaw);
    const lng = parseCoordinate(lngRaw);
    if (lat == null || lng == null) return;
    onChange({
      latitude: latRaw,
      longitude: lngRaw,
      google_maps_url: buildGoogleMapsUrl(lat, lng),
    });
  };

  const handleCapture = async () => {
    setCapturing(true);
    setErrorMessage(null);
    setStatusMessage(null);
    setAccuracyMeters(null);
    try {
      const result = await captureCurrentLocation({
        timeoutMs: 15000,
        enableHighAccuracy: true,
      });
      const latStr = formatCoordinate(result.latitude);
      const lngStr = formatCoordinate(result.longitude);
      onChange({
        latitude: latStr,
        longitude: lngStr,
        google_maps_url: result.mapsUrl,
      });
      setAccuracyMeters(result.accuracyMeters);
      setStatusMessage("Location captured successfully");
    } catch (err) {
      const message =
        err instanceof GpsCaptureError
          ? err.message
          : "Unable to determine your current location. Please try again or enter the location manually.";
      setErrorMessage(message);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="equipment-location">Laboratory Address</Label>
        <Input
          id="equipment-location"
          value={value.location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="Building / lab address"
        />
      </div>

      {allowGpsCapture ? (
        <div className="space-y-2">
          <Button
            type="button"
            variant="default"
            className="w-full sm:w-auto"
            onClick={() => void handleCapture()}
            disabled={capturing}
          >
            {capturing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4 mr-2" />
            )}
            {capturing ? "Capturing location…" : "Use Current Location"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Uses your device GPS (or network location) to fill latitude, longitude, and Google Maps URL.
            Requires HTTPS (or localhost) and location permission.
          </p>
        </div>
      ) : null}

      {statusMessage ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-100">
          <p className="font-medium">{statusMessage}</p>
          {latNum != null && lngNum != null ? (
            <ul className="mt-1 space-y-0.5 text-xs sm:text-sm">
              <li>
                Latitude: <span className="font-mono">{formatCoordinate(latNum)}</span>
              </li>
              <li>
                Longitude: <span className="font-mono">{formatCoordinate(lngNum)}</span>
              </li>
              {accuracyMeters != null ? (
                <li>
                  Accuracy: ±{accuracyMeters < 10 ? accuracyMeters.toFixed(1) : Math.round(accuracyMeters)} metres
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="equipment-latitude">Latitude</Label>
          <Input
            id="equipment-latitude"
            inputMode="decimal"
            placeholder="e.g. 29.864321"
            value={value.latitude}
            onChange={(e) => {
              const next = e.target.value;
              onChange({ latitude: next });
              setStatusMessage(null);
              setAccuracyMeters(null);
            }}
            onBlur={() => syncMapsUrlFromCoords(value.latitude, value.longitude)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="equipment-longitude">Longitude</Label>
          <Input
            id="equipment-longitude"
            inputMode="decimal"
            placeholder="e.g. 77.896541"
            value={value.longitude}
            onChange={(e) => {
              const next = e.target.value;
              onChange({ longitude: next });
              setStatusMessage(null);
              setAccuracyMeters(null);
            }}
            onBlur={() => syncMapsUrlFromCoords(value.latitude, value.longitude)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="equipment-google-maps-url">Google Maps URL</Label>
        <Input
          id="equipment-google-maps-url"
          type="url"
          placeholder="https://www.google.com/maps?q=..."
          value={value.google_maps_url}
          onChange={(e) => onChange({ google_maps_url: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          Auto-filled from GPS capture; you can edit this URL manually if needed.
        </p>
      </div>

      {embedUrl ? (
        <div className="space-y-2">
          <Label>Map preview</Label>
          <div className="overflow-hidden rounded-md border bg-muted/30">
            <iframe
              title="Equipment location preview"
              src={embedUrl}
              className="h-48 w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          {previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              Open in Google Maps
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
