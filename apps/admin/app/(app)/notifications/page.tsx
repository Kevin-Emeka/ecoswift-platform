'use client';

import { Alert, AlertDescription, Badge, Card, CardContent, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ecoswift/ui';
import { useNotificationTemplates } from '../../../lib/hooks/use-notification-templates';
import { formatDateTime } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';

export default function NotificationsPage() {
  const { data: templates, isLoading, isError, error } = useNotificationTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notification Management</h1>
        <p className="text-muted-foreground">
          Read-only catalog of notification templates. Template editing is not yet supported by the backend — this is a future scope item.
        </p>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load notification templates.'}</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-64" />
        </div>
      ) : templates && templates.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Locale</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-mono text-xs">{template.code}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.channel}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{template.subjectTemplate ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{template.locale}</TableCell>
                    <TableCell>
                      <Badge variant={template.isActive ? 'success' : 'outline'}>{template.isActive ? 'Active' : 'Inactive'}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(template.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No notification templates found.</CardContent>
        </Card>
      )}
    </div>
  );
}
