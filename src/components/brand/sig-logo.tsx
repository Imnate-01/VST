import { cn } from "@/lib/utils";

/**
 * Lettermark SIG.
 *
 * Reconstrucción vectorial: si tenés el asset oficial de marca, reemplazá este
 * componente y `public/sig-logo.svg` por él. Usa `currentColor` para poder
 * pintarse en azul sobre fondo claro o en blanco sobre el azul corporativo.
 */
export function SigLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 130"
      role="img"
      aria-label="SIG"
      className={cn("h-8 w-auto", className)}
    >
      <ellipse
        cx="100"
        cy="65"
        rx="92"
        ry="57"
        fill="none"
        stroke="currentColor"
        strokeWidth="13"
      />
      <text
        x="100"
        y="65"
        fill="currentColor"
        fontFamily="Helvetica, Arial, sans-serif"
        fontSize="64"
        fontWeight="700"
        fontStyle="italic"
        letterSpacing="-2"
        textAnchor="middle"
        dominantBaseline="central"
      >
        SIG
      </text>
    </svg>
  );
}
