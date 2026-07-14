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

export const normalizeFormato = (formato: string | undefined | null): string => {
  if (!formato) return '';
  return formato
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();
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

export const calculateUniqueMinutes = (intervals: { start: string, end: string }[]): number => {
  if (intervals.length === 0) return 0;

  // Convert to minutes
  const segments = intervals.map(interval => {
    const [h1, m1] = (interval.start || '00:00').split(':').map(Number);
    const [h2, m2] = (interval.end || '00:00').split(':').map(Number);
    let startMin = (h1 || 0) * 60 + (m1 || 0);
    let endMin = (h2 || 0) * 60 + (m2 || 0);
    if (endMin < startMin) endMin += 24 * 60;
    return { start: startMin, end: endMin };
  });

  // Sort by start
  segments.sort((a, b) => a.start - b.start);

  // Merge overlaps
  const merged: { start: number, end: number }[] = [];
  if (segments.length > 0) {
    let current = { ...segments[0] };
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].start <= current.end) {
        current.end = Math.max(current.end, segments[i].end);
      } else {
        merged.push(current);
        current = { ...segments[i] };
      }
    }
    merged.push(current);
  }

  return merged.reduce((sum, seg) => sum + (seg.end - seg.start), 0);
};

export const subtractIntervals = (base: { start: number, end: number }[], toExclude: { start: number, end: number }[]): { start: number, end: number }[] => {
  let result = [...base];
  
  toExclude.forEach(ex => {
    const nextResult: { start: number, end: number }[] = [];
    result.forEach(b => {
      // No overlap
      if (ex.end <= b.start || ex.start >= b.end) {
        nextResult.push(b);
      } else {
        // Left part remains
        if (ex.start > b.start) {
          nextResult.push({ start: b.start, end: ex.start });
        }
        // Right part remains
        if (ex.end < b.end) {
          nextResult.push({ start: ex.end, end: b.end });
        }
      }
    });
    result = nextResult;
  });
  
  return result;
};

export const getIntervalsInMinutes = (intervals: { start: string, end: string }[]): { start: number, end: number }[] => {
  return intervals.map(interval => {
    const [h1, m1] = (interval.start || '00:00').split(':').map(Number);
    const [h2, m2] = (interval.end || '00:00').split(':').map(Number);
    let startMin = (h1 || 0) * 60 + (m1 || 0);
    let endMin = (h2 || 0) * 60 + (m2 || 0);
    if (endMin < startMin) endMin += 24 * 60;
    return { start: startMin, end: endMin };
  }).sort((a, b) => a.start - b.start);
};

export const mergeIntervals = (segments: { start: number, end: number }[]): { start: number, end: number }[] => {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: { start: number, end: number }[] = [];
  let current = { ...sorted[0] };
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].start <= current.end) {
      current.end = Math.max(current.end, sorted[i].end);
    } else {
      merged.push(current);
      current = { ...sorted[i] };
    }
  }
  merged.push(current);
  return merged;
};
