"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, KeyRound, Upload } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api/client";
import { csvBlob, downloadFile, saveBlob } from "@/lib/download";
import { cn } from "@/lib/utils";

interface ImportResult {
  rows: number;
  ok: boolean;
  dry_run: boolean;
  errors: { row: number; column: string | null; message: string }[];
  created: number;
  parents_created: number;
  parents_linked: number;
  credentials: { name: string; email: string; role: string; password: string }[];
  emails_sent: number;
}

const KINDS = {
  students: {
    title: "Import students",
    noun: "students",
    help: "One row per student. Add the father's, mother's or guardian's name, phone and email to create their parent accounts; a parent already in EDUVIA (same email) is linked, so brothers and sisters share one account.",
    invalidate: ["students", "classes"],
  },
  staff: {
    title: "Import staff",
    noun: "staff accounts",
    help: "One row per person. Role is a staff role (teacher, principal, accountant, receptionist, librarian, hr manager, transport manager, security guard, staff, driver). Teachers and office staff need a phone; drivers also need a licence number.",
    invalidate: ["users"],
  },
} as const;

export function ImportDialog({ kind, open, onOpenChange }: { kind: keyof typeof KINDS; open: boolean; onOpenChange: (o: boolean) => void }) {
  const k = KINDS[kind];
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string; rows: number } | null>(null);
  const [check, setCheck] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const [sendEmails, setSendEmails] = useState(false);
  useEffect(() => {
    if (open) { setFile(null); setCheck(null); setDone(null); setSendEmails(false); }
  }, [open]);

  const run = useMutation({
    mutationFn: (dryRun: boolean) => api<ImportResult>(`/transfer/${kind}/import`, { method: "POST", body: { csv: file!.text, dry_run: dryRun, send_emails: sendEmails } }),
    onSuccess: ({ data }) => {
      if (data.dry_run) { setCheck(data); return; }
      if (!data.ok) { setCheck(data); toast.error("Nothing was imported: fix the rows below and try again"); return; }
      setDone(data);
      for (const key of k.invalidate) qc.invalidateQueries({ queryKey: [key] });
      toast.success(`${data.created} ${k.noun} imported`);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not read the file"),
  });

  async function pick(f: File | undefined) {
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) {
      toast.error("Please choose a .csv file", { description: "In Excel: File → Save As → CSV UTF-8 (comma delimited)." });
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, text, rows: Math.max(0, text.trim().split(/\r?\n/).length - 1) });
    setCheck(null);
  }

  const template = async () => {
    try { await downloadFile(`/transfer/${kind}/template`, `${kind}-template.csv`); } catch (e) { toast.error((e as Error).message); }
  };
  const saveLogins = () => done && saveBlob(
    csvBlob(["Name", "Email", "Role", "Temporary password"], done.credentials.map((c) => [c.name, c.email, c.role, c.password])),
    `${kind}-login-details.csv`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{k.title}</DialogTitle>
          <DialogDescription>{k.help}</DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4 py-2 text-center">
              <CheckCircle2 className="mx-auto size-12 text-success" aria-hidden />
              <p className="font-heading text-xl font-bold">{done.created} {k.noun} imported</p>
              {kind === "students" && <p className="text-sm text-muted-foreground">{done.parents_created} new parent accounts · {done.parents_linked} linked to existing parents</p>}
              {done.credentials.length > 0 && (
                <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 text-left text-sm">
                  <p className="flex items-center gap-2 font-semibold"><KeyRound className="size-4" aria-hidden />Login details for {done.credentials.length} new accounts</p>
                  <p className="mt-1 text-muted-foreground">
                    {done.emails_sent ? `${done.emails_sent} were emailed their details. ` : "No emails were sent. "}
                    Download the list now: the temporary passwords aren&apos;t shown again. Everyone must choose their own password at first sign-in.
                  </p>
                  <Button className="mt-3" onClick={saveLogins}><Download aria-hidden />Download login details</Button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="form" exit={{ opacity: 0 }} className="space-y-4">
              <ol className="space-y-3 text-sm">
                <li className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                  <span className="flex-1">Fill in the template in Excel or Google Sheets and save it as CSV.</span>
                  <Button variant="outline" size="sm" onClick={template}><FileSpreadsheet aria-hidden />Template</Button>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                  <span className="min-w-0 flex-1 truncate">{file ? <><span className="font-medium">{file.name}</span> · {file.rows} rows</> : "Choose the CSV file."}</span>
                  <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label="CSV file" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
                  <Button variant="outline" size="sm" onClick={() => input.current?.click()}><Upload aria-hidden />{file ? "Change" : "Choose file"}</Button>
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                  <span className="flex-1">Check it. Nothing is saved until every row is correct.</span>
                  <Button size="sm" disabled={!file} onClick={() => run.mutate(true)} loading={run.isPending && !check} loadingText="Checking…">Check file</Button>
                </li>
              </ol>

              {check && (
                <div className={cn("rounded-xl border p-4", check.ok ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5")}>
                  {check.ok ? (
                    <p className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                      <span>All {check.rows} rows are fine. Ready to add <b>{check.created} {k.noun}</b>
                        {kind === "students" && <> with <b>{check.parents_created}</b> new parent accounts{check.parents_linked ? <> and <b>{check.parents_linked}</b> links to existing parents</> : null}</>}.</span>
                    </p>
                  ) : (
                    <>
                      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive"><AlertTriangle className="size-4" aria-hidden />{check.errors.length} problem{check.errors.length > 1 ? "s" : ""} to fix. Nothing was saved.</p>
                      <div className="max-h-64 overflow-y-auto rounded-lg border bg-card">
                        <table className="w-full text-sm">
                          <caption className="sr-only">Problems in the file</caption>
                          <thead className="sticky top-0 bg-muted text-xs text-muted-foreground"><tr><th scope="col" className="px-3 py-1.5 text-left">Line</th><th scope="col" className="px-3 py-1.5 text-left">Column</th><th scope="col" className="px-3 py-1.5 text-left">Problem</th></tr></thead>
                          <tbody className="divide-y">
                            {check.errors.map((e, i) => (
                              <tr key={i}><td className="px-3 py-1.5 tabular">{e.row + 1}</td><td className="px-3 py-1.5 font-mono text-xs">{e.column ?? "—"}</td><td className="px-3 py-1.5">{e.message}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Line numbers match your spreadsheet (line 1 is the header). Fix the file, choose it again and check.</p>
                    </>
                  )}
                </div>
              )}

              {check?.ok && (
                <label className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                  <span>Email login details to each new account
                    <span className="block text-xs text-muted-foreground">Uses your daily email allowance (300 on Brevo&apos;s free plan). Demo addresses are never emailed. You can download the details either way.</span>
                  </span>
                  <Switch checked={sendEmails} onCheckedChange={setSendEmails} />
                </label>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{done ? "Close" : "Cancel"}</Button>
          {!done && (
            <Button disabled={!check?.ok} onClick={() => run.mutate(false)} loading={run.isPending && Boolean(check)} loadingText="Importing…">
              <Upload aria-hidden />Import {check?.ok ? `${check.created} ${k.noun}` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Export buttons share this: download with a toast on failure. */
export async function exportCsv(path: string, name: string) {
  try {
    await downloadFile(path, `${name}.csv`);
  } catch (e) {
    toast.error((e as Error).message);
  }
}
