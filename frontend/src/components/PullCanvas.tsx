"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { STARTER_CATEGORIES, FORMAT_INR } from "@/lib/constants";
import { Transaction } from "@/types";

interface PullNode {
  id: string;
  isEssential: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spent: number;
  r: number;
  pop: number;
  driftPhase: number;
}

interface PullCanvasProps {
  transactions: Transaction[];
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
}

// Two-pole force physics: categories with essential spend settle toward the
// "Need" pole, discretionary spend toward "Want", sized by how much has been
// spent. Untouched categories sit as faint outlined rings, unpulled.
export const PullCanvas: React.FC<PullCanvasProps> = ({ transactions, selectedId, onSelect }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<PullNode[] | null>(null);
  const tickRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  selectedIdRef.current = selectedId;

  const spentByCategory = useCallback(() => {
    const by: Record<string, number> = {};
    STARTER_CATEGORIES.forEach((c) => (by[c.id] = 0));
    transactions.forEach((t) => {
      by[t.category] = (by[t.category] || 0) + t.amount;
    });
    return by;
  }, [transactions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const step = () => {
      tickRef.current += 0.02;
      const rect = containerRef.current?.getBoundingClientRect() || { width: 360, height: 392 };
      const w = rect.width;
      const h = rect.height;

      const by = spentByCategory();
      if (!nodesRef.current) {
        nodesRef.current = STARTER_CATEGORIES.map((c, i) => ({
          id: c.id,
          isEssential: c.is_essential,
          x: w * (c.is_essential ? 0.3 : 0.7) + ((i % 4) - 1.5) * 24,
          y: h * 0.5 + ((i % 5) - 2) * 30,
          vx: 0,
          vy: 0,
          spent: 0,
          r: 5.5,
          pop: 0,
          driftPhase: Math.random() * Math.PI * 2,
        }));
      }
      const nodes = nodesRef.current;
      nodes.forEach((n) => {
        n.spent = by[n.id] || 0;
        n.r = n.spent === 0 ? 5.5 : 8 + Math.sqrt(n.spent) * 0.5;
        n.pop *= 0.88;
      });

      const needPole = { x: w * 0.27, y: h * 0.4 };
      const wantPole = { x: w * 0.72, y: h * 0.62 };

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const pole = a.isEssential ? needPole : wantPole;
        const k = a.spent > 0 ? 0.0026 : 0.0014;
        a.vx += (pole.x - a.x) * k;
        a.vy += (pole.y - a.y) * k;
        // idle ambient drift so the graph keeps breathing once it settles
        a.vx += Math.cos(tickRef.current * 0.4 + a.driftPhase) * 0.04;
        a.vy += Math.sin(tickRef.current * 0.5 + a.driftPhase * 1.3) * 0.04;

        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.01;
          const min = a.r + b.r + 15;
          if (d < min) {
            const f = ((min - d) / d) * 0.055;
            a.vx -= dx * f;
            a.vy -= dy * f;
            b.vx += dx * f;
            b.vy += dy * f;
          }
        }
        a.vx *= 0.9;
        a.vy *= 0.9;
        a.x += a.vx;
        a.y += a.vy;
        a.x = Math.max(a.r + 12, Math.min(w - a.r - 12, a.x));
        a.y = Math.max(a.r + 26, Math.min(h - a.r - 18, a.y));
      }

      ctx.clearRect(0, 0, w, h);
      ctx.font = "500 10px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(178,182,202,.55)";
      ctx.fillText("NEED", needPole.x - 15, 20);
      ctx.fillStyle = "rgba(139,92,246,.7)";
      ctx.fillText("WANT", wantPole.x - 15, h - 10);

      nodes.forEach((n) => {
        if (!n.spent) return;
        const pole = n.isEssential ? needPole : wantPole;
        ctx.strokeStyle = n.isEssential ? "rgba(178,182,202,.2)" : "rgba(139,92,246,.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pole.x, pole.y);
        ctx.lineTo(n.x, n.y);
        ctx.stroke();
      });

      nodes.forEach((n) => {
        const isSel = n.id === selectedIdRef.current;
        const r = n.r * (1 + n.pop * 0.35);
        if (!n.spent) {
          ctx.strokeStyle = "rgba(89,93,108,.85)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
          ctx.stroke();
          return;
        }
        if (isSel) {
          ctx.fillStyle = n.isEssential ? "rgba(178,182,202,.12)" : "rgba(139,92,246,.16)";
          ctx.beginPath();
          ctx.arc(n.x, n.y, r + 10, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = n.isEssential ? "#B2B6CA" : "#8B5CF6";
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
        if (isSel) {
          ctx.strokeStyle = "#E9E9ED";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        if (r > 13) {
          ctx.fillStyle = "rgba(16,18,32,.88)";
          const label = FORMAT_INR(n.spent);
          ctx.fillText(label, n.x - ctx.measureText(label).width / 2, n.y + 3.5);
        }
      });

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      window.removeEventListener("resize", resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [spentByCategory]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const nodes = nodesRef.current;
    if (!canvas || !nodes) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let hit: PullNode | null = null;
    nodes.forEach((n) => {
      if (Math.hypot(n.x - x, n.y - y) < n.r + 9) hit = n;
    });
    if (hit) {
      (hit as PullNode).pop = 1;
      onSelect((hit as PullNode).id);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full h-[392px]">
      <canvas ref={canvasRef} onClick={handleClick} className="block w-full h-full cursor-pointer touch-none" />
    </div>
  );
};
