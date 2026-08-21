"use client";

import React from "react";
import * as LucideIcons from "lucide-react";
import { HelpCircle } from "lucide-react";
import { Category } from "@/types";

interface CategoryIconProps {
  category?: Category;
  size?: number;
  className?: string;
}

// Renders the Cashew-style colored circular icon badge for a spend category,
// resolving the taxonomy's Lucide icon name (e.g. "Utensils") to the actual
// icon component at render time.
export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 36, className = "" }) => {
  const color = category?.color || "#64748B";
  const IconComponent =
    (category?.icon && (LucideIcons as unknown as Record<string, React.ComponentType<any>>)[category.icon]) ||
    HelpCircle;

  return (
    <div
      className={`flex items-center justify-center rounded-full shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}22`,
        border: `1px solid ${color}55`,
        color,
      }}
    >
      <IconComponent style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.25} />
    </div>
  );
};
