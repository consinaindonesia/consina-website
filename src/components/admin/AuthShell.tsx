import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  banner,
  children,
}: {
  title: string;
  subtitle?: string;
  banner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{
        backgroundColor: "#fafaf5",
        backgroundImage:
          "radial-gradient(circle at 1px 1px, rgba(26,58,46,0.06) 1px, transparent 0)",
        backgroundSize: "24px 24px",
      }}
    >
      <div className="w-[90%] max-w-[400px] rounded-[12px] bg-white p-8 shadow-[0_10px_40px_-12px_rgba(26,58,46,0.18)]">
        <div className="flex flex-col items-center text-center">
          <span
            className="text-2xl font-black tracking-tight"
            style={{ color: "#1a3a2e" }}
          >
            CONSINA
          </span>
          <span
            className="mt-1 text-[10px] font-semibold tracking-[0.3em]"
            style={{ color: "#d4b896" }}
          >
            ADMIN
          </span>
        </div>
        <h1 className="mt-6 text-center text-xl font-semibold" style={{ color: "#1a3a2e" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-center text-sm text-muted-foreground">{subtitle}</p>
        )}
        {banner}
        {children}
      </div>
    </div>
  );
}