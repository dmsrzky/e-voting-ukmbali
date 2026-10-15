// Harus identik dengan kolom nama_norm di database
export const cleanNama = (s: string) => s.trim().replace(/\s+/g, " ");
export const normNama = (s: string) => cleanNama(s).toLowerCase();
export const cleanNim = (s: string) => s.replace(/\D/g, "");
