"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "signature_pad";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

type ExistingSignature = {
  signatureImageUrl: string;
  signedAt: Date;
  signerName: string;
  signerTitle: string;
};

type Props = {
  title: string;
  description: string;
  existing: ExistingSignature | null;
  /** Motivo por el que no se puede firmar todavía. */
  blockedReason: string | null;
  onSign: (dataUrl: string) => Promise<{ ok: boolean; message?: string }>;
};

export function SignatureCapture({
  title,
  description,
  existing,
  blockedReason,
  onSign,
}: Props) {
  const { locale, t } = useLanguage();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [resigning, setResigning] = useState(false);

  const showCanvas = (!existing || resigning) && !blockedReason;

  /**
   * El canvas se dibuja en píxeles físicos y se escala por CSS. Sin esto, la
   * firma sale borrosa y desalineada del puntero en pantallas HiDPI.
   */
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    if (!canvas || !pad) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const { width, height } = canvas.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    pad.clear();
    setIsEmpty(true);
  }, []);

  useEffect(() => {
    if (!showCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePad(canvas, {
      penColor: "#0f172a",
      backgroundColor: "rgba(255,255,255,0)",
    });
    padRef.current = pad;

    const handleEnd = () => setIsEmpty(pad.isEmpty());
    pad.addEventListener("endStroke", handleEnd);

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      pad.removeEventListener("endStroke", handleEnd);
      window.removeEventListener("resize", resizeCanvas);
      pad.off();
      padRef.current = null;
    };
  }, [showCanvas, resizeCanvas]);

  function handleClear() {
    padRef.current?.clear();
    setIsEmpty(true);
    setError(null);
  }

  function handleSign() {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      setError(t("signature.drawFirst"));
      return;
    }

    setError(null);
    // toDataURL() del canvas, no pad.toDataURL("image/svg+xml"): el PDF y el
    // almacenamiento esperan PNG.
    const dataUrl = pad.toDataURL("image/png");

    startTransition(async () => {
      const result = await onSign(dataUrl);
      if (!result.ok) {
        setError(result.message ?? t("signature.saveError"));
        return;
      }
      setResigning(false);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border bg-white p-4">
      <div className="mb-1 text-sm font-semibold">{title}</div>
      <p className="mb-3 text-xs text-muted-foreground">{description}</p>

      {blockedReason && (
        <p className="rounded-lg border border-warning/25 bg-warning-muted px-3 py-2 text-xs text-warning">
          {blockedReason}
        </p>
      )}

      {existing && !resigning && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existing.signatureImageUrl}
              alt={t("signature.alt", { name: existing.signerName })}
              className="h-24 object-contain"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {t("signature.signedBy", {
              name: existing.signerName,
              title: existing.signerTitle,
              date: formatDate(existing.signedAt, locale),
            })}
          </div>
          {!blockedReason && (
            <Button type="button" variant="outline" onClick={() => setResigning(true)}>
              {t("signature.resign")}
            </Button>
          )}
        </div>
      )}

      {showCanvas && (
        <div className="space-y-3">
          <canvas
            ref={canvasRef}
            className="h-40 w-full touch-none rounded-lg border-2 border-dashed border-input bg-white focus-visible:border-primary focus-visible:outline-none"
          />

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="button" onClick={handleSign} disabled={isPending || isEmpty}>
              {isPending ? t("common.saving") : t("signature.sign")}
            </Button>
            <Button type="button" variant="outline" onClick={handleClear} disabled={isPending}>
              {t("signature.clear")}
            </Button>
            {existing && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setResigning(false)}
                disabled={isPending}
              >
                {t("common.cancel")}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
