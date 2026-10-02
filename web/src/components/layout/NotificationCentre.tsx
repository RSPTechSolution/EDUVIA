import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotificationCentre({ open, onOpenChange }: any) {
  return (
    <Button variant="ghost" size="icon" aria-label="Notifications" className="relative" onClick={() => onOpenChange(!open)}>
      <Bell className="h-5 w-5" />
      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive"></span>
    </Button>
  )
}
