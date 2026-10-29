import DeviceDetector from "device-detector-js";

const detector = new DeviceDetector();
const mobileDeviceTypes = new Set([
  "smartphone",
  "tablet",
  "phablet",
  "feature phone",
]);

export type DeviceCategory = "mobile" | "desktop" | "other";

export function getDeviceCategory(userAgent: string): DeviceCategory {
  const deviceType = detector.parse(userAgent).device?.type;
  if (deviceType === "desktop") return "desktop";
  if (deviceType !== undefined && mobileDeviceTypes.has(deviceType)) {
    return "mobile";
  }
  return "other";
}

export function isMobileDevice(userAgent: string): boolean {
  return getDeviceCategory(userAgent) === "mobile";
}
