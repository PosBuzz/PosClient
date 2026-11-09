import { describe, expect, it } from "vitest";
import {
  barcodeIsValid,
  barcodeDisplayValue,
  defaultLayout,
  labelGeometry,
  labelPrintDocument,
} from "./label-layout";

describe("Browser barcode label layout", () => {
  it("[CO-LABEL-001] roll pages use physical label dimensions and preserve the exact copy count", () => {
    const layout = {
      ...defaultLayout,
      columns: 2,
      quantity: 5,
      gapX: 2,
      marginX: 1,
    };
    expect(labelGeometry(layout)).toMatchObject({
      width: 104,
      height: 30,
      capacity: 2,
      pages: 3,
    });
    const doc = labelPrintDocument(
      layout,
      '<div class="barcode-label">LABEL</div>',
    );
    expect(doc.match(/>LABEL</g)).toHaveLength(5);
    expect(doc.match(/<section /g)).toHaveLength(3);
    expect(doc).toContain("@page{size:104mm 30mm;margin:0}");
  });
  it("[CO-LABEL-002] sheet pagination skips already-used labels on the first page only", () => {
    const layout = {
      ...defaultLayout,
      paper: "sheet" as const,
      paperWidth: 110,
      paperHeight: 70,
      columns: 2,
      marginX: 5,
      marginY: 5,
      quantity: 4,
      skip: 2,
    };
    expect(labelGeometry(layout)).toMatchObject({ capacity: 4, pages: 2 });
    const doc = new DOMParser().parseFromString(
      labelPrintDocument(layout, '<div class="barcode-label">PEN</div>'),
      "text/html",
    );
    const pages = doc.querySelectorAll("section");
    expect(pages[0].querySelectorAll(".barcode-label")).toHaveLength(2);
    expect(pages[0].children[0].innerHTML).toBe("");
    expect(pages[1].querySelectorAll(".barcode-label")).toHaveLength(2);
  });
  it("[CO-LABEL-003] rejects impossible paper, content dimensions and fractional copies", () => {
    for (const change of [
      { quantity: 1.5 },
      { quantity: 0 },
      { columns: 1.5 },
      { padding: 20 },
      { barcodeHeight: 50 },
      { paper: "sheet", paperWidth: 40 },
      { skip: 1 },
      { marginX: -1 },
      { labelWidth: NaN },
    ]) {
      expect(() =>
        labelGeometry({ ...defaultLayout, ...change } as typeof defaultLayout),
      ).toThrow();
    }
  });
  it("[CO-LABEL-004] validates format-specific characters and retail barcode checksums", () => {
    expect(barcodeIsValid("PEN-123", "CODE128")).toBe(true);
    expect(barcodeIsValid("বাংলা", "CODE128")).toBe(false);
    expect(barcodeIsValid("lowercase", "CODE39")).toBe(false);
    expect(barcodeIsValid("4006381333931", "EAN13")).toBe(true);
    expect(barcodeIsValid("4006381333932", "EAN13")).toBe(false);
    expect(barcodeIsValid("400638133393", "EAN13")).toBe(true);
    expect(barcodeIsValid("96385074", "EAN8")).toBe(true);
    expect(barcodeIsValid("036000291452", "UPC")).toBe(true);
    expect(barcodeIsValid("12", "EAN8")).toBe(false);
    expect(barcodeDisplayValue("400638133393", "EAN13")).toBe("4006381333931");
    expect(barcodeDisplayValue("03600029145", "UPC")).toBe("036000291452");
  });
});

describe("[CO-BARCODE-FONT-001] label font options", () => {
  it("applies bold weight and the chosen font family", async () => {
    const { labelStyles, defaultLayout } = await import("./label-layout");
    expect(labelStyles(defaultLayout)).toContain("font:400 8pt/1.15 Arial");
    const css = labelStyles({
      ...defaultLayout,
      bold: true,
      fontFamily: "mono",
      fontSize: 10,
    });
    expect(css).toContain("font:700 10pt/1.15 'Courier New'");
  });
});
