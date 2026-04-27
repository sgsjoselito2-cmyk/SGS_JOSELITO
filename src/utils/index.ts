export const calcDuration = (startStr: string, endStr: string): number => {
  if (!startStr || !endStr) return 0;
  
  const [h1, m1] = startStr.split(':').map(Number);
  const [h2, m2] = endStr.split(':').map(Number);
  
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  
  let totalMin1 = h1 * 60 + m1;
  let totalMin2 = h2 * 60 + m2;
  
  // Handle midnight wrap
  if (totalMin2 < totalMin1) {
    totalMin2 += 24 * 60;
  }
  
  return totalMin2 - totalMin1;
};

export const cleanText = (text: string): string => {
  if (!text) return '';
  return text.trim().toUpperCase();
};

export const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return '';
  // Basic normalization, assuming YYYY-MM-DD or ISO
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toISOString().split('T')[0];
  } catch (e) {
    return dateStr;
  }
};

export const sanitizeData = (data: any) => {
  // Add sanity checks here if needed
  return data;
};
