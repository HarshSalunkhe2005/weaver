import Link from "next/link";
import { Icon, Mark } from "@/components/ui";

export interface Health {
  ok: boolean;
  brightDataConfigured: boolean;
  accessRequired: boolean;
}

export function TopBar({ health, onReset }: { health: Health | null; onReset?: () => void }) {
  const status = health === null ? null : health.brightDataConfigured ? "ready" : "offline";
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Weaver home">
          <Mark />
          <span className="font-display text-[1.65rem] italic leading-none tracking-tight">Weaver</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {status && (
            <span className="pill hidden sm:inline-flex" title={status === "ready" ? "A Bright Data API key is configured on this server" : "No Bright Data API key is configured on this server"}>
              <span className={`size-1.5 rounded-full ${status === "ready" ? "bg-mend" : "bg-fray"}`} aria-hidden />
              {status === "ready" ? "Bright Data key set" : "No Bright Data key"}
            </span>
          )}
          {onReset && (
            <button type="button" onClick={onReset} className="btn btn-quiet btn-sm">
              Start over
            </button>
          )}
          <a
            href="https://github.com/HarshSalunkhe2005/weaver"
            target="_blank"
            rel="noopener noreferrer"
            className="grid size-9 place-items-center rounded-lg text-dim transition-colors hover:bg-panel-2 hover:text-fg"
            aria-label="Weaver on GitHub"
          >
            <Icon name="github" size={18} />
          </a>
        </div>
      </div>
    </header>
  );
}
