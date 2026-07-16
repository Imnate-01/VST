/**
 * Veredicto que se imprime en la portada del PDF.
 *
 * Verde significa una sola cosa: todo lo que había que evaluar se evaluó y quedó
 * dentro de tolerancia. Un certificado sin capturar no es una aprobación, así
 * que "incompleto" es un estado propio y no puede colapsar a "pass".
 *
 * Precedencia: deviation > incomplete > pass. Un reporte con una falla y algo
 * pendiente se reporta por lo peor que tiene.
 */

export type Outcome = "pass" | "deviation" | "incomplete";

export type OutcomeColumn = {
  /** Fuera del alcance: no se evalúa y no cuenta para el veredicto. */
  excluded: boolean;
  status: string;
};

export type OutcomeCertificate = {
  overallStatus: string;
  columns: OutcomeColumn[];
};

export function evaluatedColumns(certificate: OutcomeCertificate): OutcomeColumn[] {
  // `NA` es un dispositivo que no aplica: igual que un excluido, no se juzga.
  return certificate.columns.filter(
    (column) => !column.excluded && column.status !== "NA"
  );
}

export function certificateOutcome(certificate: OutcomeCertificate): Outcome {
  const columns = evaluatedColumns(certificate);

  if (
    certificate.overallStatus === "FAIL" ||
    certificate.overallStatus === "MIXED" ||
    columns.some((column) => column.status === "FAIL")
  ) {
    return "deviation";
  }

  if (
    columns.length === 0 ||
    certificate.overallStatus === "PENDING" ||
    columns.some((column) => column.status !== "PASS")
  ) {
    return "incomplete";
  }

  return "pass";
}

export function reportOutcome(certificates: OutcomeCertificate[]): Outcome {
  if (certificates.length === 0) return "incomplete";

  const outcomes = certificates.map(certificateOutcome);
  if (outcomes.includes("deviation")) return "deviation";
  if (outcomes.includes("incomplete")) return "incomplete";
  return "pass";
}

export type ChannelCounts = {
  /** Canales dentro de tolerancia. */
  pass: number;
  /** Canales evaluables (excluye los excluidos y los N/A). */
  total: number;
};

export function countChannels(certificates: OutcomeCertificate[]): ChannelCounts {
  const columns = certificates.flatMap(evaluatedColumns);

  return {
    pass: columns.filter((column) => column.status === "PASS").length,
    total: columns.length,
  };
}
