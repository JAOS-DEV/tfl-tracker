import { StatusPill, type StatusPillVariant } from "@/components/StatusPill";

export interface StatusChip {
  id: string;
  label: string;
  variant: StatusPillVariant;
  showLiveDot?: boolean;
}

interface StatusChipRowProps {
  chips: StatusChip[];
}

export function StatusChipRow({ chips }: StatusChipRowProps): React.ReactElement | null {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="-mx-1 flex flex-wrap gap-1.5 px-1 pb-0.5">
      {chips.map((chip) => (
        <StatusPill
          key={chip.id}
          label={chip.label}
          variant={chip.variant}
          size="sm"
          showLiveDot={chip.showLiveDot}
        />
      ))}
    </div>
  );
}
