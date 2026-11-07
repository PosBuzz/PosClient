export type LabelLayout = {
  labelWidth: number;
  labelHeight: number;
  paper: "roll" | "sheet";
  paperWidth: number;
  paperHeight: number;
  columns: number;
  marginX: number;
  marginY: number;
  gapX: number;
  gapY: number;
  padding: number;
  fontSize: number;
  barcodeHeight: number;
  quantity: number;
  skip: number;
  align: "left" | "center" | "right";
  bold: boolean;
  fontFamily: "sans" | "serif" | "mono";
};
export const defaultLayout: LabelLayout = {
  labelWidth: 50,
  labelHeight: 30,
  paper: "roll",
  paperWidth: 210,
  paperHeight: 297,
  columns: 1,
  marginX: 0,
  marginY: 0,
  gapX: 0,
  gapY: 0,
  padding: 1,
  fontSize: 8,
  barcodeHeight: 10,
  quantity: 1,
  skip: 0,
  align: "center",
  bold: false,
  fontFamily: "sans",
};
export function labelGeometry(c: LabelLayout) {
  const numbers = Object.entries(c).filter(
    ([, value]) => typeof value === "number",
  );
  if (numbers.some(([, value]) => !Number.isFinite(value))) {
    throw new Error("Enter valid dimensions and quantities.");
  }
  if (
    c.labelWidth < 10 ||
    c.labelHeight < 10 ||
    c.labelWidth > 300 ||
    c.labelHeight > 500
  ) {
    throw new Error(
      "Label dimensions must be between 10–300 mm wide and 10–500 mm high.",
    );
  }
  if (
    c.quantity < 1 ||
    c.quantity > 1000 ||
    !Number.isInteger(c.quantity) ||
    c.columns < 1 ||
    c.columns > 20 ||
    !Number.isInteger(c.columns) ||
    c.skip < 0 ||
    !Number.isInteger(c.skip)
  ) {
    throw new Error(
      "Use 1–1000 copies, 1–20 columns and a whole number of skipped labels.",
    );
  }
  if (
    [c.marginX, c.marginY, c.gapX, c.gapY, c.padding].some((v) => v < 0) ||
    c.fontSize < 4 ||
    c.fontSize > 24 ||
    c.barcodeHeight < 4 ||
    c.padding * 2 >= Math.min(c.labelWidth, c.labelHeight) ||
    c.barcodeHeight + c.padding * 2 > c.labelHeight
  ) {
    throw new Error(
      "The padding and barcode must fit inside the label. Use a font size of 4–24 pt.",
    );
  }
  const width =
    c.paper === "roll"
      ? c.labelWidth * c.columns + c.gapX * (c.columns - 1) + 2 * c.marginX
      : c.paperWidth;
  const height =
    c.paper === "roll" ? c.labelHeight + 2 * c.marginY : c.paperHeight;
  if (width > 1000 || height > 1000 || width < 10 || height < 10) {
    throw new Error("Paper dimensions must be between 10 and 1000 mm.");
  }
  const rows =
    c.paper === "roll"
      ? 1
      : Math.floor(
          (height - 2 * c.marginY + c.gapY) / (c.labelHeight + c.gapY),
        );
  if (
    rows < 1 ||
    c.columns * c.labelWidth + (c.columns - 1) * c.gapX + 2 * c.marginX >
      width + 0.001
  ) {
    throw new Error("The labels, gaps and margins do not fit on this paper.");
  }
  const capacity = rows * c.columns;
  if (c.skip >= capacity) {
    throw new Error(
      "Skipped labels must be fewer than the labels on the first page.",
    );
  }
  return {
    width,
    height,
    rows,
    capacity,
    pages: Math.ceil((c.quantity + c.skip) / capacity),
  };
}
export const fontStacks: Record<LabelLayout["fontFamily"], string> = {
  sans: "Arial,Helvetica,sans-serif",
  serif: "'Times New Roman',Times,serif",
  mono: "'Courier New',Courier,monospace",
};
export function labelStyles(c: LabelLayout) {
  const weight = c.bold ? "700" : "400";
  const stack = fontStacks[c.fontFamily] ?? fontStacks.sans;
  return `.barcode-label{box-sizing:border-box;width:${c.labelWidth}mm;height:${c.labelHeight}mm;padding:${c.padding}mm;display:flex;flex-direction:column;justify-content:center;gap:0.3mm;text-align:${c.align};font:${weight} ${c.fontSize}pt/1.15 ${stack};color:#000;background:#fff;overflow:hidden;flex-shrink:0}.barcode-label .label-line{overflow-wrap:anywhere;flex-shrink:0}.barcode-symbol{height:${c.barcodeHeight}mm;width:100%;flex-shrink:0}.barcode-symbol svg{display:block;width:100%;height:100%}.barcode-value{font-size:0.9em;letter-spacing:0.2pt}`;
}
export function barcodeIsValid(value: string, format: string): boolean {
  if (format === "CODE128") return /^[\x20-\x7e]{1,120}$/.test(value);
  if (format === "CODE39") return /^[A-Z0-9 .\-$/+%]{1,80}$/.test(value);
  const lengths: Record<string, number> = { EAN13: 13, EAN8: 8, UPC: 12 };
  const length = lengths[format];
  if (
    !length ||
    !/^\d+$/.test(value) ||
    ![length - 1, length].includes(value.length)
  ) {
    return false;
  }
  if (value.length === length - 1) return true;
  const digits = value.slice(0, -1).split("").reverse();
  const sum = digits.reduce(
    (s, d, i) => s + Number(d) * (i % 2 === 0 ? 3 : 1),
    0,
  );
  return (10 - (sum % 10)) % 10 === Number(value[value.length - 1]);
}
export function barcodeDisplayValue(value: string, format: string): string {
  const lengths: Record<string, number> = { EAN13: 13, EAN8: 8, UPC: 12 };
  if (barcodeIsValid(value, format) && value.length === lengths[format] - 1) {
    const sum = value
      .split("")
      .reverse()
      .reduce(
        (total, digit, i) => total + Number(digit) * (i % 2 === 0 ? 3 : 1),
        0,
      );
    return value + ((10 - (sum % 10)) % 10);
  }
  return value;
}
export function labelPrintDocument(c: LabelLayout, labelHtml: string) {
  const g = labelGeometry(c);
  const pages = Array.from({ length: g.pages }, (_, page) => {
    const cells = Array.from(
      { length: Math.min(g.capacity, c.quantity + c.skip - page * g.capacity) },
      (_, slot) =>
        page * g.capacity + slot < c.skip ? "<div></div>" : labelHtml,
    ).join("");
    return `<section class="label-page">${cells}</section>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Barcode labels</title><style>
  @page{size:${g.width}mm ${g.height}mm;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:white;color:black}
  ${labelStyles(c)}
  .label-page{width:${g.width}mm;height:${g.height}mm;padding:${c.marginY}mm ${c.marginX}mm;display:grid;grid-template-columns:repeat(${c.columns},${c.labelWidth}mm);grid-auto-rows:${c.labelHeight}mm;column-gap:${c.gapX}mm;row-gap:${c.gapY}mm;align-content:start;break-after:page;overflow:hidden}.label-page:last-child{break-after:auto}
  @media screen{body{background:#eee;padding:8px;width:max-content}.label-page{background:white;margin-bottom:12px;box-shadow:0 1px 5px #bbb}.barcode-label{outline:1px dotted #ddd}}
  </style></head><body>${pages}</body></html>`;
}
export function printLabelDocument(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.title = "Barcode print document";
    frame.style.cssText =
      "position:fixed;width:1px;height:1px;left:-10000px;border:0";
    frame.onload = async () => {
      try {
        const win = frame.contentWindow;
        if (!win) throw new Error("Unable to open the print document.");
        await win.document.fonts?.ready;
        win.addEventListener("afterprint", () => frame.remove(), {
          once: true,
        });
        win.focus();
        win.print();
        resolve();
      } catch (error) {
        frame.remove();
        reject(error);
      }
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}
