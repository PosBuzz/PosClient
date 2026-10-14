/**
 * A deterministic PDFKit stand-in for layout tests. Every call the code under test makes is logged
 * as [method, ...args]; the vertical cursor (doc.y) advances by fixed amounts so positions that depend
 * on it (rules under headings, table rows) show up in the log. Pair it with a reviewed golden file:
 * any layout change then appears as a diff instead of passing silently.
 */
export type PdfCall = unknown[];

const LINE = 14;

export function createPdfRecorder() {
  const documents: Array<{ options: unknown; calls: PdfCall[] }> = [];

  class RecordingDocument {
    x = 50;
    y = 50;
    page = {
      width: 595,
      height: 842,
      margins: { top: 36, bottom: 40, left: 40, right: 40 },
    };
    private handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
    readonly calls: PdfCall[] = [];
    private pages = 1;

    constructor(options?: unknown) {
      documents.push({ options, calls: this.calls });
      // Property reads/writes the services rely on that are not method calls
      return new Proxy(this, {
        get: (target, prop, receiver) => {
          if (typeof prop === 'symbol' || prop in target) {
            return Reflect.get(target, prop, receiver);
          }
          return (...args: unknown[]) => {
            target.calls.push([prop, ...args]);
            if (prop === 'text') target.y += LINE;
            return receiver;
          };
        },
      });
    }

    on(event: string, handler: (...args: unknown[]) => void) {
      (this.handlers[event] ??= []).push(handler);
      return this;
    }

    moveDown(lines = 1) {
      this.calls.push(['moveDown', lines]);
      this.y += lines * LINE;
      return this;
    }

    addPage() {
      this.calls.push(['addPage']);
      this.pages += 1;
      this.y = 50;
      return this;
    }

    bufferedPageRange() {
      return { start: 0, count: this.pages };
    }

    switchToPage(index: number) {
      this.calls.push(['switchToPage', index]);
      return this;
    }

    end() {
      this.calls.push(['end']);
      void Promise.resolve().then(() => {
        for (const handler of this.handlers['data'] ?? []) {
          handler(Buffer.from('%PDF-recorded'));
        }
        for (const handler of this.handlers['end'] ?? []) handler();
      });
    }
  }

  return { RecordingDocument, documents };
}
