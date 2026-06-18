import { Link } from "@tanstack/react-router";
import { icons, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: keyof typeof icons;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  const Icon = icons[icon] as LucideIcon;

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {Icon && (
        <Icon
          className="mb-6 text-muted-foreground/25"
          size={96}
          strokeWidth={1}
        />
      )}
      <h2 className="text-xl font-bold text-foreground">
        {title}
      </h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Link
          to={actionHref}
          className="mt-6 inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors duration-200 hover:bg-secondary"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
