import wayamIcon from "@/assets/wayam-icon.svg";

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
