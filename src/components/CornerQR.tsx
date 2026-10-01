import { QRCodeSVG } from 'qrcode.react';

export default function CornerQR() {
  return (
    <div className="fixed right-4 bottom-4 z-30 rounded-2xl bg-white p-3 text-center text-night shadow-2xl">
      <QRCodeSVG value={location.origin} size={160} marginSize={0} />
      <p className="mt-1 max-w-[160px] truncate text-sm font-bold">{location.host}</p>
    </div>
  );
}
