import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'motion/react';
import type { AdminState } from '../../shared/protocol';
import CountUp from './CountUp';

const SHOWN = 60;

export default function LobbyScreen({ admin }: { admin: AdminState }) {
  const latest = [...admin.players].sort((a, b) => b.joinedAt - a.joinedAt);
  return (
    <div className="grid h-full grid-cols-2 gap-[4vw] p-[4vw]">
      <div className="flex flex-col items-center justify-center gap-[2vh] text-center">
        <h1 className="font-display text-[clamp(3rem,6vw,6rem)] leading-none font-extrabold">
          CorpFun Day <span className="inline-block animate-wiggle">🥳</span>
        </h1>
        <p className="text-[clamp(1.5rem,2.5vw,2.75rem)] font-bold opacity-90">Scan to join</p>
        <div className="rounded-3xl bg-white p-[2vh] shadow-2xl">
          <QRCodeSVG value={location.origin} size={512} marginSize={0} style={{ width: 'min(40vh, 40vw)', height: 'min(40vh, 40vw)' }} />
        </div>
        <p className="font-mono text-[clamp(1.25rem,2vw,2.25rem)] font-bold">{location.host}</p>
      </div>
      <div className="flex min-h-0 flex-col gap-[3vh] py-[2vh]">
        <p className="font-display text-[clamp(2rem,4vw,4.5rem)] leading-none font-extrabold">
          🎉 <CountUp value={admin.total} /> {admin.total === 1 ? 'player' : 'players'}
        </p>
        {latest.length === 0 ? (
          <p className="text-[clamp(1.25rem,2vw,2rem)] opacity-70">Waiting for the first brave soul… 👀</p>
        ) : (
          <div className="flex min-h-0 flex-wrap content-start gap-[0.8vw] overflow-hidden">
            {latest.slice(0, SHOWN).map((p) => (
              <motion.span
                key={p.id}
                layout
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                className="flex items-center gap-2 rounded-full bg-white/10 px-[1vw] py-[0.6vh] text-[clamp(1rem,1.5vw,1.75rem)] font-bold"
              >
                <span>{p.avatar}</span>
                <span className="max-w-[16vw] truncate">{p.name}</span>
              </motion.span>
            ))}
            {latest.length > SHOWN && (
              <span className="flex items-center rounded-full bg-saffron px-[1vw] py-[0.6vh] text-[clamp(1rem,1.5vw,1.75rem)] font-bold text-night">
                +{latest.length - SHOWN} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
