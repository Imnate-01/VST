/**
 * Genera el número de reporte con el formato convencional:
 * CR_<Client>_<YYYYMMDD>_<ModelCode>_Rev<N>
 *
 * Ejemplo: CR_Nestle_20260512_CC_Rev0
 */

const MODEL_CODE_MAP: Record<string, string> = {
  SUREFILL_100: "CC",
};

export function generateReportNumber(params: {
  clientName: string;
  serviceDate: Date;
  fillerModelCode: string;
  revisionNumber: number;
}): string {
  const client = params.clientName
    .trim()
    .split(/\s+/)[0]
    ?.replace(/[^A-Za-z0-9]/g, "") ?? "Client";

  const dateStr = formatDateYYYYMMDD(params.serviceDate);
  const modelCode = MODEL_CODE_MAP[params.fillerModelCode] ?? params.fillerModelCode;

  const capitalizedClient = client.charAt(0).toUpperCase() + client.slice(1).toLowerCase();

  return `CR_${capitalizedClient}_${dateStr}_${modelCode}_Rev${params.revisionNumber}`;
}

function formatDateYYYYMMDD(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}
