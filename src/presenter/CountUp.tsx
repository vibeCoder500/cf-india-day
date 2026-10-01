import { useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';

// Counts up from 0 on mount, then glides between values; renders via a MotionValue so React doesn't re-render per frame.
export default function CountUp({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString('en-IN'));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.9, ease: 'easeOut' });
    return () => controls.stop();
  }, [mv, value]);
  return <motion.span className="tabular-nums">{text}</motion.span>;
}
