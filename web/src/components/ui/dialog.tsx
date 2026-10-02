import * as React from "react"
export const Dialog = ({ children, open, onOpenChange }: any) => {
  if (open === false) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">{children}</div>;
}
export const DialogContent = ({ children, className }: any) => (
  <div className={`bg-card rounded-xl border p-6 shadow-xl w-full max-w-md ${className}`}>{children}</div>
)
export const DialogHeader = ({ children }: any) => <div className="space-y-1.5 mb-4">{children}</div>
export const DialogFooter = ({ children }: any) => <div className="flex justify-end gap-2 mt-6">{children}</div>
export const DialogTitle = ({ children }: any) => <h2 className="text-lg font-bold">{children}</h2>
export const DialogDescription = ({ children }: any) => <p className="text-sm text-muted-foreground">{children}</p>
