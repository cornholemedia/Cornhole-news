import { MIDWEST_STATES } from "@/lib/midwest-states";

type StateFieldProps = {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
};

export default function StateField({ id, name, value, onChange }: StateFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        State
      </label>
      <select
        id={id}
        name={name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-input"
      >
        <option value="">None</option>
        {MIDWEST_STATES.map((state) => (
          <option key={state.code} value={state.code}>
            {state.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[12px] text-[#666]">
        Optional. The full state name is shown under the title. Leave this blank for a
        regional story or one that covers more than one state.
      </p>
    </div>
  );
}
