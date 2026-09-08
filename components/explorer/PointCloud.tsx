"use client";
import { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { samplePoints } from "@/lib/sample-data";

export default function PointCloud() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reset = useRef(() => {});
  useEffect(() => {
    const canvas = ref.current!;
    const context = canvas.getContext("2d")!;
    const points = samplePoints();
    let angle = .4, tilt = .3, scale = 1, dragging = false, lastX = 0, lastY = 0;
    function draw() {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr;
      context.scale(dpr, dpr); context.fillStyle = "#091824"; context.fillRect(0, 0, width, height);
      context.strokeStyle = "#24414f"; context.lineWidth = .5;
      for (let x = 0; x < width; x += 30) { context.beginPath(); context.moveTo(x,0); context.lineTo(x,height); context.stroke(); }
      for (let y = 0; y < height; y += 30) { context.beginPath(); context.moveTo(0,y); context.lineTo(width,y); context.stroke(); }
      const projected = points.map((point) => {
        const x = point.x * Math.cos(angle) - point.z * Math.sin(angle);
        const z = point.x * Math.sin(angle) + point.z * Math.cos(angle);
        return { x, y: point.y * Math.cos(tilt) - z * Math.sin(tilt), z: point.y * Math.sin(tilt) + z * Math.cos(tilt) };
      }).sort((a,b) => a.z-b.z);
      for (const point of projected) {
        const perspective = 8 / (9 - point.z);
        const size = Math.min(width,height) * .105 * scale;
        context.fillStyle = `rgba(42,205,170,${.35+(point.z+4)/12})`;
        context.beginPath(); context.arc(width/2+point.x*size*perspective,height/2+point.y*size*perspective,2.1*perspective,0,Math.PI*2); context.fill();
      }
      context.fillStyle = "#6ca5ae"; context.font = "10px monospace";
      context.fillText("360 POINTS / XYZ + RGB / SYNTHETIC SAMPLE", 18, 24);
      context.fillText("DRAG TO ROTATE · SCROLL TO ZOOM · ARROW KEYS TO ROTATE", 18, height-17);
    }
    reset.current = () => { angle=.4; tilt=.3; scale=1; draw(); };
    const down = (event: PointerEvent) => { dragging=true; lastX=event.clientX; lastY=event.clientY; canvas.setPointerCapture(event.pointerId); };
    const move = (event: PointerEvent) => { if (!dragging) return; angle+=(event.clientX-lastX)*.01; tilt+=(event.clientY-lastY)*.01; lastX=event.clientX; lastY=event.clientY; draw(); };
    const up = () => { dragging=false; };
    const wheel = (event: WheelEvent) => { event.preventDefault(); scale=Math.min(2,Math.max(.5,scale-event.deltaY*.001)); draw(); };
    const key = (event: KeyboardEvent) => { if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","+","-"].includes(event.key)) { event.preventDefault(); angle+=event.key === "ArrowRight" ? .1 : event.key === "ArrowLeft" ? -.1 : 0; tilt+=event.key === "ArrowDown" ? .1 : event.key === "ArrowUp" ? -.1 : 0; scale=Math.min(2,Math.max(.5,scale+(event.key === "+" ? .1 : event.key === "-" ? -.1 : 0))); draw(); } };
    canvas.addEventListener("pointerdown",down); canvas.addEventListener("pointermove",move); canvas.addEventListener("pointerup",up); canvas.addEventListener("pointercancel",up); canvas.addEventListener("wheel",wheel,{passive:false}); canvas.addEventListener("keydown",key);
    const observer = new ResizeObserver(draw); observer.observe(canvas); draw();
    return () => { observer.disconnect(); canvas.removeEventListener("pointerdown",down); canvas.removeEventListener("pointermove",move); canvas.removeEventListener("pointerup",up); canvas.removeEventListener("pointercancel",up); canvas.removeEventListener("wheel",wheel); canvas.removeEventListener("keydown",key); };
  }, []);
  return <div className="pointcloud-viewer"><canvas ref={ref} tabIndex={0} aria-label="Interactive synthetic point cloud. Drag or use arrow keys to rotate, scroll or use plus and minus to zoom."/><button className="secondary-button" onClick={() => reset.current()}><RotateCcw size={13}/> Reset view</button></div>;
}
