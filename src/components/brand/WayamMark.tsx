import wayamIcon from "@/assets/wayam-icon.svg";
import wayamLogoDark from "@/assets/wayam-logo-dark.svg";

export function WayamMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src={wayamIcon}
      alt="Vakyam Voice Agents by Wayam"
      width={size}
      height={size}
      className={`shrink-0 rounded-md ${className}`}
    />
  );
}

export function WayamLogo({ height = 72, className = "" }: { height?: number; className?: string }) {
  return (
    <img
      src={wayamLogoDark}
      alt="Vakyam Voice Agents by Wayam"
      style={{ height, width: "auto" }}
      className={`shrink-0 ${className}`}
    />
  );
}
