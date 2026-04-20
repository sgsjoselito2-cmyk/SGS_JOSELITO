export const calcDuration = (start: string, end: string): number => {
  if (!start || !end) return 0;
  try {
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    const d1 = new Date(); d1.setHours(h1, m1, 0, 0);
    const d2 = new Date(); d2.setHours(h2, m2, 0, 0);
    let diff = (d2.getTime() - d1.getTime()) / 60000;
    if (diff < 0) diff += 1440; 
    return Math.max(0.1, Number(diff.toFixed(1)));
  } catch (e) { return 0.1; }
};

export const cleanText = (str: any): any => {
  if (typeof str !== 'string' || !str) return str;
  if (str.indexOf('Ma') === -1 && str.indexOf('Ã') === -1 && str.indexOf('\uFFFD') === -1) return str;
  return str
    .replace(/Ma\.ana|Maana|MaÃ±ana/gi, 'Mañana')
    .replace(/\uFFFD|Ã±/g, 'ñ');
};

export const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const today = new Date().toISOString().split('T')[0];
  let formattedDate = dateStr.trim();
  
  const parseDatePart = (p: string) => parseInt(p, 10);
  const separator = formattedDate.includes('/') ? '/' : (formattedDate.includes('-') ? '-' : null);
  
  if (!separator) return formattedDate || today;

  const parts = formattedDate.split(separator);
  if (parts.length !== 3) return formattedDate || today;

  if (parts[0].length === 4) {
    // yyyy/dd/mm o yyyy/mm/dd
    const year = parts[0];
    const p1 = parseDatePart(parts[1]);
    const p2 = parseDatePart(parts[2]);
    if (p1 > 12) { // yyyy/dd/mm -> yyyy-mm-dd
      return `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    } else { // yyyy/mm/dd -> yyyy-mm-dd
      return `${year}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
    }
  } else if (parts[2].length === 4) {
    // dd/mm/yyyy o mm/dd/yyyy
    const p1 = parseDatePart(parts[0]);
    const p2 = parseDatePart(parts[1]);
    const year = parts[2];
    if (p1 > 12) { // dd/mm/yyyy -> yyyy-mm-dd
      return `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    } else { // mm/dd/yyyy -> yyyy-mm-dd
      return `${year}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
    }
  }
  
  return formattedDate || today;
};
