// Shows the pages of a PDF as pictures, so the bill looks the same on every
// phone and computer.
import { useState, useEffect, useRef } from "react";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

export default function PdfPreview({ blob, label }) {
  const box = useRef(null);
  const [width, setWidth] = useState(0);
  const [pages, setPages] = useState({ blob: null, count: 0 });
  const [failed, setFailed] = useState(false);

  // Redraw when the space changes by enough to matter
  useEffect(() => {
    const node = box.current;
    const measure = () => setWidth((old) => (Math.abs(node.clientWidth - old) > 24 ? node.clientWidth : old));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!blob || !width) return;
    let cancelled = false;
    let task;
    const draw = async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      task = pdfjs.getDocument({ data: await blob.arrayBuffer() });
      const pdf = await task.promise;
      const sharp = Math.min(window.devicePixelRatio || 1, 2.5);
      const canvases = [];
      for (let n = 1; n <= pdf.numPages; n += 1) {
        const page = await pdf.getPage(n);
        const scale = (width / page.getViewport({ scale: 1 }).width) * sharp;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.className = "block w-full h-auto bg-white shadow-md";
        canvas.setAttribute("role", "img");
        canvas.setAttribute("aria-label", `${label}, page ${n} of ${pdf.numPages}`);
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        if (cancelled) return;
        canvases.push(canvas);
      }
      // Swapped in all at once, so the old pages stay until the new ones are ready
      box.current.querySelector("[data-pages]").replaceChildren(...canvases);
      setPages({ blob, count: canvases.length });
      setFailed(false);
    };
    draw().catch((err) => {
      if (cancelled) return;
      console.error("Preview:", err);
      setFailed(true);
    });
    return () => {
      cancelled = true;
      task?.destroy();
    };
  }, [blob, width, label]);

  const loading = !failed && pages.blob !== blob;

  return (
    <div ref={box} className="relative w-full">
      {failed && (
        <p role="alert" className="card p-6 text-center text-sm text-slate-600">
          The preview could not be shown on this device. Use Download to open the bill.
        </p>
      )}
      {loading && pages.count === 0 && <div className="skeleton w-full aspect-[210/297]" aria-label="Preparing the preview" />}
      <div data-pages className={`space-y-3 transition-opacity duration-300 ${loading ? "opacity-50" : ""} ${failed ? "hidden" : ""}`} />
    </div>
  );
}
