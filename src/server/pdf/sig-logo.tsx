import React from "react";
import { Ellipse, Svg, Text, View } from "@react-pdf/renderer";

/**
 * Lettermark SIG para el PDF.
 *
 * `<Image>` de @react-pdf/renderer solo acepta PNG y JPG, así que el logo se
 * dibuja con primitivas: una elipse de trazo y la lettermark encima, con la
 * Helvetica bold oblicua que ya viene incluida en todo PDF.
 *
 * Es una reconstrucción vectorial. Si tenés el asset oficial de marca en PNG,
 * reemplazá este componente por un <Image src={...} />.
 */
export function SigLogo({
  width,
  color = "#0A5AA5",
}: {
  width: number;
  color?: string;
}) {
  const height = width * 0.65;

  return (
    <View style={{ width, height, position: "relative" }}>
      <Svg viewBox="0 0 200 130" style={{ width, height }}>
        <Ellipse
          cx="100"
          cy="65"
          rx="92"
          ry="57"
          stroke={color}
          strokeWidth={13}
          fillOpacity={0}
        />
      </Svg>
      <Text
        style={{
          position: "absolute",
          top: height * 0.235,
          left: 0,
          width,
          textAlign: "center",
          fontFamily: "Helvetica-BoldOblique",
          fontSize: height * 0.5,
          color,
        }}
      >
        SIG
      </Text>
    </View>
  );
}
