"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function ErrorAlert({
  title,
  description,
  onRetry,
}: {
  title: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant="destructive" role="alert">
      <AlertTitle>{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </Alert>
  );
}

export function SuccessAlert({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <Alert className="border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
      <AlertTitle>{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
    </Alert>
  );
}

export function NoticeAlert({ title, description }: { title: string; description?: string }) {
  return (
    <Alert>
      <AlertTitle>{title}</AlertTitle>
      {description ? <AlertDescription>{description}</AlertDescription> : null}
    </Alert>
  );
}
