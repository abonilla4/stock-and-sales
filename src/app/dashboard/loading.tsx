import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function KpiSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-14" />
        {/* Slot reservado para el caption de estado: vacío a propósito. No rellenar ni eliminar. */}
        <div className="mt-1 h-4" />
      </CardContent>
    </Card>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <span className="sr-only">Cargando resumen del inventario…</span>
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-1 h-4 w-52" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
