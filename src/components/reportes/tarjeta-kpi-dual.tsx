import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TarjetaKpiDualProps {
  label: string;
  montoUsd: number;
  montoBs: number;
  icon?: React.ReactNode;
  subtext?: string;
  variant?: "default" | "emerald" | "amber" | "blue" | "destructive";
  className?: string;
}

export function TarjetaKpiDual({
  label,
  montoUsd,
  montoBs,
  icon,
  subtext,
  variant = "default",
  className,
}: TarjetaKpiDualProps) {
  const variantStyles = {
    default: "",
    emerald: "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20",
    amber: "border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20",
    blue: "border-blue-300 bg-blue-50/40 dark:border-blue-800 dark:bg-blue-950/20",
    destructive: "border-destructive/30 bg-destructive/5",
  };

  const textStyles = {
    default: "text-foreground",
    emerald: "text-emerald-700 dark:text-emerald-400",
    amber: "text-amber-700 dark:text-amber-400",
    blue: "text-blue-700 dark:text-blue-400",
    destructive: "text-destructive",
  };

  return (
    <Card className={cn(variantStyles[variant], className)}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <p className="font-mono text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {icon}
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("font-mono text-2xl font-extrabold tracking-tight", textStyles[variant])}>
            ${montoUsd.toFixed(2)}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">USD</span>
        </div>

        <p className="text-xs font-medium text-muted-foreground">
          Equivalente: <strong className="text-foreground font-mono">Bs. {montoBs.toFixed(2)}</strong>
        </p>

        {subtext && (
          <p className="text-[11px] text-muted-foreground pt-1 border-t mt-2">
            {subtext}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
