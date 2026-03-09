import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Paintbrush } from "lucide-react";
import { useUpdateProjectColors } from "@/hooks/use-project-colors";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#0000FF", "#0066FF", "#00CCFF", "#660099", "#9933FF",
  "#CC0000", "#FF3333", "#FF6600", "#FF9933", "#FFA500",
  "#006633", "#00CC66", "#84D71A", "#FF44CC", "#FF0040",
  "#333333", "#666666", "#999999",
];

interface ProjectColorPickerProps {
  projectSlug: string;
  colorPrimary: string | null;
  colorAccent: string | null;
  colorBackground?: string | null;
  className?: string;
}

function ColorField({
  label,
  description,
  value,
  onChange,
  showPresets,
  placeholder,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  showPresets?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <p className="text-xs text-gray-500 -mt-1">{description}</p>
      <div className="flex items-center gap-2">
        {showPresets ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="w-10 h-10 rounded-lg border-2 border-gray-200 cursor-pointer hover:border-gray-400 transition-colors"
                style={{ backgroundColor: value }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3">
              <div className="grid grid-cols-6 gap-2">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn(
                      "w-8 h-8 rounded-md border-2 cursor-pointer hover:scale-110 transition-transform",
                      value === color ? "border-black" : "border-transparent",
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => onChange(color)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <div
            className="w-10 h-10 rounded-lg border-2 border-gray-200"
            style={{ backgroundColor: value || "#f9fafb" }}
          />
        )}
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-28 font-mono text-sm"
          maxLength={7}
        />
      </div>
    </div>
  );
}

export function ProjectColorPicker({
  projectSlug,
  colorPrimary,
  colorAccent,
  colorBackground,
  className,
}: ProjectColorPickerProps) {
  const [primary, setPrimary] = useState(colorPrimary || "#0000FF");
  const [accent, setAccent] = useState(colorAccent || "#FF44CC");
  const [background, setBackground] = useState(colorBackground || "");
  const updateColors = useUpdateProjectColors();

  const handleSave = () => {
    updateColors.mutate({
      idOrSlug: projectSlug,
      colors: {
        colorPrimary: primary,
        colorAccent: accent,
        colorBackground: background || null,
      },
    });
  };

  const isDirty =
    primary !== (colorPrimary || "#0000FF") ||
    accent !== (colorAccent || "#FF44CC") ||
    background !== (colorBackground || "");

  // Derive semantic shades from primary for the preview
  const alertRed = "#DC2626";
  const warningAmber = "#D97706";
  const successGreen = "#16A34A";

  return (
    <div className={cn("space-y-5", className)}>
      {/* Color Role Guide */}
      <div className="bg-gray-50 border rounded-lg p-3 text-xs text-gray-600 space-y-1.5">
        <p className="font-semibold text-gray-800 text-sm">How these colors are used</p>
        <div className="grid grid-cols-1 gap-1">
          <p><span className="font-medium text-gray-800">Primary</span> — Buttons, links, page titles, active navigation, and form focus rings. This is your brand's main identity color.</p>
          <p><span className="font-medium text-gray-800">Accent</span> — Secondary actions, tags, badges, category labels, and decorative borders. Should complement primary, not compete with it.</p>
          <p><span className="font-medium text-gray-800">Background</span> — Page fills, card surfaces, and section backgrounds. Leave blank to auto-generate a light tint from primary.</p>
        </div>
        <div className="border-t pt-1.5 mt-1.5 text-gray-500">
          <p><span className="font-medium text-gray-600">Alerts &amp; warnings</span> use standard semantic colors (red for errors, amber for warnings, green for success) — but their intensity should feel balanced with your primary and accent choices. Avoid a primary color that clashes with red or amber.</p>
        </div>
      </div>

      {/* Primary */}
      <ColorField
        label="Primary Color"
        description="Buttons, links, page titles, active navigation, form focus rings."
        value={primary}
        onChange={setPrimary}
        showPresets
      />

      {/* Accent */}
      <ColorField
        label="Accent Color"
        description="Secondary actions, tags, badges, category labels, decorative borders."
        value={accent}
        onChange={setAccent}
        showPresets
      />

      {/* Background */}
      <ColorField
        label="Background Color (optional)"
        description="Page fills, card surfaces, section backgrounds. Blank = auto-tint from primary."
        value={background}
        onChange={setBackground}
        placeholder="#FFFFFF"
      />

      {/* Live Preview */}
      <div className="rounded-lg border overflow-hidden">
        <div className="px-3 py-1.5 border-b bg-gray-50">
          <p className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Live Preview</p>
        </div>
        <div className="p-4 space-y-3" style={{ backgroundColor: background || `${primary}08` }}>
          {/* Title + Nav */}
          <div className="flex items-center gap-3">
            <div className="w-3 h-8 rounded-full" style={{ backgroundColor: primary }} />
            <div className="text-sm font-semibold" style={{ color: primary }}>
              Page Title
            </div>
            <div className="ml-auto flex gap-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: primary }}>Active</span>
              <span className="px-2 py-0.5 rounded text-[10px] text-gray-500 bg-white border">Inactive</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-md text-white text-xs font-medium" style={{ backgroundColor: primary }}>
              Save Changes
            </span>
            <span className="px-3 py-1.5 rounded-md border text-xs font-medium" style={{ borderColor: primary, color: primary }}>
              Cancel
            </span>
          </div>

          {/* Links + Tags */}
          <div className="flex items-center gap-3 text-xs">
            <span className="underline" style={{ color: primary }}>Link text</span>
            <span className="px-2 py-0.5 rounded-full text-white text-[10px] font-medium" style={{ backgroundColor: accent }}>Category</span>
            <span className="px-2 py-0.5 rounded-full border text-[10px]" style={{ borderColor: accent, color: accent }}>Tag</span>
          </div>

          {/* Alerts — semantic colors */}
          <div className="space-y-1.5 pt-1 border-t border-gray-200/50">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Alerts &amp; Warnings</p>
            <div className="flex items-center gap-2">
              <span className="flex-1 px-2.5 py-1.5 rounded text-[10px] font-medium border" style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA", color: alertRed }}>
                Error — Something went wrong
              </span>
              <span className="flex-1 px-2.5 py-1.5 rounded text-[10px] font-medium border" style={{ backgroundColor: "#FFFBEB", borderColor: "#FDE68A", color: warningAmber }}>
                Warning — Needs attention
              </span>
              <span className="flex-1 px-2.5 py-1.5 rounded text-[10px] font-medium border" style={{ backgroundColor: "#F0FDF4", borderColor: "#BBF7D0", color: successGreen }}>
                Success — All good
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <Button
        onClick={handleSave}
        disabled={!isDirty || updateColors.isPending}
        className="w-full"
        size="sm"
      >
        {updateColors.isPending ? "Saving..." : "Save Colors"}
      </Button>
    </div>
  );
}
