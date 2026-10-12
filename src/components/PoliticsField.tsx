type PoliticsFieldProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

export default function PoliticsField({ id, checked, onChange }: PoliticsFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-2 text-sm leading-relaxed text-[#1a1a1a]">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-4 w-4 accent-[#3f679b]"
        />
        <span>
          <span className="font-medium">Politics</span>
          <span className="mt-0.5 block text-[13px] text-[#666]">
            Tag this post as political. Readers can hide political posts on the home page.
          </span>
        </span>
      </label>
    </div>
  );
}
