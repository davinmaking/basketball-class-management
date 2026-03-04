/**
 * Normalize a phone number by stripping non-digits.
 * Returns null if the input is empty/null.
 */
export function normalizePhone(
  phone: string | null | undefined
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) return null;
  return digits;
}

/**
 * Format a Malaysian phone number for WhatsApp API.
 * Converts 01x... to 601x..., keeps 60... as-is.
 */
export function formatPhoneForWhatsApp(
  phone: string | null | undefined
): string | null {
  const digits = normalizePhone(phone);
  if (!digits) return null;
  if (digits.startsWith("0")) {
    return "6" + digits; // 012... -> 6012...
  }
  if (digits.startsWith("60")) {
    return digits; // Already international format
  }
  // Unknown format, return as-is
  return digits;
}
