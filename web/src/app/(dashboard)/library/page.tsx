'use client';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Book, QrCode } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export default function LibraryCatalogPage() {
  const { data: response } = useQuery({
    queryKey: ['library_books'],
    queryFn: async () => {
      const res = await apiClient.get('/schools/library/books');
      return res.data;
    }
  });

  const books = response || [];
  const [issueOpen, setIssueOpen] = useState(false);
  const [barcode, setBarcode] = useState('');

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Library Catalog" 
        breadcrumbs={[{ label: 'Operations' }, { label: 'Library' }]} 
        actions={
          <Button onClick={() => setIssueOpen(true)}><QrCode className="h-4 w-4 mr-2" /> Quick Issue (Scan)</Button>
        }
      />
      
      <div className="flex gap-2 bg-card p-4 rounded-xl border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search books by title, author, or ISBN..." className="pl-8 bg-muted/50" />
        </div>
        <Button variant="outline"><Book className="h-4 w-4 mr-2" /> Add Book</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {books.map((book: any) => (
          <Card key={book.id} className="overflow-hidden hover:shadow-hover transition-all cursor-pointer group">
            <div className="aspect-[2/3] relative bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={book.cover_url} alt={book.title} className="object-cover w-full h-full opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur px-2 py-0.5 rounded text-xs font-bold shadow-sm">
                {book.available > 0 ? <span className="text-success">{book.available} Available</span> : <span className="text-destructive">Issued Out</span>}
              </div>
            </div>
            <CardContent className="p-4">
              <p className="font-semibold line-clamp-1" title={book.title}>{book.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quick Issue / Return</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Scan Book Barcode</label>
              <Input 
                autoFocus 
                placeholder="Scan or type barcode..." 
                value={barcode} 
                onChange={(e) => setBarcode(e.target.value)} 
                onKeyDown={(e) => { if(e.key === 'Enter') { alert(`Scanned: ${barcode}`); setBarcode(''); setIssueOpen(false); } }} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
            <Button onClick={() => setIssueOpen(false)}>Lookup Book</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
