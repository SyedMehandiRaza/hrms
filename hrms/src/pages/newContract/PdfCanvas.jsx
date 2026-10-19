import { useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Configure the PDF.js worker once (Vite resolves the ?url import to a real URL).
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

// Renders ONE page of a PDF to a <canvas> that fills its parent.
// Reports (numPages, aspectRatio) via onLoaded so the parent can size the box
// and know the real page count. The parent owns the positioning box; field
// overlays are the parent's children positioned by the same x/y %.
export default function PdfCanvas({ src, page = 1, onLoaded, onError, className }) {
  const canvasRef = useRef(null);
  const pdfRef = useRef(null);
  const srcRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;

    const run = async () => {
      if (!src || !canvasRef.current) return;
      try {
        // (re)load the document only when the src changes
        if (srcRef.current !== src || !pdfRef.current) {
          const task = pdfjsLib.getDocument(src);
          pdfRef.current = await task.promise;
          srcRef.current = src;
        }
        const pdf = pdfRef.current;
        if (cancelled) return;

        const pageNo = Math.min(Math.max(page, 1), pdf.numPages);
        const pg = await pdf.getPage(pageNo);
        if (cancelled) return;

        const base = pg.getViewport({ scale: 1 });
        onLoaded?.(pdf.numPages, base.width / base.height);

        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = canvas.clientWidth || 600;
        const scale = (cssWidth * dpr) / base.width;
        const vp = pg.getViewport({ scale });
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        const ctx = canvas.getContext("2d");
        renderTask = pg.render({ canvasContext: ctx, viewport: vp });
        await renderTask.promise;
      } catch (err) {
        if (!cancelled && err?.name !== "RenderingCancelledException") onError?.(err);
      }
    };

    run();
    return () => {
      cancelled = true;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch {
          /* ignore */
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, page]);

  return <canvas ref={canvasRef} className={className} />;
}
