import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-saffron text-night hover:brightness-110',
  secondary: 'bg-white/10 text-white hover:bg-white/20',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  ghost: 'text-white/80 hover:bg-white/10',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; big?: boolean };

export default function Button({ variant = 'secondary', big = false, className = '', type = 'button', ...rest }: Props) {
  return (
    <button
      type={type}
      className={`rounded-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${big ? 'px-5 py-3 text-lg' : 'px-3 py-2 text-sm'} ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
