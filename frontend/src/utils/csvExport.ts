export const serializeCsv = (rows: (string | number | null | undefined)[][]) => rows.map((row) => row.map((value) => {
  let text = value == null ? 'Unavailable' : String(value);
  // Spreadsheet programs may execute string cells as formulas even when quoted.
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}).join(',')).join('\r\n');

export const downloadFile = (filename: string, content: string, mimeType: string) => {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const downloadCsv = (filename: string, rows: (string | number | null | undefined)[][]) =>
  downloadFile(filename, '\uFEFF' + serializeCsv(rows), 'text/csv;charset=utf-8');
