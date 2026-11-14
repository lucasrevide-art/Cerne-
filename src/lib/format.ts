/** "2026-06-10" → "10/06" */
export const shortDate = (iso: string): string => iso.slice(5).split("-").reverse().join("/");
