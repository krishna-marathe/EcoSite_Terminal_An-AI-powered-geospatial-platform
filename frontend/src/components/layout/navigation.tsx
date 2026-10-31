import React from 'react';
import {
  BookOpen,
  ClipboardCheck,
  Cpu,
  Database,
  Globe2,
  MapPin,
  Newspaper,
  Server,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

/**
 * The single navigation model, grouped by the audience each surface serves.
 * Public pages sit in the header bar; restricted workspaces live behind the
 * Workspaces menu so a first-time visitor never has to choose between
 * "Registration review" and "News".
 */
export interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const PRIMARY_NAV: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: <Globe2 className="h-3.5 w-3.5" />, description: 'Map and screening summary' },
  { to: '/public-facilities', label: 'Registry', icon: <Server className="h-3.5 w-3.5" />, description: 'Verified operating data centres' },
  { to: '/forecast', label: 'ML Forecast & Analysis', icon: <Cpu className="h-3.5 w-3.5" />, description: 'Operational electricity forecast, facility scenarios & model benchmarks' },
  { to: '/learn', label: 'Community Guide', icon: <BookOpen className="h-3.5 w-3.5" />, description: 'Public guide, grievances & citizen petitions' },
  { to: '/news', label: 'News', icon: <Newspaper className="h-3.5 w-3.5" />, description: 'India and world media context' },
];

export const WORKSPACE_NAV: NavGroup[] = [
  {
    id: 'official',
    label: 'Government official',
    items: [
      { to: '/ministry', label: 'Ministry overview', icon: <ShieldCheck className="h-3.5 w-3.5" />, description: 'Coverage, source health and freshness' },
      { to: '/ministry/review', label: 'Registration review', icon: <ClipboardCheck className="h-3.5 w-3.5" />, description: 'Decide pending facility submissions' },
      { to: '/data-sources', label: 'Data sources', icon: <Database className="h-3.5 w-3.5" />, description: 'Official documents and datasets' },
    ],
  },
  {
    id: 'operator',
    label: 'Data-centre owner',
    items: [
      { to: '/operator/register', label: 'Register a facility', icon: <UserPlus className="h-3.5 w-3.5" />, description: 'Submit or revise a declaration' },
    ],
  },
  {
    id: 'planner',
    label: 'Planning analyst',
    items: [
      { to: '/projects', label: 'Site planning', icon: <MapPin className="h-3.5 w-3.5" />, description: 'Candidate polygons and evidence' },
    ],
  },
];

export const isActivePath = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(`${to}/`);
