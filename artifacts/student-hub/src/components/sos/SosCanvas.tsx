/**
 * SOS Collaborative Canvas
 *
 * - HTML5 Canvas with pen / marker / eraser / text tools
 * - Vector bezier smoothing for all drawn paths
 * - Streams coordinate arrays over Socket.io (not images)
 * - Accepts remote draw events and scales proportionally
 * - Drag-and-drop / click-to-upload background image
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Pen, Eraser, Type, Trash2, Upload, Minus, Plus } from "lucide-react";
import { useSos } from "@/context/SosContext";
import { getSocket } from "@/lib/socket";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tool = "pen" | "marker" | "eraser" | "text";

interface DrawPoint { x: number; y: number }

interface RemoteDrawEvent {
  points: DrawPoint[];
  tool: string;
  color: string;
  size: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface SosCanvasRef {
  clear: () => void;
}

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
  ctx.lineWidth = tool === "eraser" ? size * 2 : size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = tool === "marker" ? 0.65 : 1;

  if (pts.length === 1) {
    // Single dot
    ctx.arc(pts[0]!.x, pts[0]!.y, (tool === "eraser" ? size : size / 2), 0, Math.PI * 2);
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
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): DrawPoint[] {
  return pts.map(p => ({
    x: (p.x / srcW) * dstW,
    y: (p.y / srcH) * dstH,
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

const SosCanvas = forwardRef<SosCanvasRef>((_, ref) => {
  const { sendCanvasDraw, sendCanvasImage, sendCanvasClear } = useSos();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [tool, setTool]   = useState<Tool>("pen");
  const [color, setColor] = useState("#000000");
  const [size, setSize]   = useState(3);

  // Drawing state
  const drawingRef     = useRef(false);
  const currentPathRef = useRef<DrawPoint[]>([]);

  // Text tool state
  const [textMode, setTextMode]     = useState(false);
  const [textInput, setTextInput]   = useState("");
  const [textPos, setTextPos]       = useState<{ x: number; y: number } | null>(null);
  const textInputRef                = useRef<HTMLInputElement>(null);

  // Background image
  const bgImageRef = useRef<HTMLImageElement | null>(null);

  // ── Expose clear() to parent ────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    clear: () => clearCanvas(true),
  }));

  // ── Canvas size tracking ────────────────────────────────────────────────
  const getCanvasSize = () => {
    const c = canvasRef.current;
    return c ? { w: c.width, h: c.height } : { w: 800, h: 600 };
  };

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const { width, height } = wrapper.getBoundingClientRect();
    if (canvas.width === width && canvas.height === height) return;
    // Save current drawing before resize
    const tmpImg = new Image();
    tmpImg.src = canvas.toDataURL();
    canvas.width  = width || 800;
    canvas.height = height || 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, canvas.width, canvas.height);
    }
    tmpImg.onload = () => ctx.drawImage(tmpImg, 0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    initCanvas();
    const obs = new ResizeObserver(initCanvas);
    if (wrapperRef.current) obs.observe(wrapperRef.current);
    return () => obs.disconnect();
  }, [initCanvas]);

  // ── Clear canvas ────────────────────────────────────────────────────────
  const clearCanvas = useCallback((emit: boolean) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    bgImageRef.current = null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (emit) sendCanvasClear();
  }, [sendCanvasClear]);

  // ── Remote event listeners ──────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    const canvas = canvasRef.current;

    const onRemoteDraw = (data: RemoteDrawEvent) => {
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;
      const scaled = scalePoints(data.points, data.canvasWidth, data.canvasHeight, canvas.width, canvas.height);
      smoothPath(ctx, scaled, data.tool, data.color, data.size);
    };

    const onRemoteImage = (data: { dataUrl: string; canvasWidth: number; canvasHeight: number }) => {
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;
      const img = new Image();
      img.onload = () => {
        bgImageRef.current = img;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = data.dataUrl;
    };

    const onRemoteClear = () => {
      const ctx = canvas?.getContext("2d");
      if (!ctx || !canvas) return;
      bgImageRef.current = null;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    socket.on("sos_canvas_draw",  onRemoteDraw);
    socket.on("sos_canvas_image", onRemoteImage);
    socket.on("sos_canvas_clear", onRemoteClear);

    return () => {
      socket.off("sos_canvas_draw",  onRemoteDraw);
      socket.off("sos_canvas_image", onRemoteImage);
      socket.off("sos_canvas_clear", onRemoteClear);
    };
  }, []);

  // ── Pointer events ──────────────────────────────────────────────────────

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): DrawPoint => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasRef.current!.width / rect.width),
      y: (e.clientY - rect.top)  * (canvasRef.current!.height / rect.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool === "text") {
      const pos = getPos(e);
      setTextPos(pos);
      setTextMode(true);
      setTextInput("");
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }
    drawingRef.current = true;
    currentPathRef.current = [getPos(e)];
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const pos = getPos(e);
    currentPathRef.current.push(pos);

    // Draw locally for instant feedback
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      const pts = currentPathRef.current;
      smoothPath(ctx, pts.slice(-3), tool, color, size);
    }
  };

  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const pts = currentPathRef.current;
    if (pts.length === 0) return;

    const { w, h } = getCanvasSize();
    sendCanvasDraw({
      points: pts,
      tool,
      color,
      size,
      canvasWidth: w,
      canvasHeight: h,
    });
    currentPathRef.current = [];
  };

  // ── Text commit ─────────────────────────────────────────────────────────
  const commitText = () => {
    if (!textPos || !textInput.trim()) {
      setTextMode(false);
      setTextPos(null);
      return;
    }
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.font = `${size * 6 + 10}px sans-serif`;
      ctx.fillStyle = color;
      ctx.fillText(textInput.trim(), textPos.x, textPos.y);
    }
    setTextMode(false);
    setTextPos(null);
    setTextInput("");
  };

  // ── Image upload ────────────────────────────────────────────────────────
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas) return;
        bgImageRef.current = img;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        sendCanvasImage(dataUrl, canvas.width, canvas.height);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  };

  // ── Toolbar config ──────────────────────────────────────────────────────
  const tools: { id: Tool; icon: React.ReactNode; label: string }[] = [
    { id: "pen",    icon: <Pen className="w-4 h-4" />,    label: "Pen"    },
    { id: "marker", icon: <Pen className="w-4 h-4 opacity-60" />, label: "Marker" },
    { id: "eraser", icon: <Eraser className="w-4 h-4" />, label: "Eraser" },
    { id: "text",   icon: <Type className="w-4 h-4" />,   label: "Text"   },
  ];

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 flex-wrap">
        {/* Tools */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {tools.map(t => (
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

        {/* Colors */}
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

        {/* Size */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setSize(s => Math.max(1, s - 1))}
            className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs text-gray-600 dark:text-gray-300 w-4 text-center">{size}</span>
          <button
            onClick={() => setSize(s => Math.min(20, s + 1))}
            className="p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        {/* Image upload */}
        <label className="cursor-pointer p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Upload image">
          <Upload className="w-4 h-4" />
          <input type="file" accept="image/*" className="hidden" onChange={onFilePick} />
        </label>

        {/* Clear */}
        <button
          onClick={() => clearCanvas(true)}
          title="Clear canvas"
          className="p-1.5 rounded-md text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={wrapperRef}
        className="relative flex-1 overflow-hidden"
        style={{ cursor: tool === "eraser" ? "cell" : tool === "text" ? "text" : "crosshair" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onDrop={onDrop}
          onDragOver={e => e.preventDefault()}
        />

        {/* Text input overlay */}
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
              left: (textPos.x / (canvasRef.current?.width ?? 800)) * 100 + "%",
              top:  (textPos.y / (canvasRef.current?.height ?? 600)) * 100 + "%",
              color,
              fontSize: `${size * 6 + 10}px`,
            }}
            className="bg-transparent border-b border-dashed border-current outline-none min-w-[80px] max-w-[300px]"
            placeholder="Type here…"
          />
        )}

        {/* Drop zone hint */}
        <div className="absolute bottom-2 right-2 text-[10px] text-gray-300 dark:text-gray-700 pointer-events-none select-none">
          Drag &amp; drop image to set background
        </div>
      </div>
    </div>
  );
});

SosCanvas.displayName = "SosCanvas";
export { SosCanvas };
