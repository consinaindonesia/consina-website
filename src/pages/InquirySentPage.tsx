import { Link } from "@tanstack/react-router";
import { CheckCircle2, CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLang } from "@/i18n/LangProvider";
import { Button } from "@/components/ui/button";

function useSearch(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  new URLSearchParams(window.location.search).forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function formatRef(id?: string): string {
  if (!id) return "—";
  const cleaned = id.replace(/-/g, "").toUpperCase();
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
}

export function InquirySentPage() {
  const { t } = useTranslation();
  const lang = useLang();
  const search = useSearch();
  const ref = formatRef(search.ref);
  const method = (search.method as "whatsapp" | "phone" | "email") || "whatsapp";
  const home = lang === "id" ? "/id" : "/en";

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center sm:py-24">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="h-10 w-10" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
        {t("inquiry_sent.title")}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {t("inquiry_sent.ref")}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold tracking-wider text-foreground">
        {ref}
      </p>

      <div className="mt-10 w-full rounded-lg border border-border bg-muted/40 p-6 text-left">
        <h2 className="text-base font-bold">
          {t("inquiry_sent.next_title")}
        </h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>{t("inquiry_sent.next_1")}</li>
          <li>
            {t("inquiry_sent.next_2", {
              method: t(`inquiry_page.method_${method}`),
            })}
          </li>
          <li>{t("inquiry_sent.next_3")}</li>
        </ol>
      </div>

      <Button asChild size="lg" className="mt-8">
        <Link to={home as never}>{t("inquiry_sent.continue")}</Link>
      </Button>

      {search.ref && (
        <Button
          asChild
          variant="outline"
          size="lg"
          className="mt-3"
        >
          <Link
            to={
              (lang === "id"
                ? `/id/checkout?inquiry=${search.ref}`
                : `/en/checkout?inquiry=${search.ref}`) as never
            }
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Pay now (bank transfer)
          </Link>
        </Button>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        {t("inquiry_sent.save_note")}
      </p>
    </div>
  );
}