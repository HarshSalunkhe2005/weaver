"use client";

import { Icon, Spinner } from "@/components/ui";
import { MAX_DESCRIPTION } from "@/lib/labels";

export interface Field {
  id: string;
  tag: string;
  text: string;
  label: string;
}

export function FieldsPanel({
  fields,
  description,
  creating,
  onLabel,
  onRemove,
  onClear,
  onCreate,
}: {
  fields: Field[];
  description: string;
  creating: boolean;
  onLabel: (id: string, label: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onCreate: () => void;
}) {
  const length = description.length;
  const tooLong = length > MAX_DESCRIPTION;
  const names = fields.map((f) => f.label.trim().toLowerCase());
  const empty = fields.length > 0 && description === "";

  return (
    <aside className="panel flex flex-col lg:sticky lg:top-20" aria-label="Fields to extract">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">Fields</h2>
        {fields.length > 0 && (
          <button type="button" onClick={onClear} className="text-xs text-faint transition-colors hover:text-fg">
            Clear all
          </button>
        )}
      </div>

      {fields.length === 0 ? (
        <div className="px-4 py-8 text-sm text-dim">
          <p>Click anything on the page to add it as a field.</p>
          <p className="mt-2 text-faint">Name each one the way you would in a spreadsheet column: title, price, rating.</p>
        </div>
      ) : (
        <ul className="max-h-[22rem] divide-y divide-line overflow-y-auto">
          {fields.map((f) => {
            const duplicate = f.label.trim() !== "" && names.filter((n) => n === f.label.trim().toLowerCase()).length > 1;
            return (
              <li key={f.id} className="rise px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="tag">{f.tag}</span>
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Field name for {f.text}</span>
                    <input
                      className="input !min-h-9 text-[0.84rem]"
                      value={f.label}
                      maxLength={60}
                      aria-invalid={duplicate || f.label.trim() === ""}
                      onChange={(e) => onLabel(f.id, e.target.value)}
                      placeholder="field name"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => onRemove(f.id)}
                    className="grid size-8 shrink-0 place-items-center rounded-md text-faint transition-colors hover:bg-panel-2 hover:text-fray"
                    aria-label={`Remove ${f.label || "field"}`}
                  >
                    <Icon name="x" size={15} />
                  </button>
                </div>
                <p className="mt-1.5 truncate pl-1 text-xs text-faint" title={f.text}>
                  {f.text}
                </p>
                {duplicate && <p className="mt-1 pl-1 text-xs text-thread">Same name as another field, so they merge into one.</p>}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-auto space-y-3 border-t border-line p-4">
        {description && (
          <div>
            <p className="mb-1 text-xs text-faint">What Bright Data will be told</p>
            <p className="num rounded-md bg-ink px-2.5 py-2 text-xs leading-5 text-dim">{description}</p>
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className={`num text-xs ${tooLong ? "text-fray" : "text-faint"}`} aria-live="polite">
            {length}/{MAX_DESCRIPTION}
          </span>
          <button
            type="button"
            onClick={onCreate}
            disabled={fields.length === 0 || empty || tooLong || creating}
            className="btn btn-primary"
          >
            {creating ? (
              <>
                <Spinner /> Weaving…
              </>
            ) : (
              "Create scraper"
            )}
          </button>
        </div>
        {tooLong && <p className="text-xs text-fray">Too long: remove a field or shorten the names (500 characters max).</p>}
        {empty && <p className="text-xs text-fray">Give each field a name first.</p>}
      </div>
    </aside>
  );
}
