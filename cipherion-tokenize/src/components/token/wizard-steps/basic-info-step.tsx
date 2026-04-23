"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/token/image-upload";
import { ASSET_TEMPLATES, getTemplate } from "@/config/asset-templates";
import type { AssetType } from "@/types/token";

export interface BasicInfoData {
  name: string;
  symbol: string;
  decimals: number;
  description: string;
  assetType: AssetType;
  imageUri: string;
}

interface Props {
  data: BasicInfoData;
  onChange: (data: BasicInfoData) => void;
}

export function BasicInfoStep({ data, onChange }: Props) {
  const update = <K extends keyof BasicInfoData>(
    key: K,
    value: BasicInfoData[K]
  ) => {
    onChange({ ...data, [key]: value });
  };

  const handleAssetTypeChange = (value: string) => {
    const assetType = value as AssetType;
    const template = getTemplate(assetType);
    update("assetType", assetType);
    if (template && !data.name) {
      onChange({
        ...data,
        assetType,
        decimals: template.defaultDecimals,
      });
    } else {
      update("assetType", assetType);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-[#f0f6fc] mb-1">
          Basic Information
        </h2>
        <p className="text-xs text-[#8b949e]">
          Define the core identity of your RWA token.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-1 block">
            Asset Type
          </label>
          <Select value={data.assetType} onValueChange={handleAssetTypeChange}>
            <SelectTrigger className="w-full border-[#30363d] bg-[#0d1117] text-[#f0f6fc]">
              <SelectValue placeholder="Select asset type">
                {
                  ASSET_TEMPLATES.find((t) => t.assetType === data.assetType)
                    ?.label
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              className="border-[#30363d] bg-[#161b22] w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]"
              position="popper"
            >
              {ASSET_TEMPLATES.map((t) => (
                <SelectItem key={t.assetType} value={t.assetType}>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-[#f0f6fc] text-sm">{t.label}</span>
                    <span className="text-[#8b949e] text-[11px] leading-snug whitespace-normal">
                      {t.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-1 block">
            Token Name *
          </label>
          <Input
            value={data.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. CipheX Treasury Fund A"
            maxLength={32}
            className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] placeholder:text-[#484f58]"
          />
          <p className="mt-1 text-[10px] text-[#8b949e]">
            {data.name.length}/32
          </p>
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-1 block">
            Symbol *
          </label>
          <Input
            value={data.symbol}
            onChange={(e) => update("symbol", e.target.value.toUpperCase())}
            placeholder="e.g. CTF-A"
            maxLength={10}
            className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono placeholder:text-[#484f58]"
          />
          {data.symbol && !/^[A-Z0-9-]{2,10}$/.test(data.symbol) && (
            <p className="mt-1 text-[10px] text-[#f85149]">
              2-10 chars: uppercase letters, numbers, hyphens only
            </p>
          )}
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-1 block">
            Decimals *
          </label>
          <Input
            type="number"
            value={data.decimals}
            onChange={(e) =>
              update("decimals", Math.min(9, Math.max(0, parseInt(e.target.value) || 0)))
            }
            min={0}
            max={9}
            className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc]"
          />
          <p className="mt-1 text-[10px] text-[#8b949e]">
            6 = USDC-like precision, 0 = whole units only
          </p>
        </div>

        <div>
          <ImageUpload
            value={data.imageUri}
            onChange={(uri) => update("imageUri", uri)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-1 block">
            Description
          </label>
          <textarea
            value={data.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Brief description of the underlying asset"
            rows={3}
            maxLength={200}
            className="w-full rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] placeholder:text-[#484f58] focus:outline-none focus:ring-2 focus:ring-[#238636]/50 focus:border-[#238636]"
          />
          <p className="mt-1 text-[10px] text-[#8b949e]">
            {data.description.length}/200
          </p>
        </div>
      </div>
    </div>
  );
}
