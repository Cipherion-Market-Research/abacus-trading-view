"use client";

import {
  Landmark,
  Building2,
  Gem,
  TrendingUp,
  FileText,
  BarChart3,
  Boxes,
  type LucideIcon,
} from "lucide-react";
import type { AssetType } from "@/types/token";

interface AssetTypeVisual {
  icon: LucideIcon;
  color: string;
  tint: string;
}

const ASSET_TYPE_VISUAL: Record<AssetType, AssetTypeVisual> = {
  treasury: {
    icon: Landmark,
    color: "#3fb950",
    tint: "rgba(63,185,80,0.15)",
  },
  real_estate: {
    icon: Building2,
    color: "#58a6ff",
    tint: "rgba(88,166,255,0.15)",
  },
  commodity: {
    icon: Gem,
    color: "#d29922",
    tint: "rgba(210,153,34,0.15)",
  },
  equity: {
    icon: TrendingUp,
    color: "#a371f7",
    tint: "rgba(163,113,247,0.15)",
  },
  debt: {
    icon: FileText,
    color: "#f85149",
    tint: "rgba(248,81,73,0.15)",
  },
  fund: {
    icon: BarChart3,
    color: "#22d3ee",
    tint: "rgba(34,211,238,0.15)",
  },
  other: {
    icon: Boxes,
    color: "#8b949e",
    tint: "rgba(139,148,158,0.15)",
  },
};

interface TokenAvatarProps {
  imageUri?: string;
  assetType?: AssetType;
  /** Pixel size of the square. Defaults to 40. */
  size?: number;
  /** Override the rounding (default `rounded-lg`). */
  rounded?: string;
  className?: string;
}

function resolveImageUrl(uri: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    const gateway =
      process.env.NEXT_PUBLIC_PINATA_GATEWAY || "gateway.pinata.cloud";
    return `https://${gateway}/ipfs/${uri.replace("ipfs://", "")}`;
  }
  if (uri.startsWith("http")) return uri;
  return null;
}

export function TokenAvatar({
  imageUri,
  assetType,
  size = 40,
  rounded = "rounded-lg",
  className,
}: TokenAvatarProps) {
  const url = imageUri ? resolveImageUrl(imageUri) : null;
  const visual =
    assetType && assetType in ASSET_TYPE_VISUAL
      ? ASSET_TYPE_VISUAL[assetType]
      : ASSET_TYPE_VISUAL.other;
  const Icon = visual.icon;
  const iconSize = Math.round(size * 0.5);

  if (url) {
    return (
      <div
        className={`shrink-0 ${rounded} border border-[#30363d] bg-[#0d1117] overflow-hidden ${className ?? ""}`}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`shrink-0 ${rounded} flex items-center justify-center ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: visual.tint,
        color: visual.color,
      }}
    >
      <Icon style={{ width: iconSize, height: iconSize }} />
    </div>
  );
}
