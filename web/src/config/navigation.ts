import {
  LayoutDashboard, Users, GraduationCap, CalendarCheck, Wallet,
  MessageSquare, Bus, UserCog, Library, Home, Shield,
  BrainCircuit, Settings, BarChart3, BookOpen, ClipboardList, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label:      string;
  href:       string;
  icon:       LucideIcon;
  badge?:     string | number;
  badgeColor?:'default' | 'destructive' | 'warning';
  children?:  NavItem[];
  module?:    string;
  roles?:     string[];
}

export interface NavGroup {
  label:    string;
  items:    NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard',   href: '/dashboard',   icon: LayoutDashboard },
    ],
  },
  {
    label: 'Academic',
    items: [
      {
        label: 'Students',   href: '/students',    icon: Users,           module: 'students',
        children: [
          { label: 'All Students',    href: '/students',           icon: Users },
          { label: 'Admissions',      href: '/students/admissions',icon: GraduationCap },
        ],
      },
      { label: 'Academics',    href: '/academics',   icon: BookOpen,        module: 'academics' },
      { label: 'Attendance',   href: '/attendance',  icon: CalendarCheck,   module: 'attendance' },
      { label: 'Examinations', href: '/exams',       icon: ClipboardList,   module: 'exams' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Transport',  href: '/transport',   icon: Bus,      module: 'transport' },
      { label: 'Library',    href: '/library',     icon: Library,  module: 'library' },
      { label: 'Hostel',     href: '/hostel',      icon: Home,     module: 'hostel' },
      { label: 'Security',   href: '/security',    icon: Shield,   module: 'security' },
    ],
  },
];
