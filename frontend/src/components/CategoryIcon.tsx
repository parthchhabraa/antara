"use client";

import React from "react";
import * as Icons from "./icons";
import { Category } from "@/types";

interface CategoryIconProps {
  category?: Category;
  size?: number;
  className?: string;
}

// Brief 9 (2026-09-06): resolves the taxonomy's `icon` key (now a plain
// glyph key like "utensils", not a Lucide component name) to one of
// Antara's own icons. A static object literal, not a dynamic namespace
// lookup — every key here is a real, statically-analyzable reference, so
// nothing unused can leak into the bundle the way `LucideIcons[name]` did.
const ICONS: Record<string, React.FC<{ size?: number; strokeWidth?: number; className?: string }>> = {
  utensils: Icons.IconUtensils,
  heart: Icons.IconHeart,
  "shopping-bag": Icons.IconShoppingBag,
  coins: Icons.IconCoins,
  dumbbell: Icons.IconDumbbell,
  car: Icons.IconCar,
  droplet: Icons.IconDroplet,
  film: Icons.IconFilm,
  clapperboard: Icons.IconClapperboard,
  laptop: Icons.IconLaptop,
  gamepad: Icons.IconGamepad,
  "piggy-bank": Icons.IconPiggyBank,
  "heart-hands": Icons.IconHeartHands,
  phone: Icons.IconPhone,
  book: Icons.IconBook,
  dice: Icons.IconDice,
  "graduation-cap": Icons.IconGraduationCap,
  "help-circle": Icons.IconHelpCircle,
};

// Renders the Cashew-style colored circular icon badge for a spend category.
export const CategoryIcon: React.FC<CategoryIconProps> = ({ category, size = 36, className = "" }) => {
  const color = category?.color || "#64748B";
  const IconComponent = (category?.icon && ICONS[category.icon]) || Icons.IconHelpCircle;

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
      <IconComponent size={size * 0.5} strokeWidth={2.25} />
    </div>
  );
};
