import * as React from 'react';
import { Badge } from './badge';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  ACTIVE: 'success',
  COMPLETED: 'success',
  SENT: 'success',
  DELIVERED: 'success',
  APPROVED: 'success',
  READ: 'secondary',
  PENDING: 'warning',
  PENDING_ACTIVATION: 'warning',
  PROCESSING: 'warning',
  QUEUED: 'warning',
  INITIATED: 'warning',
  DORMANT: 'secondary',
  INACTIVE: 'secondary',
  FROZEN: 'destructive',
  RESTRICTED: 'destructive',
  CLOSED: 'outline',
  DEACTIVATED: 'outline',
  FAILED: 'destructive',
  REJECTED: 'destructive',
  SUPPRESSED: 'outline',
  REVERSED: 'destructive',
};

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
}

/** Maps a domain status string (account/transaction/notification/etc.) to a consistent color across every screen in both apps. */
export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  const variant = STATUS_VARIANT[status] ?? 'default';
  return (
    <Badge variant={variant} className={className} {...props}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
