import { useEffect, useRef, useState } from "react";
import { MdClose, MdOutlineDraw, MdOutlineKeyboard, MdOutlineReplay } from "react-icons/md";
import { useTranslation } from "react-i18next";

// Digital-signature capture popup (UI demo, no backend).
// The recipient either DRAWS on the canvas or TYPES their name; on save the
// signature would be stored on their record and reused on future contracts.
export default function SignaturePadModal({ onClose, onSave }) {
  const { t } = useTranslation("contractStudio");
  const [mode, setMode] = useState("draw"); // 'draw' | 'type'
  const [typed, setTyped] = useState("");
  const [hasDrawing, setHasDrawing] = useState(false);
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });

  // size the canvas to its rendered box for crisp lines
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "draw") return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
  }, [mode]);

  const pos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const tp = e.touches?.[0];
    return { x: (tp ? tp.clientX : e.clientX) - rect.left, y: (tp ? tp.clientY : e.clientY) - rect.top };
  };
  const start = (e) => {
    drawing.current = true;
    last.current = pos(e);
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasDrawing) setHasDrawing(true);
  };
  const end = () => { drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
    setTyped("");
  };

  const canSave = mode === "draw" ? hasDrawing : typed.trim().length > 0;

  // Build the signature payload and hand it to the caller.
  const handleSave = () => {
    let result;
    if (mode === "draw") {
      const dataUrl = canvasRef.current ? canvasRef.current.toDataURL("image/png") : null;
      result = { type: "DRAWN", dataUrl, text: null };
    } else {
      result = { type: "TYPED", dataUrl: null, text: typed.trim() };
    }
    onSave?.(result);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <MdOutlineDraw className="text-xl text-[#20B2AA]" />
            <h3 className="text-base font-bold text-gray-900">{t("signaturePad.title")}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* mode tabs */}
        <div className="flex gap-1 p-1.5 mx-5 mt-4 bg-gray-100 rounded-lg">
          <button
            onClick={() => setMode("draw")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-md transition-colors ${
              mode === "draw" ? "bg-white text-cyan-600 shadow-sm" : "text-gray-500"
            }`}
          >
            <MdOutlineDraw /> {t("signaturePad.draw")}
          </button>
          <button
            onClick={() => setMode("type")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold rounded-md transition-colors ${
              mode === "type" ? "bg-white text-cyan-600 shadow-sm" : "text-gray-500"
            }`}
          >
            <MdOutlineKeyboard /> {t("signaturePad.type")}
          </button>
        </div>

        {/* body */}
        <div className="p-5">
          {mode === "draw" ? (
            <div className="relative">
              <canvas
                ref={canvasRef}
                onMouseDown={start}
                onMouseMove={move}
                onMouseUp={end}
                onMouseLeave={end}
                onTouchStart={start}
                onTouchMove={move}
                onTouchEnd={end}
                className="w-full h-44 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 cursor-crosshair touch-none"
              />
              {!hasDrawing && (
                <span className="absolute inset-0 flex items-center justify-center text-sm text-gray-300 pointer-events-none">
                  {t("signaturePad.drawHere")}
                </span>
              )}
            </div>
          ) : (
            <div>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={t("signaturePad.typePlaceholder")}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <div className="mt-3 h-24 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 flex items-center justify-center">
                <span className="text-3xl text-gray-800" style={{ fontFamily: "'Segoe Script','Brush Script MT',cursive" }}>
                  {typed || t("signaturePad.preview")}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <button onClick={clear} className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800">
              <MdOutlineReplay /> {t("actions.clear")}
            </button>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900">
                {t("actions.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="px-5 py-2 text-sm font-bold text-white bg-[#20B2AA] hover:bg-[#1C9D96] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t("signaturePad.save")}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 mt-3 text-center leading-relaxed">
            {t("signaturePad.footnote")}
          </p>
        </div>
      </div>
    </div>
  );
}
