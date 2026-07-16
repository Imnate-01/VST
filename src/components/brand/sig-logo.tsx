import Image from "next/image";
import { cn } from "@/lib/utils";

export function SigLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      width={2000}
      height={1303}
      alt="SIG"
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}
