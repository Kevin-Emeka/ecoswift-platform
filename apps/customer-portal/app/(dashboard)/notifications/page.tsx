'use client';

import { BellOff, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@ecoswift/ui';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../../../lib/hooks/use-notifications';
import { formatDateTime } from '../../../lib/format';
import { cn } from '@ecoswift/ui';

const CHANNEL_ICON = { EMAIL: Mail, SMS: MessageSquare, PUSH: Smartphone, IN_APP: Smartphone } as const;

export default function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Everything we&apos;ve sent you.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()} loading={markAllRead.isPending}>
          Mark all read
        </Button>
      </div>

      <Card>
        <CardHeader className="sr-only">
          <CardTitle>Notification list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 p-4">
          {isLoading ? (
            <>
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </>
          ) : data && data.items.length > 0 ? (
            data.items.map((notification) => {
              const Icon = CHANNEL_ICON[notification.channel] ?? Mail;
              const isUnread = !notification.readAt;
              return (
                <button
                  key={notification.id}
                  onClick={() => isUnread && markRead.mutate(notification.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent',
                    isUnread && 'bg-accent/50',
                  )}
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{notification.subject ?? notification.channel}</p>
                      {isUnread && <Badge variant="default">New</Badge>}
                    </div>
                    {notification.body && <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(notification.createdAt)}</p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <BellOff className="h-8 w-8" />
              You&apos;re all caught up.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
