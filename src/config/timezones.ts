export interface TimezoneOption {
  value: string;
  label: string;
  offsetLabel: string;
}

// Curated list of high-priority timezones requested by the user
export const CURATED_TIMEZONES = [
  { value: "Africa/Johannesburg", label: "Johannesburg, South Africa" },
  { value: "Africa/Dar_es_Salaam", label: "Dar es Salaam, Tanzania" },
  { value: "Africa/Nairobi", label: "Nairobi, Kenya" },
  { value: "Africa/Maseru", label: "Maseru, Lesotho" },
  { value: "Africa/Lusaka", label: "Lusaka, Zambia" },
  { value: "Africa/Harare", label: "Harare, Zimbabwe" },
  { value: "Africa/Gaborone", label: "Gaborone, Botswana" },
  { value: "Africa/Maputo", label: "Maputo, Mozambique" },
  { value: "Africa/Windhoek", label: "Windhoek, Namibia" },
  { value: "Africa/Kampala", label: "Kampala, Uganda" },
  { value: "Africa/Kigali", label: "Kigali, Rwanda" },
  { value: "Africa/Bujumbura", label: "Bujumbura, Burundi" },
  { value: "Africa/Addis_Ababa", label: "Addis Ababa, Ethiopia" },
  { value: "Africa/Mogadishu", label: "Mogadishu, Somalia" },
  { value: "Africa/Khartoum", label: "Khartoum, Sudan" },
  { value: "Africa/Juba", label: "Juba, South Sudan" },
  { value: "Africa/Lilongwe", label: "Lilongwe, Malawi" },
  { value: "Africa/Lubumbashi", label: "Lubumbashi, DR Congo" },
  { value: "Africa/Kinshasa", label: "Kinshasa, DR Congo" },
  { value: "Africa/Luanda", label: "Luanda, Angola" },
  { value: "Africa/Blantyre", label: "Blantyre, Malawi" },
  
  // Other important global zones
  { value: "Europe/London", label: "London, United Kingdom" },
  { value: "Europe/Paris", label: "Paris, France" },
  { value: "Europe/Berlin", label: "Berlin, Germany" },
  { value: "America/New_York", label: "New York, United States" },
  { value: "America/Chicago", label: "Chicago, United States" },
  { value: "America/Los_Angeles", label: "Los Angeles, United States" },
  { value: "America/Sao_Paulo", label: "São Paulo, Brazil" },
  { value: "Asia/Tokyo", label: "Tokyo, Japan" },
  { value: "Asia/Shanghai", label: "Shanghai, China" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Dubai", label: "Dubai, UAE" },
  { value: "Australia/Sydney", label: "Sydney, Australia" },
  { value: "Australia/Melbourne", label: "Melbourne, Australia" },
  { value: "Pacific/Auckland", label: "Auckland, New Zealand" }
];

/**
 * Gets a formatted GMT offset string dynamically (e.g., "UTC+02:00") for a timezone.
 */
export function getTimezoneOffsetLabel(timeZone: string): string {
  try {
    const date = new Date();
    // Use Intl to format and extract the time parts in target timezone
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset"
    }).formatToParts(date);
    
    const tzPart = parts.find(p => p.type === "timeZoneName");
    if (tzPart) {
      // Typically returns "GMT+2" or "GMT-05:00"
      const val = tzPart.value;
      const cleanVal = val.replace("GMT", "UTC");
      if (cleanVal === "UTC") return "UTC+00:00";
      
      // If it's UTC+2, let's normalize to UTC+02:00
      const match = cleanVal.match(/UTC([+-])(\d+)(?::(\d+))?/);
      if (match) {
        const sign = match[1];
        const hrs = match[2].padStart(2, "0");
        const mins = (match[3] || "00").padStart(2, "0");
        return `UTC${sign}${hrs}:${mins}`;
      }
      return cleanVal;
    }
    return "UTC+00:00";
  } catch (err) {
    return "UTC+00:00";
  }
}

/**
 * Resolves all supported IANA timezones on the browser,
 * enriched with dynamic offset labels and human-friendly descriptions.
 */
export function getAllTimezones(): TimezoneOption[] {
  let list: string[] = [];
  try {
    if (typeof Intl !== "undefined" && (Intl as any).supportedValuesOf) {
      list = (Intl as any).supportedValuesOf("timeZone");
    }
  } catch (e) {
    // fallback if not supported
  }

  // Combine curated and all IANA lists to ensure comprehensive options
  const ianaSet = new Set(list);
  const result: TimezoneOption[] = [];

  // Add all curated list first with pretty labels
  const added = new Set<string>();
  for (const item of CURATED_TIMEZONES) {
    const offset = getTimezoneOffsetLabel(item.value);
    result.push({
      value: item.value,
      label: `${item.label} — ${item.value} (${offset})`,
      offsetLabel: offset
    });
    added.add(item.value);
  }

  // Add the remaining IANA timezones
  for (const zone of list) {
    if (!added.has(zone)) {
      const offset = getTimezoneOffsetLabel(zone);
      // Clean up label: replace underscore with space and folder names
      const parts = zone.split("/");
      const city = parts[parts.length - 1].replace(/_/g, " ");
      const region = parts[0];
      const prettyLabel = parts.length > 1 ? `${city}, ${region}` : city;
      
      result.push({
        value: zone,
        label: `${prettyLabel} — ${zone} (${offset})`,
        offsetLabel: offset
      });
    }
  }

  return result;
}
