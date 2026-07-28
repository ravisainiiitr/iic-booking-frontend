/**
 * HTML5 Geolocation helpers for capturing equipment laboratory GPS coordinates.
 */

export type CapturedGpsLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  mapsUrl: string;
};

export type GpsCaptureErrorCode =
  | "unsupported"
  | "insecure_context"
  | "permission_denied"
  | "unavailable"
  | "timeout"
  | "unknown";

export class GpsCaptureError extends Error {
  code: GpsCaptureErrorCode;

  constructor(code: GpsCaptureErrorCode, message: string) {
    super(message);
    this.name = "GpsCaptureError";
    this.code = code;
  }
}

export function buildGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

export function formatCoordinate(value: number | string | null | undefined, digits = 7): string {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(digits);
}

export function parseCoordinate(raw: string): number | null {
  const n = Number(String(raw || "").trim());
  return Number.isFinite(n) ? n : null;
}

export function isSecureGeolocationContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

export function canUseGeolocation(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.geolocation !== "undefined";
}

/**
 * Capture the device location with high accuracy.
 * Prefer a fresh reading (maximumAge: 0) and a reasonable timeout.
 */
export function captureCurrentLocation(options?: {
  timeoutMs?: number;
  enableHighAccuracy?: boolean;
}): Promise<CapturedGpsLocation> {
  if (!canUseGeolocation()) {
    throw new GpsCaptureError(
      "unsupported",
      "Your browser does not support location services.",
    );
  }
  if (!isSecureGeolocationContext()) {
    throw new GpsCaptureError(
      "insecure_context",
      "Location capture requires a secure connection (HTTPS) or localhost.",
    );
  }

  const timeoutMs = options?.timeoutMs ?? 15000;
  const enableHighAccuracy = options?.enableHighAccuracy !== false;

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        const accuracyMeters =
          typeof pos.coords.accuracy === "number" && Number.isFinite(pos.coords.accuracy)
            ? pos.coords.accuracy
            : null;
        resolve({
          latitude,
          longitude,
          accuracyMeters,
          mapsUrl: buildGoogleMapsUrl(latitude, longitude),
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(
            new GpsCaptureError(
              "permission_denied",
              "Location permission was denied. Please enable location access or enter the Google Maps URL manually.",
            ),
          );
          return;
        }
        if (err.code === err.POSITION_UNAVAILABLE) {
          reject(
            new GpsCaptureError(
              "unavailable",
              "Unable to determine your current location. Please try again or enter the location manually.",
            ),
          );
          return;
        }
        if (err.code === err.TIMEOUT) {
          reject(
            new GpsCaptureError(
              "timeout",
              "Location request timed out. Please try again outdoors or near a window, or enter the location manually.",
            ),
          );
          return;
        }
        reject(
          new GpsCaptureError(
            "unknown",
            "Unable to determine your current location. Please try again or enter the location manually.",
          ),
        );
      },
      {
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge: 0,
      },
    );
  });
}
