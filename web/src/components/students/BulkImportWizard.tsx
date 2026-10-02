'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud, CheckCircle2, AlertCircle } from 'lucide-react';

export function BulkImportWizard({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [step, setStep] = useState(1);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
      <div className="w-full max-w-xl bg-card border-l border-border h-full flex flex-col shadow-2xl animate-in slide-in-from-right">
        
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold">Bulk Import Students</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-2 mb-8">
            {[1,2,3,4].map(s => (
              <div key={s} className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full ${s <= step ? 'bg-primary' : ''}`} />
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <h3 className="font-semibold text-lg">Upload CSV File</h3>
              <p className="text-sm text-muted-foreground">Download the template, fill it out, and upload it here.</p>
              <div className="border-2 border-dashed border-border rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <UploadCloud className="h-10 w-10 text-primary mb-4" />
                <p className="font-medium">Drag & drop your file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse (.csv only)</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="font-semibold text-lg">Preview & Validate</h3>
              <div className="p-4 bg-success/10 text-success rounded-lg flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4" /> 32 valid rows found.
              </div>
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg flex items-start gap-2 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5" /> 
                <div>
                  <p className="font-semibold">2 rows have errors</p>
                  <p className="opacity-80">Row 15: Invalid email format.</p>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="font-semibold text-lg">Map Fields</h3>
              <p className="text-sm text-muted-foreground">Match the columns from your CSV to the student database fields.</p>
              <div className="space-y-3">
                {['First Name', 'Last Name', 'Admission No', 'Date of Birth'].map(f => (
                  <div key={f} className="flex items-center justify-between p-3 border border-border rounded-lg">
                    <span className="text-sm font-medium">{f}</span>
                    <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">Mapped automatically</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 text-center py-12">
              <div className="mx-auto h-16 w-16 bg-success/20 text-success rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="font-bold text-2xl">Import Ready</h3>
              <p className="text-muted-foreground">You are about to import 32 students. 2 invalid rows will be skipped.</p>
            </div>
          )}

        </div>

        <div className="p-6 border-t border-border flex items-center justify-between bg-muted/20">
          <Button variant="outline" onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}>
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button onClick={() => step < 4 ? setStep(s => s + 1) : onClose()}>
            {step === 4 ? 'Start Import' : 'Continue'}
          </Button>
        </div>

      </div>
    </div>
  )
}
