'use client';

import * as React from 'react';
import { Copy, KeyRound, Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@ecoswift/ui';
import { useCreateFeatureFlag, useFeatureFlags, useToggleFeatureFlag, useUpdateFeatureFlag } from '../../../lib/hooks/use-feature-flags';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '../../../lib/hooks/use-api-keys';
import { usePermissionsCatalog } from '../../../lib/hooks/use-roles';
import { formatDateTime } from '../../../lib/format';
import { ApiClientError } from '../../../lib/api/http-client';
import type { FeatureFlag, FeatureFlagScope } from '../../../lib/api/feature-flags';

const FLAG_SCOPES: FeatureFlagScope[] = ['GLOBAL', 'CUSTOMER', 'STAFF', 'PRODUCT'];

function CreateFlagDialog() {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState('');
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [scope, setScope] = React.useState<FeatureFlagScope>('GLOBAL');
  const createFlag = useCreateFeatureFlag();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await createFlag.mutateAsync({ key, name, description: description || undefined, scope });
      toast({ title: 'Feature flag created', variant: 'success' });
      setOpen(false);
      setKey('');
      setName('');
      setDescription('');
      setScope('GLOBAL');
    } catch (error) {
      toast({
        title: 'Could not create feature flag',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New flag
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a feature flag</DialogTitle>
            <DialogDescription>Key must be lowercase, dot/underscore separated (e.g. loans.instant_approval).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="key">Key</Label>
              <Input id="key" required value={key} onChange={(e) => setKey(e.target.value)} placeholder="loans.instant_approval" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="flagName">Name</Label>
              <Input id="flagName" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="flagDescription">Description</Label>
              <Input id="flagDescription" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scope">Scope</Label>
              <Select value={scope} onValueChange={(value) => setScope(value as FeatureFlagScope)}>
                <SelectTrigger id="scope">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FLAG_SCOPES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" loading={createFlag.isPending}>
              Create flag
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditFlagDialog({ flag }: { flag: FeatureFlag }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(flag.name);
  const [description, setDescription] = React.useState(flag.description ?? '');
  const [rolloutPercentage, setRolloutPercentage] = React.useState(flag.rolloutPercentage?.toString() ?? '');
  const updateFlag = useUpdateFeatureFlag(flag.id);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await updateFlag.mutateAsync({
        name,
        description: description || undefined,
        rolloutPercentage: rolloutPercentage ? Number(rolloutPercentage) : undefined,
      });
      toast({ title: 'Feature flag updated', variant: 'success' });
      setOpen(false);
    } catch (error) {
      toast({
        title: 'Could not update flag',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit {flag.key}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="editName">Name</Label>
              <Input id="editName" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="editDescription">Description</Label>
              <Input id="editDescription" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rollout">Rollout percentage (0-100)</Label>
              <Input
                id="rollout"
                type="number"
                min={0}
                max={100}
                value={rolloutPercentage}
                onChange={(e) => setRolloutPercentage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" loading={updateFlag.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FeatureFlagsTab() {
  const { data: flags, isLoading, isError, error } = useFeatureFlags();
  const toggleFlag = useToggleFeatureFlag();
  const { toast } = useToast();

  async function handleToggle(flag: FeatureFlag) {
    try {
      await toggleFlag.mutateAsync({ id: flag.id, isEnabled: !flag.isEnabled });
    } catch (err) {
      toast({
        title: 'Could not toggle flag',
        description: err instanceof ApiClientError ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateFlagDialog />
      </div>
      {isError ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load feature flags.'}</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : flags && flags.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Rollout</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell className="font-mono text-xs">{flag.key}</TableCell>
                    <TableCell>{flag.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{flag.scope}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{flag.rolloutPercentage != null ? `${flag.rolloutPercentage}%` : '—'}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggle(flag)}
                        disabled={toggleFlag.isPending}
                        className="inline-flex items-center gap-1.5 text-sm font-medium disabled:opacity-50"
                        aria-pressed={flag.isEnabled}
                      >
                        {flag.isEnabled ? (
                          <ToggleRight className="h-6 w-6 text-success" />
                        ) : (
                          <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                        )}
                        {flag.isEnabled ? 'On' : 'Off'}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDateTime(flag.updatedAt)}</TableCell>
                    <TableCell>
                      <EditFlagDialog flag={flag} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No feature flags yet.</CardContent>
        </Card>
      )}
    </div>
  );
}

function CreateApiKeyDialog({ onCreated }: { onCreated: (rawKey: string) => void }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [selectedScopes, setSelectedScopes] = React.useState<Set<string>>(new Set());
  const { data: permissions, isLoading: loadingPermissions } = usePermissionsCatalog();
  const createKey = useCreateApiKey();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (selectedScopes.size === 0) {
      toast({ title: 'Select at least one scope', variant: 'destructive' });
      return;
    }
    try {
      const result = await createKey.mutateAsync({ name, scopes: [...selectedScopes] });
      setOpen(false);
      setName('');
      setSelectedScopes(new Set());
      onCreated(result.rawKey);
    } catch (error) {
      toast({
        title: 'Could not create API key',
        description: error instanceof ApiClientError ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  function toggleScope(code: string) {
    setSelectedScopes((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> New API key
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create an API key</DialogTitle>
            <DialogDescription>The raw key will be shown exactly once after creation — copy it before closing that dialog.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="keyName">Name</Label>
              <Input id="keyName" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Reporting integration" />
            </div>
            <div className="grid gap-2">
              <Label>Scopes</Label>
              {loadingPermissions ? (
                <Skeleton className="h-32" />
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-3">
                  {permissions?.map((permission) => {
                    const code = `${permission.resource}:${permission.action}`;
                    return (
                      <label key={code} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedScopes.has(code)}
                          onChange={() => toggleScope(code)}
                          className="h-4 w-4 rounded border-input"
                        />
                        {code}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" loading={createKey.isPending}>
              Create key
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevealKeyDialog({ rawKey, onClose }: { rawKey: string | null; onClose: () => void }) {
  const { toast } = useToast();

  function copyKey() {
    if (rawKey) {
      navigator.clipboard.writeText(rawKey);
      toast({ title: 'Copied to clipboard', variant: 'success' });
    }
  }

  return (
    <Dialog open={!!rawKey} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>API key created</DialogTitle>
          <DialogDescription>Copy this key now — it will not be shown again.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted p-3 font-mono text-xs">
          <span className="flex-1 break-all">{rawKey}</span>
          <Button type="button" variant="ghost" size="icon" onClick={copyKey} aria-label="Copy key">
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApiKeysTab() {
  const { data: keys, isLoading, isError, error } = useApiKeys();
  const revokeKey = useRevokeApiKey();
  const { toast } = useToast();
  const [revealedKey, setRevealedKey] = React.useState<string | null>(null);

  async function handleRevoke(id: string) {
    try {
      await revokeKey.mutateAsync(id);
      toast({ title: 'API key revoked', variant: 'success' });
    } catch (err) {
      toast({
        title: 'Could not revoke key',
        description: err instanceof ApiClientError ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateApiKeyDialog onCreated={setRevealedKey} />
      </div>
      <RevealKeyDialog rawKey={revealedKey} onClose={() => setRevealedKey(null)} />

      {isError ? (
        <Alert variant="destructive">
          <AlertDescription>{error instanceof ApiClientError ? error.message : 'Failed to load API keys.'}</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : keys && keys.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Prefix</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="flex items-center gap-2">
                      <KeyRound className="h-4 w-4 text-muted-foreground" /> {key.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{key.keyPrefix}…</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{key.scopes.join(', ')}</TableCell>
                    <TableCell>
                      <Badge variant={key.status === 'ACTIVE' ? 'success' : 'outline'}>{key.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{key.lastUsedAt ? formatDateTime(key.lastUsedAt) : 'Never'}</TableCell>
                    <TableCell>
                      {key.status === 'ACTIVE' && (
                        <Button variant="outline" size="sm" onClick={() => handleRevoke(key.id)} loading={revokeKey.isPending}>
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No API keys yet.</CardContent>
        </Card>
      )}
    </div>
  );
}

export default function SystemConfigPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Configuration</h1>
        <p className="text-muted-foreground">Feature flags and API key management.</p>
      </div>

      <Tabs defaultValue="flags">
        <TabsList>
          <TabsTrigger value="flags">Feature Flags</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
        </TabsList>
        <TabsContent value="flags">
          <FeatureFlagsTab />
        </TabsContent>
        <TabsContent value="keys">
          <ApiKeysTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
