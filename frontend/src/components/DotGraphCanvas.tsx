"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { DotGraphData, GraphNode, GraphLink } from "@/types";
import { FORMAT_INR } from "@/lib/constants";
import { Sliders, RotateCcw, Zap, Info, Maximize2, ShieldAlert } from "lucide-react";

interface DotGraphCanvasProps {
  data: DotGraphData;
  onSelectCategory?: (categoryId: string) => void;
}

interface SimNode extends GraphNode {
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
  targetRadius: number;
}

export const DotGraphCanvas: React.FC<DotGraphCanvasProps> = ({ data, onSelectCategory }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Simulation physics parameters
  const [gravity, setGravity] = useState<number>(0.04);
  const [repulsion, setRepulsion] = useState<number>(350);
  const [linkStiffness, setLinkStiffness] = useState<number>(0.05);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(false);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<SimNode | null>(null);

  // Canvas viewport transform
  const transformRef = useRef<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });
  const isDraggingCanvasRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggedNodeRef = useRef<SimNode | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const animFrameRef = useRef<number | null>(null);

  // Initialize simulation nodes and links
  useEffect(() => {
    const initializedNodes: SimNode[] = data.nodes.map((n, i) => {
      const angle = (i / Math.max(1, data.nodes.length)) * 2 * Math.PI;
      const initialRadius = n.type === "user" ? 0 : n.type === "peer_cluster" ? 180 : 120;
      return {
        ...n,
        x: n.x ?? Math.cos(angle) * initialRadius,
        y: n.y ?? Math.sin(angle) * initialRadius,
        vx: 0,
        vy: 0,
        targetRadius: n.size,
      };
    });

    nodesRef.current = initializedNodes;
    linksRef.current = data.links;
  }, [data]);

  // Main simulation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let pulseTick = 0;

    const resizeCanvas = () => {
      if (containerRef.current && canvas) {
        const rect = containerRef.current.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const stepSimulation = () => {
      pulseTick += 0.03;
      const nodes = nodesRef.current;
      const links = linksRef.current;
      const { width, height } = containerRef.current?.getBoundingClientRect() || { width: 400, height: 400 };
      const centerX = width / 2;
      const centerY = height / 2;

      if (!isPaused) {
        // 1. Central Gravity Force towards Center
        for (const node of nodes) {
          if (node.fx != null && node.fy != null) continue;
          const dx = 0 - (node.x || 0);
          const dy = 0 - (node.y || 0);
          node.vx += dx * gravity;
          node.vy += dy * gravity;
        }

        // 2. Node-to-Node Repulsion (Charge)
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            const dx = (b.x || 0) - (a.x || 0);
            const dy = (b.y || 0) - (a.y || 0);
            const distSq = dx * dx + dy * dy || 1;
            const dist = Math.sqrt(distSq);

            if (dist < 320) {
              const force = (repulsion * 15) / distSq;
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              if (a.fx == null) {
                a.vx -= fx;
                a.vy -= fy;
              }
              if (b.fx == null) {
                b.vx += fx;
                b.vy += fy;
              }
            }
          }
        }

        // 3. Link Spring Attraction
        for (const link of links) {
          const sourceNode = nodes.find((n) => n.id === link.source);
          const targetNode = nodes.find((n) => n.id === link.target);
          if (!sourceNode || !targetNode) continue;

          const dx = (targetNode.x || 0) - (sourceNode.x || 0);
          const dy = (targetNode.y || 0) - (sourceNode.y || 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = link.distance || 120;
          const displacement = dist - targetDist;
          const force = displacement * linkStiffness * (link.strength || 1);

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (sourceNode.fx == null) {
            sourceNode.vx += fx;
            sourceNode.vy += fy;
          }
          if (targetNode.fx == null) {
            targetNode.vx -= fx;
            targetNode.vy -= fy;
          }
        }

        // 4. Dampening & Position Update
        const friction = 0.88;
        for (const node of nodes) {
          if (node.fx != null && node.fy != null) {
            node.x = node.fx;
            node.y = node.fy;
            node.vx = 0;
            node.vy = 0;
          } else {
            node.vx *= friction;
            node.vy *= friction;
            node.x = (node.x || 0) + node.vx;
            node.y = (node.y || 0) + node.vy;
          }
        }
      }

      // --- RENDER PASS ---
      ctx.clearRect(0, 0, width, height);
      ctx.save();

      // Pan & Zoom
      ctx.translate(centerX + transformRef.current.x, centerY + transformRef.current.y);
      ctx.scale(transformRef.current.k, transformRef.current.k);

      // Draw Background Starfield / Physics Grid Dots
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      for (let gx = -300; gx <= 300; gx += 40) {
        for (let gy = -300; gy <= 300; gy += 40) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw Links
      for (const link of links) {
        const src = nodes.find((n) => n.id === link.source);
        const tgt = nodes.find((n) => n.id === link.target);
        if (!src || !tgt) continue;

        ctx.beginPath();
        ctx.moveTo(src.x || 0, src.y || 0);
        ctx.lineTo(tgt.x || 0, tgt.y || 0);

        if (link.type === "gravity") {
          ctx.strokeStyle = `rgba(139, 92, 246, ${Math.min(0.6, 0.15 + link.strength * 0.4)})`;
          ctx.lineWidth = Math.max(1, link.strength * 2.5);
        } else if (link.type === "similarity") {
          ctx.strokeStyle = "rgba(236, 72, 153, 0.4)";
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1.5;
        } else {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
          ctx.lineWidth = 1;
        }

        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Nodes
      for (const node of nodes) {
        const nx = node.x || 0;
        const ny = node.y || 0;
        const radius = node.targetRadius;
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;

        // Pulsing glow for user center node
        if (node.type === "user") {
          const pulseRadius = radius + Math.sin(pulseTick) * 4 + 6;
          const grad = ctx.createRadialGradient(nx, ny, radius * 0.5, nx, ny, pulseRadius * 1.6);
          grad.addColorStop(0, "rgba(139, 92, 246, 0.5)");
          grad.addColorStop(0.6, "rgba(99, 102, 241, 0.2)");
          grad.addColorStop(1, "rgba(139, 92, 246, 0)");

          ctx.beginPath();
          ctx.arc(nx, ny, pulseRadius * 1.6, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Category node hover glow
        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(nx, ny, radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
          ctx.fill();
        }

        // Draw solid node body
        ctx.beginPath();
        ctx.arc(nx, ny, radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.shadowColor = node.color;
        ctx.shadowBlur = isHovered ? 18 : 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner highlight
        ctx.beginPath();
        ctx.arc(nx - radius * 0.2, ny - radius * 0.2, radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fill();

        // Node Label
        ctx.font = node.type === "user" ? "bold 11px Inter, sans-serif" : "10px Inter, sans-serif";
        ctx.fillStyle = isHovered || isSelected ? "#FFFFFF" : "rgba(255, 255, 255, 0.85)";
        ctx.textAlign = "center";
        ctx.fillText(node.label, nx, ny + radius + 13);

        // Subtext if spent amount > 0
        if (node.amount && node.amount > 0 && node.type === "category") {
          ctx.font = "9px Inter, sans-serif";
          ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
          ctx.fillText(`₹${node.amount}`, nx, ny + radius + 24);
        }
      }

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(stepSimulation);
    };

    animFrameRef.current = requestAnimationFrame(stepSimulation);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [gravity, repulsion, linkStiffness, isPaused, hoveredNode, selectedNode]);

  // Pointer Interactions: Dragging, Zooming, Hover
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const simX = (clientX - (centerX + transformRef.current.x)) / transformRef.current.k;
    const simY = (clientY - (centerY + transformRef.current.y)) / transformRef.current.k;

    // Hit test nodes
    let clickedNode: SimNode | null = null;
    for (const node of nodesRef.current) {
      const dx = (node.x || 0) - simX;
      const dy = (node.y || 0) - simY;
      if (Math.sqrt(dx * dx + dy * dy) <= node.targetRadius + 6) {
        clickedNode = node;
        break;
      }
    }

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      clickedNode.fx = clickedNode.x;
      clickedNode.fy = clickedNode.y;
      setSelectedNode(clickedNode);
      if (clickedNode.category_id && onSelectCategory) {
        onSelectCategory(clickedNode.category_id);
      }
    } else {
      isDraggingCanvasRef.current = true;
      dragStartRef.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
      setSelectedNode(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    if (draggedNodeRef.current) {
      const simX = (clientX - (centerX + transformRef.current.x)) / transformRef.current.k;
      const simY = (clientY - (centerY + transformRef.current.y)) / transformRef.current.k;
      draggedNodeRef.current.fx = simX;
      draggedNodeRef.current.fy = simY;
      return;
    }

    if (isDraggingCanvasRef.current) {
      transformRef.current.x = e.clientX - dragStartRef.current.x;
      transformRef.current.y = e.clientY - dragStartRef.current.y;
      return;
    }

    // Hover detection
    const simX = (clientX - (centerX + transformRef.current.x)) / transformRef.current.k;
    const simY = (clientY - (centerY + transformRef.current.y)) / transformRef.current.k;
    let foundHover: SimNode | null = null;
    for (const node of nodesRef.current) {
      const dx = (node.x || 0) - simX;
      const dy = (node.y || 0) - simY;
      if (Math.sqrt(dx * dx + dy * dy) <= node.targetRadius + 6) {
        foundHover = node;
        break;
      }
    }
    setHoveredNode(foundHover);
  };

  const handlePointerUp = () => {
    if (draggedNodeRef.current) {
      draggedNodeRef.current.fx = null;
      draggedNodeRef.current.fy = null;
      draggedNodeRef.current = null;
    }
    isDraggingCanvasRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    transformRef.current.k = Math.min(2.5, Math.max(0.4, transformRef.current.k * zoomFactor));
  };

  const resetView = () => {
    transformRef.current = { x: 0, y: 0, k: 1 };
  };

  return (
    <div ref={containerRef} className="relative w-full h-[420px] rounded-2xl bg-[#090A0F] border border-white/10 overflow-hidden shadow-inner flex flex-col">
      
      {/* Top Overlay Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-xs">
          <Zap className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span className="font-semibold text-gray-200">Behavior Embedding:</span>
          <span className="text-purple-300 font-bold">{data.archetype}</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            onClick={() => setShowControls((p) => !p)}
            className="p-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Physics Engine Controls"
          >
            <Sliders className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="p-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Recenter Camera"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Physics Engine Controls Slider Drawer */}
      {showControls && (
        <div className="absolute top-14 right-3 z-20 w-64 p-3 rounded-2xl bg-black/90 backdrop-blur-xl border border-white/15 shadow-2xl text-xs space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-white/10">
            <span className="font-bold text-gray-200">Graph Physics Controls</span>
            <button
              onClick={() => setIsPaused((p) => !p)}
              className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30"
            >
              {isPaused ? "Resume" : "Pause"}
            </button>
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>Gravity Pull</span>
              <span>{Math.round(gravity * 1000)}</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.1"
              step="0.005"
              value={gravity}
              onChange={(e) => setGravity(parseFloat(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>Node Repulsion</span>
              <span>{repulsion}</span>
            </div>
            <input
              type="range"
              min="100"
              max="700"
              step="20"
              value={repulsion}
              onChange={(e) => setRepulsion(parseFloat(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>Link Tension</span>
              <span>{Math.round(linkStiffness * 100)}</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.15"
              step="0.01"
              value={linkStiffness}
              onChange={(e) => setLinkStiffness(parseFloat(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>
        </div>
      )}

      {/* Main Interactive HTML5 Canvas */}
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
      />

      {/* Floating Node Information Card on Select/Hover */}
      {(hoveredNode || selectedNode) && (
        <div className="absolute bottom-3 left-3 right-3 z-10 p-3 rounded-xl bg-black/85 backdrop-blur-xl border border-white/15 shadow-xl flex items-center justify-between text-xs animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm"
              style={{ backgroundColor: (hoveredNode || selectedNode)?.color }}
            />
            <div>
              <p className="font-bold text-gray-100">{(hoveredNode || selectedNode)?.label}</p>
              <p className="text-[11px] text-gray-400">
                {(hoveredNode || selectedNode)?.type === "user"
                  ? `Total Logged: ${FORMAT_INR((hoveredNode || selectedNode)?.amount || 0)}`
                  : (hoveredNode || selectedNode)?.type === "category"
                  ? `Category Total: ${FORMAT_INR((hoveredNode || selectedNode)?.amount || 0)} (${(hoveredNode || selectedNode)?.metadata?.percentage || 0}% of spend)`
                  : (hoveredNode || selectedNode)?.metadata?.description || "Peer cluster"}
              </p>
            </div>
          </div>
          {(hoveredNode || selectedNode)?.type === "category" && (
            <span className="text-[10px] uppercase font-semibold px-2 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Gravity Node
            </span>
          )}
        </div>
      )}
    </div>
  );
};
