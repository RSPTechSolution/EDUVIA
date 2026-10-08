"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Download, File as FileIcon, FileImage, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, api, fileUrl, uploadFile } from "@/lib/api/client";
import type { StoredFile } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { useFiles } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const DOC_ACCEPT = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv";

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function iconFor(type: string) {
  if (type.startsWith("image/")) return FileImage;
  if (type === "application/pdf" || type.startsWith("text/")) return FileText;
  return FileIcon;
}

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Upload failed");

/** A round/square photo that the user may click to replace. Shows initials when there is no photo. */
export function PhotoUpload({
  fileId, purpose, ownerId, fallback, canEdit, onChanged, className,
}: {
  fileId: string | null | undefined; purpose: string; ownerId: string; fallback: React.ReactNode; canEdit: boolean;
  onChanged: () => void; className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadFile<StoredFile>(file, { purpose, owner_id: ownerId });
      toast.success("Photo updated");
      onChanged();
    } catch (e) {
      toast.error(errorText(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const img = fileId
    ? /* eslint-disable-next-line @next/next/no-img-element -- private API image, not optimisable */
      <img src={fileUrl(fileId)} alt="" className="size-full object-cover" />
    : fallback;
  return (
    <span className={cn("group relative flex shrink-0 items-center justify-center overflow-hidden", className)}>
      {img}
      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={fileId ? "Change photo" : "Add photo"}
          >
            {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Camera className="size-5" aria-hidden />}
          </button>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1}
                 aria-label="Photo file" onChange={(e) => pick(e.target.files?.[0])} />
        </>
      )}
    </span>
  );
}

/** Files attached to something (a student's documents, a homework's worksheets...). */
export function FileList({
  purpose, ownerId, files, canUpload, withLabel = false, emptyText = "No files yet", onChanged, compact = false,
}: {
  purpose: string; ownerId: string; files?: StoredFile[]; canUpload: boolean; withLabel?: boolean; emptyText?: string;
  onChanged?: () => void; compact?: boolean;
}) {
  const qc = useQueryClient();
  const fetched = useFiles(purpose, files ? undefined : ownerId);
  const list = files ?? fetched.data ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [removing, setRemoving] = useState<StoredFile | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["files", purpose, ownerId] });
    onChanged?.();
  };
  const upload = useMutation({
    mutationFn: (file: File) => uploadFile<StoredFile>(file, { purpose, owner_id: ownerId, label: label.trim() || undefined }),
    onSuccess: (f) => { toast.success(`${f.filename} uploaded`); setLabel(""); refresh(); },
    onError: (e) => toast.error(errorText(e)),
    onSettled: () => { if (input.current) input.current.value = ""; },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/files/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("File removed"); setRemoving(null); refresh(); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : "Could not remove the file"),
  });

  return (
    <div className="space-y-3">
      {list.length === 0 && !fetched.isPending ? (
        <p className={cn("text-sm text-muted-foreground", !compact && "rounded-lg border border-dashed px-4 py-6 text-center")}>{emptyText}</p>
      ) : (
        <ul className="space-y-2" aria-label="Files">
          {list.map((f) => {
            const Icon = iconFor(f.content_type);
            return (
              <li key={f.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <Icon className="size-5 shrink-0 text-primary" aria-hidden />
                <a href={fileUrl(f.id)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 hover:underline">
                  <span className="block truncate text-sm font-medium">{f.label ?? f.filename}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {f.label ? `${f.filename} · ` : ""}{formatSize(f.size)} · {formatDate(f.created_at)}
                  </span>
                </a>
                <Button variant="ghost" size="icon" render={<a href={fileUrl(f.id, true)} aria-label={`Download ${f.filename}`} />}>
                  <Download aria-hidden />
                </Button>
                {canUpload && (
                  <Button variant="ghost" size="icon" aria-label={`Remove ${f.filename}`} onClick={() => setRemoving(f)}><Trash2 aria-hidden /></Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {canUpload && (
        <div className="flex flex-col gap-2 sm:flex-row">
          {withLabel && (
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What is it? e.g. Birth certificate" maxLength={120}
                   aria-label="Document name" className="sm:flex-1" />
          )}
          <Button type="button" variant="outline" onClick={() => input.current?.click()} loading={upload.isPending} loadingText="Uploading…">
            {withLabel ? <Upload aria-hidden /> : <Paperclip aria-hidden />}{withLabel ? "Upload document" : "Attach a file"}
          </Button>
          <input ref={input} type="file" accept={DOC_ACCEPT} className="sr-only" tabIndex={-1} aria-label="File to upload"
                 onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
        </div>
      )}
      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(o) => !o && setRemoving(null)}
        destructive
        pending={remove.isPending}
        title={`Remove ${removing?.label ?? removing?.filename}?`}
        description="The file is deleted for everyone."
        confirmLabel="Remove"
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </div>
  );
}

/** Read-only chips for attachments (e.g. on a parent's homework list). */
export function AttachmentChips({ files }: { files?: StoredFile[] }) {
  if (!files?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((f) => (
        <a key={f.id} href={fileUrl(f.id)} target="_blank" rel="noreferrer"
           className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs font-medium hover:bg-muted">
          <Paperclip className="size-3 shrink-0" aria-hidden /><span className="truncate">{f.filename}</span>
        </a>
      ))}
    </div>
  );
}
