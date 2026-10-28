import { ShieldAlert } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { InlineAlert } from '../ui/StateViews';
import type { DemoRole } from './types';

export function DemoIdentityBanner({ role }: { role: DemoRole }) {
  const isReviewer = role === 'ministry_reviewer';
  return (
    <InlineAlert tone="warning" title="Prototype identity only">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert className="h-3.5 w-3.5" />
        <span>This role demonstrates authorization boundaries. It is not government SSO or verified onboarding.</span>
        <Badge variant="warning" size="xs">{isReviewer ? 'Ministry Reviewer' : 'Operator'}</Badge>
      </div>
    </InlineAlert>
  );
}
