import { AVATARS } from '../../shared/constants';

export default function AvatarPicker({ value, onChange }: { value: string; onChange: (avatar: string) => void }) {
  return (
    <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Pick an avatar">
      {AVATARS.map((a) => (
        <button
          key={a}
          type="button"
          role="radio"
          aria-checked={a === value}
          onClick={() => onChange(a)}
          className={`aspect-square rounded-xl text-3xl ${a === value ? 'animate-boing bg-saffron/90 ring-4 ring-white' : 'bg-white/10'}`}
        >
          {a}
        </button>
      ))}
    </div>
  );
}
