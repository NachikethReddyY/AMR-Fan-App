/** Original synthetic PDF fixtures. No copied report content or external fonts. */
export function syntheticPdf(
  pages: readonly (readonly string[])[],
  {
    fontSize = 12,
    lineStep = 22,
  }: { fontSize?: number; lineStep?: number } = {},
): Buffer {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 5 + i * 2);
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  );
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding /ToUnicode 4 0 R >>',
  );
  const cmap =
    '/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Synthetic) /Ordering (Unicode) /Supplement 0 >> def /CMapName /Synthetic def /CMapType 2 def 1 begincodespacerange <00> <FF> endcodespacerange 3 beginbfchar <80> <6C34> <81> <00E9> <82> <2082> endbfchar endcmap CMapName currentdict /CMap defineresource pop end end';
  objects.push(
    `<< /Length ${Buffer.byteLength(cmap)} >>\nstream\n${cmap}\nendstream`,
  );
  for (let i = 0; i < pages.length; i++) {
    const contentId = 6 + i * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    const lines = (pages[i] ?? []).map((line) => {
      const bytes = Array.from(line, (char) =>
        char === '水'
          ? 128
          : char === 'é'
            ? 129
            : char === '₂'
              ? 130
              : char.charCodeAt(0),
      );
      return `<${Buffer.from(bytes).toString('hex')}> Tj 0 -${lineStep} Td`;
    });
    const content = `BT /F1 ${fontSize} Tf 40 740 Td ${lines.join('\n')} ET`;
    objects.push(
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  }
  let pdf = '%PDF-1.7\n';
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
