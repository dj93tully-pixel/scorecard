// components/TabBar.tsx
// Thumb-reachable bottom navigation. Big tap targets for one-handed use.

export type TabKey = "setup" | "play" | "card" | "ledger";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "setup", label: "Setup", icon: "⚙" },
  { key: "play", label: "Play", icon: "🐺" },
  { key: "card", label: "Card", icon: "▦" },
  { key: "ledger", label: "Ledger", icon: "$" },
];

export function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (t: TabKey) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-card-border bg-card-bg">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className="flex flex-1 flex-col items-center gap-0.5 py-3"
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={`text-lg leading-none ${
                  isActive ? "" : "opacity-60"
                }`}
              >
                {t.icon}
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  isActive
                    ? "text-accent-on-light"
                    : "text-text-muted"
                }`}
              >
                {t.label}
              </span>
              <span
                className={`mt-0.5 h-0.5 w-6 rounded-full ${
                  isActive ? "bg-primary" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
