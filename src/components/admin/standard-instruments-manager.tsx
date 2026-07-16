"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import {
  deleteStandardInstrument,
  saveStandardInstrument,
} from "@/server/actions/standard-instruments";

export type StandardInstrumentItem = {
  id: string;
  description: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  calibrationCertNumber: string;
  calibrationDate: string;
  calibrationExpiresAt: string;
  active: boolean;
  linkedReports: number;
};

type Validity = "ALL" | "VALID" | "SOON" | "EXPIRED" | "INACTIVE";
const PAGE_SIZE = 5;

function validityOf(instrument: StandardInstrumentItem): Exclude<Validity, "ALL"> {
  if (!instrument.active) return "INACTIVE";
  const expiry = new Date(`${instrument.calibrationExpiresAt}T23:59:59.999Z`).getTime();
  const days = Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "EXPIRED";
  if (days <= 30) return "SOON";
  return "VALID";
}

export function StandardInstrumentsManager({
  instruments,
}: {
  instruments: StandardInstrumentItem[];
}) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [maker, setMaker] = useState("ALL");
  const [validity, setValidity] = useState<Validity>("ALL");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StandardInstrumentItem | null>(null);
  const [deleting, setDeleting] = useState<StandardInstrumentItem | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const makers = useMemo(
    () => [...new Set(instruments.map((instrument) => instrument.manufacturer))].sort(),
    [instruments]
  );
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return instruments.filter((instrument) => {
      const matchesSearch =
        !needle ||
        instrument.description.toLowerCase().includes(needle) ||
        instrument.serialNumber.toLowerCase().includes(needle) ||
        instrument.calibrationCertNumber.toLowerCase().includes(needle) ||
        instrument.model.toLowerCase().includes(needle);
      return (
        matchesSearch &&
        (maker === "ALL" || instrument.manufacturer === maker) &&
        (validity === "ALL" || validityOf(instrument) === validity)
      );
    });
  }, [instruments, maker, search, validity]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  function openCreate() {
    setEditing(null);
    setFeedback(null);
    setFormOpen(true);
  }

  function openEdit(instrument: StandardInstrumentItem) {
    setEditing(instrument);
    setFeedback(null);
    setFormOpen(true);
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 border-b pb-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold leading-tight">{t("admin.standardsTitle")}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{t("admin.standardsDescription")}</p>
        </div>
        <Button type="button" size="lg" className="shrink-0" onClick={openCreate}>
          <Plus className="h-5 w-5" /> {t("standardsAdmin.newInstrument")}
        </Button>
      </header>

      <section className="flex flex-col gap-3 border-b pb-7 lg:flex-row">
        <label className="relative min-w-0 flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">{t("standardsAdmin.search")}</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t("standardsAdmin.search")}
            className="h-12 w-full rounded-xl border border-input bg-white pl-12 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <select
          value={maker}
          onChange={(event) => {
            setMaker(event.target.value);
            setPage(1);
          }}
          aria-label={t("standardsAdmin.maker")}
          className="h-12 min-w-44 rounded-xl border border-input bg-white px-4 pr-9 text-sm font-semibold"
        >
          <option value="ALL">{t("standardsAdmin.maker")}: {t("standardsAdmin.allMakers")}</option>
          {makers.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          value={validity}
          onChange={(event) => {
            setValidity(event.target.value as Validity);
            setPage(1);
          }}
          aria-label={t("standardsAdmin.validity")}
          className="h-12 min-w-44 rounded-xl border border-input bg-white px-4 pr-9 text-sm font-semibold"
        >
          <option value="ALL">{t("standardsAdmin.validity")}: {t("standardsAdmin.allValidity")}</option>
          <option value="VALID">{t("dashboard.valid")}</option>
          <option value="SOON">{t("dashboard.expiringSoon")}</option>
          <option value="EXPIRED">{t("dashboard.expired")}</option>
          <option value="INACTIVE">{t("standardsAdmin.inactive")}</option>
        </select>
      </section>

      {feedback && (
        <div className="rounded-xl border border-success/25 bg-success-muted px-4 py-3 text-sm text-success" role="status">
          {feedback}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="overflow-x-auto">
          <table className="table-modern min-w-[1120px]">
            <thead>
              <tr>
                <th>{t("standardsAdmin.description")}</th>
                <th>{t("standardsAdmin.maker")}</th>
                <th>{t("admin.model")}</th>
                <th>{t("admin.serial")}</th>
                <th>{t("admin.certificate")}</th>
                <th>{t("standardsAdmin.calibrationDate")}</th>
                <th>{t("standardsAdmin.validity")}</th>
                <th><span className="sr-only">{t("reports.column.action")}</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((instrument) => (
                <tr key={instrument.id} className={cn(!instrument.active && "opacity-60")}>
                  <td className="font-semibold">{instrument.description}</td>
                  <td>{instrument.manufacturer}</td>
                  <td className="technical-id text-muted-foreground">{instrument.model}</td>
                  <td className="technical-id text-muted-foreground">{instrument.serialNumber}</td>
                  <td className="technical-id text-muted-foreground">{instrument.calibrationCertNumber}</td>
                  <td className="technical-id text-muted-foreground">{instrument.calibrationDate}</td>
                  <td><ValidityBadge instrument={instrument} /></td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => openEdit(instrument)}
                        aria-label={`${t("standardsAdmin.edit")}: ${instrument.description}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          setFeedback(null);
                          setDeleting(instrument);
                        }}
                        aria-label={`${t("standardsAdmin.delete")}: ${instrument.description}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {t("standardsAdmin.showing", {
            from: filtered.length === 0 ? 0 : start + 1,
            to: Math.min(start + PAGE_SIZE, filtered.length),
            total: filtered.length,
          })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={currentPage === 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            aria-label={t("standardsAdmin.previous")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
            <Button
              key={number}
              type="button"
              variant={number === currentPage ? "default" : "outline"}
              size="icon"
              onClick={() => setPage(number)}
              aria-label={`${number}`}
            >
              {number}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={currentPage === pageCount}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            aria-label={t("standardsAdmin.next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <InstrumentFormDialog
        key={`${editing?.id ?? "new"}-${formOpen}`}
        open={formOpen}
        instrument={editing}
        onOpenChange={setFormOpen}
        onSaved={(message) => {
          setFormOpen(false);
          setFeedback(message);
        }}
      />
      <DeleteInstrumentDialog
        instrument={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={(message) => {
          setDeleting(null);
          setFeedback(message);
        }}
      />
    </div>
  );
}

function ValidityBadge({ instrument }: { instrument: StandardInstrumentItem }) {
  const { t } = useLanguage();
  const state = validityOf(instrument);
  const Icon = state === "VALID" ? Check : state === "SOON" ? Clock3 : TriangleAlert;
  return (
    <span
      className={cn(
        "status-badge",
        state === "VALID" && "border-success/25 bg-success-muted text-success",
        state === "SOON" && "border-warning/25 bg-warning-muted text-warning",
        (state === "EXPIRED" || state === "INACTIVE") &&
          "border-destructive/25 bg-destructive/5 text-destructive"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {state === "VALID"
        ? t("dashboard.valid")
        : state === "SOON"
          ? t("dashboard.expiringSoon")
          : state === "EXPIRED"
            ? t("dashboard.expired")
            : t("standardsAdmin.inactive")}
    </span>
  );
}

function InstrumentFormDialog({
  open,
  instrument,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  instrument: StandardInstrumentItem | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState({
    description: instrument?.description ?? "",
    manufacturer: instrument?.manufacturer ?? "",
    model: instrument?.model ?? "",
    serialNumber: instrument?.serialNumber ?? "",
    calibrationCertNumber: instrument?.calibrationCertNumber ?? "",
    calibrationDate: instrument?.calibrationDate ?? "",
    calibrationExpiresAt: instrument?.calibrationExpiresAt ?? "",
    active: instrument?.active ?? true,
  });

  function field(name: keyof typeof values, value: string | boolean) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white p-6 shadow-xl sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-2xl font-semibold">
                {instrument ? t("standardsAdmin.edit") : t("standardsAdmin.create")}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {t("admin.standardsDescription")}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={t("common.cancel")}>
                <X className="h-5 w-5" />
              </Button>
            </Dialog.Close>
          </div>

          <form
            className="mt-7 grid gap-5 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              startTransition(async () => {
                const result = await saveStandardInstrument({
                  ...(instrument ? { id: instrument.id } : {}),
                  ...values,
                });
                if (!result.ok) {
                  setError(result.message);
                  return;
                }
                router.refresh();
                onSaved(result.message);
              });
            }}
          >
            <FormField label={t("standardsAdmin.description")} className="sm:col-span-2">
              <Input value={values.description} onChange={(e) => field("description", e.target.value)} required />
            </FormField>
            <FormField label={t("standardsAdmin.maker")}>
              <Input value={values.manufacturer} onChange={(e) => field("manufacturer", e.target.value)} required />
            </FormField>
            <FormField label={t("admin.model")}>
              <Input value={values.model} onChange={(e) => field("model", e.target.value)} required />
            </FormField>
            <FormField label={t("admin.serial")}>
              <Input value={values.serialNumber} onChange={(e) => field("serialNumber", e.target.value)} required />
            </FormField>
            <FormField label={t("admin.certificate")}>
              <Input value={values.calibrationCertNumber} onChange={(e) => field("calibrationCertNumber", e.target.value)} required />
            </FormField>
            <FormField label={t("standardsAdmin.calibrationDate")}>
              <Input type="date" value={values.calibrationDate} onChange={(e) => field("calibrationDate", e.target.value)} required />
            </FormField>
            <FormField label={t("admin.validTo")}>
              <Input type="date" value={values.calibrationExpiresAt} onChange={(e) => field("calibrationExpiresAt", e.target.value)} required />
            </FormField>
            {instrument && (
              <label className="flex items-center gap-3 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={values.active}
                  onChange={(event) => field("active", event.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm font-semibold">{t("admin.active")}</span>
              </label>
            )}
            {error && (
              <p className="rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive sm:col-span-2" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3 border-t pt-5 sm:col-span-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={pending}>{t("common.cancel")}</Button>
              </Dialog.Close>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("standardsAdmin.save")}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FormField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function DeleteInstrumentDialog({
  instrument,
  onOpenChange,
  onDeleted,
}: {
  instrument: StandardInstrumentItem | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (message: string) => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [instrument]);

  return (
    <Dialog.Root open={Boolean(instrument)} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-[1px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white p-6 shadow-xl">
          <Dialog.Title className="text-xl font-semibold">{t("standardsAdmin.deleteTitle")}</Dialog.Title>
          <Dialog.Description className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("standardsAdmin.deleteConfirm")}
          </Dialog.Description>
          {instrument && (
            <div className="mt-5 rounded-xl bg-muted p-4">
              <div className="font-semibold">{instrument.description}</div>
              <div className="technical-id mt-1 text-xs text-muted-foreground">{instrument.serialNumber}</div>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("standardsAdmin.linkedReports", { count: instrument.linkedReports })}
              </p>
            </div>
          )}
          {error && <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>}
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button type="button" variant="outline" disabled={pending}>{t("common.cancel")}</Button>
            </Dialog.Close>
            <Button
              type="button"
              variant="destructive"
              disabled={pending || !instrument}
              onClick={() => {
                if (!instrument) return;
                setError(null);
                startTransition(async () => {
                  const result = await deleteStandardInstrument(instrument.id);
                  if (!result.ok) {
                    setError(result.message);
                    return;
                  }
                  router.refresh();
                  onDeleted(result.message);
                });
              }}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("standardsAdmin.delete")}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
