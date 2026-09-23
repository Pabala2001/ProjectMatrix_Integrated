/**
 * Centralized timezone-aware date and time utilities for ProjectMatrix
 */

/**
 * Returns the current date in YYYY-MM-DD format for a given IANA timezone,
 * avoiding the standard UTC/workstation timezone shifts.
 */
export function getTodayInTimezone(timezone: string): string {
  try {
    const d = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(d);
    const year = parts.find(p => p.type === "year")?.value || "";
    const month = parts.find(p => p.type === "month")?.value || "";
    const day = parts.find(p => p.type === "day")?.value || "";
    return `${year}-${month}-${day}`;
  } catch (err) {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
}

/**
 * Formats a date-only YYYY-MM-DD string into a localized display format
 * without shifting the calendar day based on timezone.
 */
export function formatDateOnly(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    // Normalize format to YYYY-MM-DD
    const cleanStr = dateStr.split("T")[0];
    const parts = cleanStr.split("-");
    if (parts.length < 3) return dateStr;
    
    const year = parts[0];
    const monthNames = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${monthNames[monthIdx]} ${year}`;
    }
    return dateStr;
  } catch (err) {
    return dateStr;
  }
}

/**
 * Formats a UTC timestamp into a user-friendly local date and time string
 * adjusted for the selected timezone.
 */
export function formatDateTimeInTimezone(
  dateInput: string | Date | null | undefined,
  timezone: string,
  includeTime = true
): string {
  if (!dateInput) return "";
  try {
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return "";

    if (!includeTime) {
      const options: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: timezone,
      };
      return new Intl.DateTimeFormat("en-GB", options).format(date);
    }

    const options: Intl.DateTimeFormatOptions = {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    };

    let formatted = new Intl.DateTimeFormat("en-GB", options).format(date);
    // Ensure uppercase AM/PM
    formatted = formatted.replace(/\s*([aApP][mM])\b/, (match, p1) => ` ${p1.toUpperCase()}`);

    // Get time zone abbreviation if possible
    let tzAbbr = "";
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        timeZoneName: "short"
      }).formatToParts(date);
      tzAbbr = parts.find(p => p.type === "timeZoneName")?.value || "";
    } catch (e) {
      // ignore
    }

    const suffix = tzAbbr ? ` ${tzAbbr}` : ` — ${timezone}`;
    return `${formatted}${suffix}`;
  } catch (err) {
    return String(dateInput);
  }
}
