import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Image } from "@react-pdf/renderer";

const logoSource = {
  data: readFileSync(join(process.cwd(), "public", "logo.png")),
  format: "png" as const,
};

export function SigLogo({ width }: { width: number }) {
  return (
    // @react-pdf/renderer Image is a PDF primitive and does not support alt.
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      src={logoSource}
      style={{ width, height: width * (1303 / 2000), objectFit: "contain" }}
    />
  );
}
