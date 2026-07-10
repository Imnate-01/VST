# Notas de diseño de certificados

## Sistema visual (vigente)

El PDF y la app comparten el azul corporativo SIG (`#0A5AA5`, expuesto como
`sig-700` en Tailwind y como `--primary` en `globals.css`).

Reglas:

- **Azul para estructura**: encabezados de sección, cabeceras de tabla, bordes,
  chips de identificación. No para datos.
- **Ámbar para celdas capturables**. Es la convención del reporte en papel y
  codifica "esto lo escribe el técnico". No lo pintes de azul.
- **Verde / rojo para Pass/Fail y deviation**. También codifican información,
  no son decoración.
- Filas cebra suaves (`sig-50`), bordes finos, sin bloques de color saturado.
- Números en cifras tabulares (`.tabular`) para que las columnas se comparen
  visualmente.

Esto reemplaza la nota anterior que pedía encabezados beige/naranja: el pedido
vigente es una paleta corporativa azul. La regla que sí sobrevive es **no
replicar los bloques azules grandes y saturados del reporte legado**; el azul va
en barras finas y fondos claros.

## Logo

`src/components/brand/sig-logo.tsx` (web) y `src/server/pdf/sig-logo.tsx` (PDF)
son **reconstrucciones vectoriales** de la lettermark. `<Image>` de
`@react-pdf/renderer` solo acepta PNG y JPG, por eso la versión del PDF se dibuja
con primitivas `<Svg>` en vez de importar `public/sig-logo.svg`.

Si conseguís el asset oficial de marca, reemplazá los tres archivos. Para el PDF
necesitás un PNG.

## Certificados todavía sin UI

`ULTRASONIC`, `METERING_PUMP_CHAMBER`, `METERING_PUMP_TUNNEL` (layout
`TEST_READINGS`) y `EXHAUST` (layout `VERIFICATION`) tienen schema, evaluador de
dominio y tests, pero no formulario. `getReportForPdf` los filtra con
`isPointLayout`, así que tampoco aparecen en el PDF.
