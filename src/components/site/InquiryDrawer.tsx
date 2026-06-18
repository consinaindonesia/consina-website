import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ClipboardList, X, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  useInquiry,
  removeFromInquiry,
  updateQuantity,
  clearInquiry,
  type InquiryItem,
} from "@/lib/inquiry-store";
import { useLang } from "@/i18n/LangProvider";
import { formatPrice } from "@/i18n/format";

export function InquiryDrawer({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const { items, count } = useInquiry();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-muted hover:text-primary ${className}`}
          aria-label={t("inquiry.open")}
        >
          <ClipboardList className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-secondary px-1 text-[10px] font-bold text-secondary-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="text-lg font-bold tracking-tight">
            {t("inquiry.title")}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {t("inquiry.items_count", { count })}
          </p>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">{t("inquiry.empty")}</p>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-border overflow-y-auto">
              {items.map((item) => (
                <InquiryRow key={item.key} item={item} />
              ))}
            </ul>
            <div className="border-t border-border bg-muted/40 p-4">
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => {
                  setOpen(false);
                  const path = lang === "id" ? "/id/permintaan" : "/en/inquiry";
                  navigate({ to: path as never });
                }}
              >
                {t("inquiry.view_full")}
              </Button>
              <button
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition hover:text-destructive"
                onClick={() => {
                  if (confirm(t("inquiry.confirm_clear"))) clearInquiry();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("inquiry.clear_all")}
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InquiryRow({ item }: { item: InquiryItem }) {
  const lang = useLang();
  const { t } = useTranslation();
  const name = (lang === "id" ? item.name_id : item.name_en) || item.name_id || item.name_en;
  const attrs = Object.entries(item.attributes);
  return (
    <li className="flex gap-3 p-4">
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-muted">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={name} className="h-full w-full object-cover" />
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="line-clamp-2 text-sm font-medium text-foreground">{name}</p>
          <button
            onClick={() => removeFromInquiry(item.key)}
            className="text-muted-foreground transition hover:text-destructive"
            aria-label={t("inquiry.remove")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {attrs.length > 0 && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {attrs.map(([k, v]) => `${k}: ${v}`).join(" · ")}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <div className="inline-flex items-center rounded-md border border-border">
            <button
              className="px-2 py-1 text-sm text-foreground hover:bg-muted"
              onClick={() => updateQuantity(item.key, item.quantity - 1)}
              aria-label="-"
            >
              −
            </button>
            <span className="w-7 text-center text-sm">{item.quantity}</span>
            <button
              className="px-2 py-1 text-sm text-foreground hover:bg-muted"
              onClick={() => updateQuantity(item.key, item.quantity + 1)}
              aria-label="+"
            >
              +
            </button>
          </div>
          <span className="text-sm font-semibold text-primary">
            {formatPrice(item.price_idr * item.quantity, lang)}
          </span>
        </div>
      </div>
    </li>
  );
}