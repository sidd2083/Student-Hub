/**
 * SOS Collaborative Canvas — v2
 *
 * - Fixed 3000 × 2000 px drawing surface — consistent across ALL screen sizes (no more stretching)
 * - Infinite pan: select Hand tool and drag, or middle-mouse drag anywhere
 * - Zoom: toolbar buttons, scroll wheel, or pinch-to-zoom on mobile
 * - Click the zoom % label to fit canvas back to screen
 * - Zero database — all sync via Socket.io only
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Eraser,
  Hand,
  Minus,
  Pen,
  Plus,
  Trash2,
  Type,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useSos } from "@/context/SosContext";
import { getSocket } from "@/lib/socket";

// ── Canvas dimensions (fixed — never resize) ──────────────────────────────────
const CANVAS_W = 3000;
const CANVAS_H = 2000;
const MIN_ZOOM  = 0.1;
const MAX_ZOOM  = 4;

// ── Types ─────────────────────────────────────────────────────────────────────
type Tool = "pen" | "marker" | "eraser" | "text" | "hand";

interface DrawPoint { x: number; y: number }

interface RemoteDrawEvent {
  points: DrawPoint[];
  tool: string;
  color: string;
  size: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface SosCanvasRef { clear: () => void }

const COLORS = ["#000000", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ffffff"];

// ── Drawing helpers ───────────────────────────────────────────────────────────
function smoothPath(
  ctx: CanvasRenderingContext2D,
  pts: DrawPoint[],
  tool: string,
  color: string,
  size: number,
) {
  if (pts.length < 1) return;
  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
  ctx.lineWidth   = tool === "eraser" ? size * 2 : size;
  ctx.lineCap     = "round";
  ctx.lineJoin    = "round";
  ctx.globalAlpha = tool === "marker" ? 0.65 : 1;

  if (pts.length === 1) {
    ctx.arc(pts[0]!.x, pts[0]!.y, tool === "eraser" ? size : size / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.fill();
  } else {
    ctx.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mid = {
        x: (pts[i]!.x + pts[i + 1]!.x) / 2,
        y: (pts[i]!.y + pts[i + 1]!.y) / 2,
      };
      ctx.quadraticCurveTo(pts[i]!.x, pts[i]!.y, mid.x, mid.y);
    }
    ctx.lineTo(pts[pts.length - 1]!.x, pts[pts.length - 1]!.y);
    ctx.stroke();
  }
  ctx.restore();
}

function scalePoints(
  pts: DrawPoint[],
  srcW: number, srcH: number,
  dstW: number, dstH: number,
): DrawPoint[] {
  return pts.map(p => ({ x: (p.x / srcW) * dstW, y: (p.y / srcH) * dstH }));
}

// ── Component ─────────────────────────────────────────────────────────────────
const SosCanvas = forwardRef<SosCanvasRef>((_, ref) => {
  const { sendCanvasDraw, sendCanvasImage, sendCanvasClear } = useSos();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [tool,  setTool]  = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [size,  setSize]  = useState(3);

  // ── Viewport state ───────────────────────────────────────────────────────
  // React state drives rendering; refs keep values fresh inside native listeners
  const [zoom, _setZoom]       = useState(1);
  const [panX, _setPanX]       = useState(0);
  const [panY, _setPanY]       = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const zoomRef = useRef(zoom);
  const panXRef = useRef(panX);
  const panYRef = useRef(panY);
  const setZoom = (v: number) => { zoomRef.current = v; _setZoom(v); };
  const setPanX = (v: number) => { panXRef.current = v; _setPanX(v); };
  const setPanY = (v: number) => { panYRef.current = v; _setPanY(v); };

  // ── Drawing refs ─────────────────────────────────────────────────────────
  const drawingRef     = useRef(false);
  const currentPathRef = useRef<DrawPoint[]>([]);

  // ── Pan refs ─────────────────────────────────────────────────────────────
  const panningRef  = useRef(false);
  const panStartRef = useRef({ cx: 0, cy: 0, px: 0, py: 0 });

  // ── Pinch-to-zoom ref ────────────────────────────────────────────────────
  const pinchRef = useRef<{
    dist: number; midX: number; midY: number; px: number; py: number; z: number;
  } | null>(null);

  // ── Text tool state ──────────────────────────────────────────────────────
  const [textMode,  setTextMode]  = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPos,   setTextPos]   = useState<DrawPoint | null>(null);
  const textInputRef              = useRef<HTMLInputElement>(null);

  // ── Background image ─────────────────────────────────────────────────────
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  // ── Expose clear() to parent ─────────────────────────────────────────────
  useImperativeHandle(ref, () => ({ clear: () => clearCanvas(true) }));

  // ── Fit canvas into viewport ─────────────────────────────────────────────
  const fitView = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const { width, height } = wrapper.getBoundingClientRect();
    const z  = Math.max(MIN_ZOOM, Math.min(1, width / CANVAS_W, height / CANVAS_H));
    const px = (width  - CANVAS_W * z) / 2;
    const py = (height - CANVAS_H * z) / 2;
    setZoom(z); setPanX(px); setPanY(py);
  }, []);

  // ── Init canvas on mount (once) ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    if (ctx) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H); }
    requestAnimationFrame(fitView);
  }, [fitView]);

  // ── Zoom toward a viewport-relative point ────────────────────────────────
  const zoomAt = useCallback((factor: number, vpX?: number, vpY?: number) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const { width, height } = wrapper.getBoundingClientRect();
    const cx = vpX ?? width  / 2;
    const cy = vpY ?? height / 2;
    const z0 = zoomRef.current;
    const z1 = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z0 * factor));
    setZoom(z1);
    setPanX(cx - (cx - panXRef.current) * (z1 / z0));
    setPanY(cy - (cy - panYRef.current) * (z1 / z0));
  }, []);

  // ── Scroll-wheel zoom (must be non-passive to preventDefault) ────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [zoomAt]);

  // ── Pinch-to-zoom (touch, non-passive to preventDefault) ─────────────────
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const d2 = (t: TouchList) =>
      Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      const rect = el.getBoundingClientRect();
      pinchRef.current = {
        dist: d2(e.touches),
        midX: (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2 - rect.left,
        midY: (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2 - rect.top,
        px: panXRef.current, py: panYRef.current, z: zoomRef.current,
      };
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const p  = pinchRef.current;
      const z1 = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, p.z * (d2(e.touches) / p.dist)));
      setZoom(z1);
      setPanX(p.midX - (p.midX - p.px) * (z1 / p.z));
      setPanY(p.midY - (p.midY - p.py) * (z1 / p.z));
    };

    const onEnd = () => { pinchRef.current = null; };

    el.addEventListener("touchstart",  onStart, { passive: true });
    el.addEventListener("touchmove",   onMove,  { passive: false });
    el.addEventListener("touchend",    onEnd,   { passive: true });
    el.addEventListener("touchcancel", onEnd,   { passive: true });
    return () => {
      el.removeEventListener("touchstart",  onStart);
      el.removeEventListener("touchmove",   onMove);
      el.removeEventListener("touchend",    onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  // ── Clear canvas ─────────────────────────────────────────────────────────
  const clearCanvas = useCallback((emit: boolean) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    bgImageRef.current = null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (emit) sendCanvasClear();
  }, [sendCanvasClear]);

  // ── Remote draw/image/clear listeners ────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    const canvas = canvasRef.current;

    const onDraw = (d: RemoteDrawEvent) => {
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;
      // Scale from sender's canvas coords to our fixed 3000×2000 (usually 1:1)
      const pts = scalePoints(d.points, d.canvasWidth, d.canvasHeight, CANVAS_W, CANVAS_H);
      smoothPath(ctx, pts, d.tool, d.color, d.size);
    };

    const onImage = (d: { dataUrl: string; canvasWidth: number; canvasHeight: number }) => {
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        bgImageRef.current = img;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
      };
      img.src = d.dataUrl;
    };

    const onClear = () => {
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;
      bgImageRef.current = null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    };

    socket.on("sos_canvas_draw",  onDraw);
    socket.on("sos_canvas_image", onImage);
    socket.on("sos_canvas_clear", onClear);
    return () => {
      socket.off("sos_canvas_draw",  onDraw);
      socket.off("sos_canvas_image", onImage);
      socket.off("sos_canvas_clear", onClear);
    };
  }, []);

  // ── Convert viewport coords → canvas pixel coords ────────────────────────
  const vpToCanvas = (clientX: number, clientY: number): DrawPoint => {
    const rect = wrapperRef.current!.getBoundingClientRect();
    return {
      x: (clientX - rect.left - panXRef.current) / zoomRef.current,
      y: (clientY - rect.top  - panYRef.current) / zoomRef.current,
    };
  };

  // ── Pointer events (all on wrapper, not canvas) ──────────────────────────
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Middle mouse OR hand tool → pan
    if (e.button === 1 || tool === "hand") {
      panningRef.current = true;
      setIsPanning(true);
      panStartRef.current = {
        cx: e.clientX, cy: e.clientY,
        px: panXRef.current, py: panYRef.current,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    if (tool === "text") {
      setTextPos(vpToCanvas(e.clientX, e.clientY));
      setTextMode(true);
      setTextInput("");
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    drawingRef.current   = true;
    currentPathRef.current = [vpToCanvas(e.clientX, e.clientY)];
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panningRef.current) {
      setPanX(panStartRef.current.px + (e.clientX - panStartRef.current.cx));
      setPanY(panStartRef.current.py + (e.clientY - panStartRef.current.cy));
      return;
    }
    if (!drawingRef.current) return;
    const pos = vpToCanvas(e.clientX, e.clientY);
    currentPathRef.current.push(pos);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) smoothPath(ctx, currentPathRef.current.slice(-3), tool, color, size);
  };

  const onPointerUp = () => {
    if (panningRef.current) {
      panningRef.current = false;
      setIsPanning(false);
      return;
    }
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pts = currentPathRef.current;
    if (pts.length > 0) {
      sendCanvasDraw({ points: pts, tool, color, size, canvasWidth: CANVAS_W, canvasHeight: CANVAS_H });
    }
    currentPathRef.current = [];
  };

  // ── Text commit ──────────────────────────────────────────────────────────
  const commitText = () => {
    if (!textPos || !textInput.trim()) { setTextMode(false); setTextPos(null); return; }
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.font      = `${size * 6 + 10}px sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(textInput.trim(), textPos.x, textPos.y);
    }
    setTextMode(false); setTextPos(null); setTextInput("");
  };

  // ── Image upload helper ──────────────────────────────────────────────────
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext("2d");
        if (!ctx || !canvas) return;
        bgImageRef.current = img;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
        sendCanvasImage(dataUrl, CANVAS_W, CANVAS_H);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // ── Cursor ───────────────────────────────────────────────────────────────
  const cursor =
    tool === "hand"   ? (isPanning ? "grabbing" : "grab") :
    tool === "eraser" ? "cell" :
    tool === "text"   ? "text" :
    "crosshair";

  // ── Toolbar tool list ────────────────────────────────────────────────────
  const toolDefs: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "pen",    icon: <Pen    className="w-4 h-4" />,            label: "Pen" },
    { id: "marker", icon: <Pen    className="w-4 h-4 opacity-50" />, label: "Marker (semi-transparent)" },
    { id: "eraser", icon: <Eraser className="w-4 h-4" />,            label: "Eraser" },
    { id: "text",   icon: <Type   className="w-4 h-4" />,            label: "Text" },
    { id: "hand",   icon: <Hand   className="w-4 h-4" />,            label: "Pan canvas (drag to scroll)" },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950 select-none">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-wrap gap-y-1.5">

        {/* Drawing tools + Hand */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {toolDefs.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={t.label}
              className={`p-1.5 rounded-md transition-colors ${
                tool === t.id
                  ? "bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Color swatches */}
        <div className="flex items-center gap-1">
          {COLORS.filter(c => c !== "#ffffff" || tool === "pen").map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ background: c, border: `2px solid ${color === c ? "#3b82f6" : "transparent"}` }}
              className="w-5 h-5 rounded-full transition-transform hover:scale-110 active:scale-95 shrink-0"
            />
          ))}
        </div>

        {/* Stroke size */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSize(s => Math.max(1, s - 1))}
            className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          ><Minus className="w-3 h-3" /></button>
          <span className="text-xs text-gray-600 dark:text-gray-300 w-4 text-center">{size}</span>
          <button
            onClick={() => setSize(s => Math.min(20, s + 1))}
            className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          ><Plus className="w-3 h-3" /></button>
        </div>

        {/* Zoom controls — zoom% label is clickable to fit view */}
        <div className="flex items-center gap-0.5 ml-auto">
          <button
            onClick={() => zoomAt(0.8)}
            title="Zoom out"
            className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          ><ZoomOut className="w-3.5 h-3.5" /></button>

          <button
            onClick={fitView}
            title="Fit canvas to screen"
            className="px-1.5 py-1 rounded text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 tabular-nums min-w-[3rem] text-center"
          >{Math.round(zoom * 100)}%</button>

          <button
            onClick={() => zoomAt(1.25)}
            title="Zoom in"
            className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          ><ZoomIn className="w-3.5 h-3.5" /></button>
        </div>

        {/* Image upload */}
        <label
          className="cursor-pointer p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Upload background image"
        >
          <Upload className="w-4 h-4" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) handleImageFile(f);
              e.target.value = "";
            }}
          />
        </label>

        {/* Clear */}
        <button
          onClick={() => clearCanvas(true)}
          title="Clear canvas (both sides)"
          className="p-1.5 rounded-md text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* ── Viewport ── */}
      <div
        ref={wrapperRef}
        className="relative flex-1 overflow-hidden bg-[#d1d5db] dark:bg-[#0f172a]"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImageFile(f); }}
        onDragOver={e => e.preventDefault()}
      >
        {/* The canvas sits inside a CSS-transformed div — never resized */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
            transformOrigin: "0 0",
            willChange: "transform",
            boxShadow: "0 2px 20px rgba(0,0,0,0.3)",
          }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{ display: "block", width: CANVAS_W, height: CANVAS_H }}
            className="touch-none"
          />
        </div>

        {/* Text input overlay — positioned in viewport space */}
        {textMode && textPos && (
          <input
            ref={textInputRef}
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") commitText();
              if (e.key === "Escape") { setTextMode(false); setTextPos(null); }
            }}
            onBlur={commitText}
            style={{
              position: "absolute",
              left: panX + textPos.x * zoom,
              top:  panY + textPos.y * zoom,
              color,
              fontSize: `${(size * 6 + 10) * zoom}px`,
              transform: "translateY(-0.85em)",
              pointerEvents: "auto",
            }}
            className="bg-transparent border-b-2 border-dashed border-current outline-none min-w-[80px] max-w-xs z-10"
            placeholder="Type & press Enter…"
          />
        )}

        {/* Hint bar */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-2.5 py-1 rounded-full whitespace-nowrap">
            ✋ Hand tool or middle-click to pan · Scroll to zoom · Pinch on mobile
          </span>
        </div>
      </div>
    </div>
  );
});

SosCanvas.displayName = "SosCanvas";
export { SosCanvas };
