"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, X, Image as ImageIcon, Loader2, AlertCircle } from "lucide-react";
import { uploadImageToIpfs, isPinataConfigured } from "@/lib/pinata";
import { TokenServiceError } from "@/lib/solana/types";

interface ImageUploadProps {
  value: string; // current URI (ipfs:// or https://)
  onChange: (uri: string) => void;
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pinataReady, setPinataReady] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    isPinataConfigured().then((ready) => {
      if (!cancelled) setPinataReady(ready);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsUploading(true);

      // Show local preview immediately
      const localUrl = URL.createObjectURL(file);
      setPreview(localUrl);

      try {
        const { ipfsUri, gatewayUrl } = await uploadImageToIpfs(file);
        setPreview(gatewayUrl);
        onChange(ipfsUri);
      } catch (err) {
        const message =
          err instanceof TokenServiceError
            ? err.message
            : "Upload failed. Try again.";
        setError(message);
        setPreview(null);
        onChange("");
      } finally {
        setIsUploading(false);
      }
    },
    [onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleClear = () => {
    setPreview(null);
    setError(null);
    onChange("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (pinataReady === null) {
    return (
      <div>
        <label className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-1 block">
          Token Image
        </label>
        <div className="h-20 w-full rounded-lg border border-dashed border-[#30363d] bg-[#0d1117] animate-pulse" />
      </div>
    );
  }

  // If Pinata isn't configured, show a manual URI input fallback
  if (!pinataReady) {
    return (
      <div>
        <label className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-1 block">
          Token Image URI
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https:// or ipfs:// — paste image URL"
            className="flex-1 rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-[#f0f6fc] placeholder:text-[#484f58] focus:outline-none focus:ring-2 focus:ring-[#238636]/50"
          />
        </div>
        <p className="mt-1 text-[10px] text-[#8b949e]">
          Set PINATA_JWT on the server to enable drag-and-drop image uploads.
        </p>
      </div>
    );
  }

  const displayUrl =
    preview ||
    (value && value.startsWith("ipfs://")
      ? `https://${process.env.NEXT_PUBLIC_PINATA_GATEWAY || "gateway.pinata.cloud"}/ipfs/${value.replace("ipfs://", "")}`
      : value || null);

  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-[#8b949e] mb-1 block">
        Token Image
      </label>

      {displayUrl && !error ? (
        <div className="relative inline-block">
          <div className="relative h-20 w-20 rounded-lg border border-[#30363d] bg-[#0d1117] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={displayUrl}
              alt="Token image"
              className="h-full w-full object-cover"
            />
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Loader2 className="size-5 text-white animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={handleClear}
            className="absolute -top-1.5 -right-1.5 rounded-full bg-[#21262d] border border-[#30363d] p-0.5 text-[#8b949e] hover:text-[#f85149] hover:bg-[rgba(248,81,73,0.15)] transition-colors"
          >
            <X className="size-3" />
          </button>
          {value && (
            <p className="mt-1 font-mono text-[10px] text-[#8b949e] max-w-[200px] truncate">
              {value}
            </p>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors ${
            dragOver
              ? "border-[#238636] bg-[rgba(35,134,54,0.05)]"
              : "border-[#30363d] bg-[#0d1117] hover:border-[#484f58]"
          }`}
        >
          {isUploading ? (
            <Loader2 className="size-6 text-[#8b949e] animate-spin mb-2" />
          ) : (
            <Upload className="size-6 text-[#8b949e] mb-2" />
          )}
          <p className="text-xs text-[#8b949e]">
            {isUploading
              ? "Uploading to IPFS..."
              : "Drop image here or click to upload"}
          </p>
          <p className="text-[10px] text-[#484f58] mt-1">
            PNG, JPG, WebP, SVG, GIF — max 4MB
          </p>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-[#f85149]">
          <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
