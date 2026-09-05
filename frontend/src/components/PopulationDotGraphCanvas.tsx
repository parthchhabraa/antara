"use client";

import React, { useRef, useEffect, useState } from "react";
import { PopulationDotGraph, PopulationDotGraphNode } from "@/lib/api";

interface PopulationDotGraphCanvasProps {
  graph: PopulationDotGraph;
}

// Step 10 item 4 — population-level dot-graph preview, same visual language
// as PullCanvas/the per-user dot graph, but every dot is one survey
// respondent clustered against the app's fixed archetype definitions. Unlike
// PullCanvas this is a static plot, not a live physics sim — the backend
// (survey_etl.generate_population_dot_graph) already computes final x/y per
// node, so this component's only job is projecting that coordinate space
// onto the canvas and handling tap-for-detail.
export const PopulationDotGraphCanvas: React.FC<PopulationDotGraphCanvasProps> = ({ graph }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selected, setSelected] = useState<PopulationDotGraphNode | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const cx = w / 2;
    const cy = h / 2;
    // Fit the backend's coordinate space (roughly ±280 around origin) into
    // the canvas with some margin.
    const extent = 300;
    const scale = Math.min(w, h) / 2 / extent;
    const project = (x: number, y: number) => ({ px: cx + x * scale, py: cy + y * scale });

    ctx.clearRect(0, 0, w, h);

    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));

    // Links first, under the nodes.
    graph.links.forEach((link) => {
      const source = nodeById.get(link.source);
      const target = nodeById.get(link.target);
      if (!source || !target) return;
      const { px: sx, py: sy } = project(source.x, source.y);
      const { px: tx, py: ty } = project(target.x, target.y);
      ctx.strokeStyle = `rgba(255,255,255,${0.06 + link.strength * 0.12})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    });

    graph.nodes.forEach((n) => {
      const { px, py } = project(n.x, n.y);
      const isSel = selected?.id === n.id;
      // Fixed, bounded radii rather than scaling the backend's raw `size` by
      // the viewport scale factor directly — that compounded into circles
      // large enough to overlap and hide the archetype labels entirely once
      // there were more than a handful of respondent nodes.
      const r = n.type === "archetype_center" ? 16 : Math.max(4, Math.min(10, n.size * 0.35));

      if (n.type === "archetype_center") {
        ctx.strokeStyle = n.color + "88";
        ctx.fillStyle = n.color + "18";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(10, r), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.font = "600 9px Inter, system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        const label = n.label;
        ctx.fillText(label, px - ctx.measureText(label).width / 2, py + Math.max(10, r) + 12);
      } else {
        if (isSel) {
          ctx.fillStyle = n.color + "30";
          ctx.beginPath();
          ctx.arc(px, py, r + 6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(4, r), 0, Math.PI * 2);
        ctx.fill();
        if (isSel) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, selected]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const extent = 300;
    const scale = Math.min(rect.width, rect.height) / 2 / extent;

    let hit: PopulationDotGraphNode | null = null;
    let hitDist = Infinity;
    graph.nodes.forEach((n) => {
      if (n.type !== "survey_respondent") return;
      const px = cx + n.x * scale;
      const py = cy + n.y * scale;
      const d = Math.hypot(px - x, py - y);
      if (d < 16 && d < hitDist) {
        hit = n;
        hitDist = d;
      }
    });
    setSelected(hit);
  };

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="relative w-full h-[280px] rounded-lg border border-white/10 bg-[radial-gradient(120%_90%_at_50%_0%,#1b1e30,#121423)] overflow-hidden">
        <canvas ref={canvasRef} onClick={handleClick} className="block w-full h-full cursor-pointer touch-none" />
      </div>
      <p className="text-xs text-gray-600 leading-relaxed">{graph.note}</p>
      {selected && selected.type === "survey_respondent" && (
        <div className="p-2.5 rounded-sm bg-black/40 border border-white/5 text-xs text-gray-300">
          <div className="font-semibold text-white">{selected.label}</div>
          <div className="text-gray-500 mt-0.5">
            Best match: {selected.metadata.bestMatchArchetype} ({selected.metadata.similarityPct}% similarity) · total
            reported ₹{selected.metadata.totalReported}
          </div>
        </div>
      )}
      <div className="text-xs text-gray-600">
        {graph.respondentsPlotted} of {graph.sampleSize} responses plotted (responses with ₹0 total logged aren't placeable).
      </div>
    </div>
  );
};
