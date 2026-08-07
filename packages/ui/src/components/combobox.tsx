import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Extra text (e.g. a dialing code) searched against but not shown in the trigger. */
  keywords?: string;
}

export interface ComboboxProps {
  id?: string;
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

/**
 * A searchable, keyboard-navigable select — Popover + cmdk's Command,
 * not Radix's plain Select. A plain Select's trigger is a button with no
 * visible search box (only a silent, non-filtering type-ahead), which
 * reads as "broken" for any list long enough to need real search (e.g.
 * every ISO country). This is the fix for that: an actual text input
 * that filters the list live, full keyboard nav (Arrow keys + Enter),
 * and normal mouse/click selection — while still rendering through a
 * Portal like every other overlay in this package.
 */
export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results found.',
  disabled,
  invalid,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            invalid && 'border-destructive focus:ring-destructive',
            className,
          )}
        >
          <span className={cn('truncate text-left', !selected && 'text-muted-foreground')}>{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.keywords ?? ''}`}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn('h-4 w-4', option.value === value ? 'opacity-100' : 'opacity-0')} />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
