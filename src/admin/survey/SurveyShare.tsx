import { QRCodeSVG } from 'qrcode.react';
import type { AdminSurvey } from '../../../shared/survey';
import { surveyMinutes } from '../../../shared/survey';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import { istDateTime } from '../../survey/time';

export const surveyLink = () => `${location.origin}/survey`;

export function inviteText(s: AdminSurvey): string {
  return [
    `📝 ${s.title}`,
    `Tell us how it went: about ${surveyMinutes(s.questions)} min${s.anonymous ? ', and it’s anonymous 🕶️' : ''}.`,
    `👉 ${surveyLink()}`,
    s.closesAt !== null ? `⏳ Closes ${istDateTime(s.closesAt)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// The link opens the survey directly (no splash). The QR can go on a slide or an office screen.
export default function SurveyShare({ s, onClose, copy }: { s: AdminSurvey; onClose: () => void; copy: (text: string, what: string) => void }) {
  const link = surveyLink();
  const invite = inviteText(s);
  return (
    <Modal title="Share the survey" onClose={onClose}>
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-2xl bg-white p-4">
          <QRCodeSVG value={link} size={240} marginSize={0} />
        </div>
        <p className="font-mono text-lg font-bold break-all">{link.replace(/^https?:\/\//, '')}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => copy(link, 'Link')}>🔗 Copy link</Button>
          <Button variant="primary" onClick={() => copy(invite, 'Invite')}>
            💬 Copy invite message
          </Button>
        </div>
        <pre className="w-full rounded-xl bg-black/30 p-3 font-sans text-sm whitespace-pre-wrap">{invite}</pre>
      </div>
    </Modal>
  );
}
