"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTemplate } from "@/config/asset-templates";
import type { AssetType, RegulatoryFramework, TokenMetadataField } from "@/types/token";

export interface MetadataData {
  fields: TokenMetadataField[];
  externalUri: string;
  jurisdiction: string;
  regulatoryFramework: string;
}

interface Props {
  data: MetadataData;
  assetType: AssetType;
  onChange: (data: MetadataData) => void;
}

const FRAMEWORKS: { value: RegulatoryFramework; label: string }[] = [
  { value: "none", label: "None / Not Applicable" },
  { value: "reg_d", label: "Reg D (US Private Placement)" },
  { value: "reg_s", label: "Reg S (US Offshore)" },
  { value: "reg_a_plus", label: "Reg A+ (US Mini-IPO)" },
  { value: "mifid2", label: "MiFID II (EU)" },
];

export function MetadataStep({ data, assetType, onChange }: Props) {
  // Pre-populate fields from template if empty
  useEffect(() => {
    if (data.fields.length === 0) {
      const template = getTemplate(assetType);
      if (template) {
        onChange({
          ...data,
          fields: template.metadataFields,
          regulatoryFramework: template.defaultFramework,
        });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = (index: number, key: string, value: string) => {
    const newFields = [...data.fields];
    newFields[index] = { ...newFields[index], [key === "fieldKey" ? "key" : "value"]: key === "fieldKey" ? value : value };
    onChange({ ...data, fields: newFields });
  };

  const updateFieldKey = (index: number, newKey: string) => {
    const newFields = [...data.fields];
    newFields[index] = { ...newFields[index], key: newKey };
    onChange({ ...data, fields: newFields });
  };

  const updateFieldValue = (index: number, newValue: string) => {
    const newFields = [...data.fields];
    newFields[index] = { ...newFields[index], value: newValue };
    onChange({ ...data, fields: newFields });
  };

  const MAX_FIELDS = 20;

  const addField = () => {
    if (data.fields.length >= MAX_FIELDS) return;
    onChange({ ...data, fields: [...data.fields, { key: "", value: "" }] });
  };

  const removeField = (index: number) => {
    onChange({ ...data, fields: data.fields.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FileText className="size-4 text-[#a371f7]" />
          <h2 className="text-sm font-semibold text-[#f0f6fc]">
            On-Chain Metadata
          </h2>
        </div>
        <p className="text-xs text-[#8b949e]">
          Stored directly on the token mint. Visible to all wallets and explorers.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-1 block">
            Jurisdiction
          </label>
          <Input
            value={data.jurisdiction}
            onChange={(e) =>
              onChange({ ...data, jurisdiction: e.target.value })
            }
            placeholder="e.g. US, CA, EU"
            maxLength={32}
            className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] placeholder:text-[#484f58]"
          />
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-1 block">
            Regulatory Framework
          </label>
          <Select
            value={data.regulatoryFramework}
            onValueChange={(v) =>
              onChange({ ...data, regulatoryFramework: v })
            }
          >
            <SelectTrigger className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[#30363d] bg-[#161b22]">
              {FRAMEWORKS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2">
          <label className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-1 block">
            External Document URI
          </label>
          <Input
            value={data.externalUri}
            onChange={(e) =>
              onChange({ ...data, externalUri: e.target.value })
            }
            placeholder="https:// or ipfs:// — link to prospectus or legal docs"
            maxLength={200}
            className="border-[#30363d] bg-[#0d1117] text-[#f0f6fc] placeholder:text-[#484f58]"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-[11px] uppercase tracking-wider text-[#8b949e]">
            Additional Metadata Fields
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={addField}
            disabled={data.fields.length >= MAX_FIELDS}
            className="gap-1 text-xs text-[#58a6ff] hover:text-[#58a6ff] hover:bg-[rgba(88,166,255,0.1)] disabled:opacity-40"
          >
            <Plus className="size-3" />
            Add Field ({data.fields.length}/{MAX_FIELDS})
          </Button>
        </div>
        <div className="space-y-2">
          {data.fields.map((field, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={field.key}
                onChange={(e) => updateFieldKey(i, e.target.value)}
                placeholder="Key"
                maxLength={32}
                className="flex-1 border-[#30363d] bg-[#0d1117] text-[#f0f6fc] font-mono text-xs placeholder:text-[#484f58]"
              />
              <Input
                value={field.value}
                onChange={(e) => updateFieldValue(i, e.target.value)}
                placeholder="Value"
                maxLength={128}
                className="flex-1 border-[#30363d] bg-[#0d1117] text-[#f0f6fc] text-xs placeholder:text-[#484f58]"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeField(i)}
                className="shrink-0 text-[#8b949e] hover:text-[#f85149] hover:bg-[rgba(248,81,73,0.1)]"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          {data.fields.length === 0 && (
            <p className="text-xs text-[#484f58] text-center py-3">
              No additional metadata fields. Click "Add Field" to add key-value pairs.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
