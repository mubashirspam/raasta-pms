'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { submitSalesLog, submitCreatorLog } from '@/lib/actions/daily-log';
import type { TeamMember, EmployeeCategory, Position } from '@/db/schema';

type MemberWithRelations = TeamMember & {
  category: EmployeeCategory;
  position: Position;
};

type Step = 'category' | 'member' | 'form' | 'receipt';
type Category = 'sales' | 'creator';
type Attendance = 'present' | 'absent' | 'wfh' | 'sick';

interface Props {
  salesMembers: MemberWithRelations[];
  creatorMembers: MemberWithRelations[];
  today: string;
}

const ATTENDANCE_OPTIONS = [
  { value: 'present', label: '✅ Present' },
  { value: 'wfh', label: '🏠 Work from Home' },
  { value: 'sick', label: '🤒 Sick Leave' },
  { value: 'absent', label: '❌ Absent' },
];

const ARRIVAL_OPTIONS = [
  { value: 'Before 9:00 AM', label: 'Before 9:00 AM' },
  { value: '9:00 AM – 9:59 AM', label: '9:00 AM – 9:59 AM' },
  { value: 'After 9:59 AM', label: 'After 9:59 AM' },
];

export function DailyLogClient({ salesMembers, creatorMembers, today }: Props) {
  const [step, setStep] = useState<Step>('category');
  const [category, setCategory] = useState<Category | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberWithRelations | null>(null);
  const [attendance, setAttendance] = useState<Attendance>('present');
  const [absenceNote, setAbsenceNote] = useState('');
  const [arrivalTiming, setArrivalTiming] = useState('Before 9:00 AM');
  const [lateReason, setLateReason] = useState('');
  // Sales fields
  const [organicCalls, setOrganicCalls] = useState(0);
  const [marketingCalls, setMarketingCalls] = useState(0);
  const [videoCalls, setVideoCalls] = useState(0);
  const [faceToFace, setFaceToFace] = useState(0);
  const [reelsUploaded, setReelsUploaded] = useState(0);
  const [leadsReceived, setLeadsReceived] = useState(0);
  const [salesRevenue, setSalesRevenue] = useState(0);
  const [learnedToday, setLearnedToday] = useState('');
  const [issuesToday, setIssuesToday] = useState('');
  const [developerVisited, setDeveloperVisited] = useState(false);
  const [developerNames, setDeveloperNames] = useState<string[]>(['']);
  // Creator fields
  const [reelsGiven, setReelsGiven] = useState(0);
  const [viralVideos, setViralVideos] = useState(0);
  const [leadsGenerated, setLeadsGenerated] = useState(0);
  const [instagramVideos, setInstagramVideos] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [viralVideoRows, setViralVideoRows] = useState<Array<{ title: string; videoUrl: string; currentViews: number }>>([]);
  const [leadDistRows, setLeadDistRows] = useState<Array<{ recipientLabel: string; leadsCount: number }>>([]);
  const [igVideoRows, setIgVideoRows] = useState<Array<{ title: string; status: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');

  const connectedCalls = organicCalls + marketingCalls;
  const members = category === 'sales' ? salesMembers : creatorMembers;
  const isAbsent = attendance === 'absent';

  // ─── Category ────────────────────────────────────────────────────────────
  if (step === 'category') {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-white">Daily Log</h1>
          <p className="text-sm text-gray-500 mt-1">{today}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'sales', label: 'Sales Agent', icon: '📞' },
            { key: 'creator', label: 'Content Creator', icon: '🎬' },
          ].map((c) => (
            <button
              key={c.key}
              onClick={() => { setCategory(c.key as Category); setStep('member'); }}
              className="bg-raasta-card border border-raasta-border rounded-xl p-5 text-center hover:border-gold-500/50 hover:bg-gold-500/5 transition-colors"
            >
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="text-white font-semibold text-sm">{c.label}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ─── Member ──────────────────────────────────────────────────────────────
  if (step === 'member') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <BackBtn onClick={() => setStep('category')} />
          <h1 className="text-xl font-bold text-white">Select Your Name</h1>
        </div>
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => { setSelectedMember(m); setStep('form'); }}
            className="w-full text-left bg-raasta-card border border-raasta-border rounded-xl px-4 py-3 hover:border-gold-500/50 hover:bg-gold-500/5 transition-colors"
          >
            <div className="font-semibold text-white text-sm">{m.fullName}</div>
            <div className="text-xs text-gray-500">{m.memberCode}</div>
          </button>
        ))}
      </div>
    );
  }

  // ─── Form ─────────────────────────────────────────────────────────────────
  if (step === 'form') {
    const isSales = category === 'sales';

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);

      try {
        let result;
        if (isSales) {
          result = await submitSalesLog({
            memberId: selectedMember!.id,
            logDate: today,
            attendance,
            absenceNote: absenceNote || undefined,
            arrivalTiming: isAbsent ? undefined : (arrivalTiming as 'Before 9:00 AM' | '9:00 AM – 9:59 AM' | 'After 9:59 AM'),
            lateReason: lateReason || undefined,
            organicCalls,
            marketingCalls,
            videoCalls,
            faceToFace,
            reelsUploaded,
            leadsReceived,
            salesRevenue,
            learnedToday: learnedToday || undefined,
            issuesToday: issuesToday || undefined,
            developerVisited,
            developerNames: developerVisited ? developerNames.filter(Boolean) : [],
          });
        } else {
          result = await submitCreatorLog({
            memberId: selectedMember!.id,
            logDate: today,
            attendance,
            absenceNote: absenceNote || undefined,
            arrivalTiming: isAbsent ? undefined : (arrivalTiming as 'Before 9:00 AM' | '9:00 AM – 9:59 AM' | 'After 9:59 AM'),
            lateReason: lateReason || undefined,
            reelsGiven,
            viralVideos,
            leadsGenerated,
            instagramVideos,
            remarks: remarks || undefined,
            shootParticipantIds: [],
            viralVideoRows: viralVideoRows.map((vr) => ({
              title: vr.title,
              videoUrl: vr.videoUrl,
              currentViews: vr.currentViews,
            })),
            leadDistRows: leadDistRows.map((ld) => ({
              recipientLabel: ld.recipientLabel,
              leadsCount: ld.leadsCount,
            })),
            igVideoRows: igVideoRows.map((ig) => ({
              title: ig.title,
              status: ig.status,
            })),
          });
        }

        if (!result.success) {
          toast.error(result.error ?? 'Submission failed');
        } else {
          setReferenceNumber(result.referenceNumber ?? '');
          setStep('receipt');
        }
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-3">
          <BackBtn onClick={() => setStep('member')} />
          <div>
            <h1 className="text-xl font-bold text-white">Daily Log — {today}</h1>
            <p className="text-xs text-gray-500">{selectedMember?.fullName}</p>
          </div>
        </div>

        {/* Attendance */}
        <Card>
          <CardTitle className="mb-3">Attendance</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            {ATTENDANCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAttendance(opt.value as Attendance)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  attendance === opt.value
                    ? 'bg-gold-500 text-raasta-black'
                    : 'bg-raasta-dark border border-raasta-border text-gray-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {isAbsent && (
            <div className="mt-3">
              <Input
                label="Absence Note"
                value={absenceNote}
                onChange={(e) => setAbsenceNote(e.target.value)}
                placeholder="Reason for absence"
              />
            </div>
          )}
        </Card>

        {!isAbsent && (
          <>
            {/* Arrival timing */}
            <Card>
              <CardTitle className="mb-3">Arrival Timing</CardTitle>
              <Select
                options={ARRIVAL_OPTIONS}
                value={arrivalTiming}
                onChange={(e) => setArrivalTiming(e.target.value)}
              />
              {arrivalTiming === 'After 9:59 AM' && (
                <div className="mt-3">
                  <Input
                    label="Reason for being late *"
                    value={lateReason}
                    onChange={(e) => setLateReason(e.target.value)}
                    required
                    placeholder="Explain why you were late"
                  />
                </div>
              )}
            </Card>

            {/* Sales-specific */}
            {isSales && (
              <>
                <Card>
                  <CardTitle className="mb-3">Call Activity</CardTitle>
                  <div className="space-y-3">
                    <Input label="Organic Calls" type="number" min="0"
                      value={organicCalls} onChange={(e) => setOrganicCalls(+e.target.value)} />
                    <Input label="Marketing / Reassigned Calls" type="number" min="0"
                      value={marketingCalls} onChange={(e) => setMarketingCalls(+e.target.value)} />
                    <div className="bg-raasta-dark rounded-lg px-3 py-2 flex justify-between text-sm">
                      <span className="text-gray-400">Connected Calls (auto)</span>
                      <span className="text-gold-500 font-semibold">{connectedCalls}</span>
                    </div>
                    <Input label="Video Calls" type="number" min="0"
                      value={videoCalls} onChange={(e) => setVideoCalls(+e.target.value)} />
                    <Input label="Face-to-Face Meetings" type="number" min="0"
                      value={faceToFace} onChange={(e) => setFaceToFace(+e.target.value)} />
                  </div>
                </Card>

                <Card>
                  <CardTitle className="mb-3">Sales Performance</CardTitle>
                  <div className="space-y-3">
                    <Input label="Reels Uploaded" type="number" min="0"
                      value={reelsUploaded} onChange={(e) => setReelsUploaded(+e.target.value)} />
                    <Input label="Leads Received" type="number" min="0"
                      value={leadsReceived} onChange={(e) => setLeadsReceived(+e.target.value)} />
                    <Input label="Sales Revenue (AED)" type="number" min="0" step="0.01"
                      value={salesRevenue} onChange={(e) => setSalesRevenue(+e.target.value)} />
                  </div>
                </Card>

                <Card>
                  <CardTitle className="mb-3">Developer Visit</CardTitle>
                  <div className="flex gap-3 mb-3">
                    {['Yes', 'No'].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setDeveloperVisited(v === 'Yes')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          developerVisited === (v === 'Yes')
                            ? 'bg-gold-500 text-raasta-black'
                            : 'bg-raasta-dark border border-raasta-border text-gray-400'
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  {developerVisited && (
                    <div className="space-y-2">
                      {developerNames.map((name, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            placeholder={`Developer ${i + 1} name`}
                            value={name}
                            onChange={(e) => {
                              const updated = [...developerNames];
                              updated[i] = e.target.value;
                              setDeveloperNames(updated);
                            }}
                            className="flex-1"
                          />
                          {i > 0 && (
                            <button
                              type="button"
                              onClick={() => setDeveloperNames((d) => d.filter((_, j) => j !== i))}
                              className="text-red-400 hover:text-red-300 px-2"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeveloperNames((d) => [...d, ''])}
                      >
                        + Add Developer
                      </Button>
                    </div>
                  )}
                </Card>

                <Card>
                  <CardTitle className="mb-3">Reflections</CardTitle>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                        What did you learn today? (max 150 chars)
                      </label>
                      <textarea
                        className="w-full bg-raasta-dark border border-raasta-border rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-gold-500/60"
                        rows={2}
                        maxLength={150}
                        value={learnedToday}
                        onChange={(e) => setLearnedToday(e.target.value)}
                      />
                      <p className="text-xs text-gray-600 text-right">{learnedToday.length}/150</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                        Issues Today (max 250 chars)
                      </label>
                      <textarea
                        className="w-full bg-raasta-dark border border-raasta-border rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-gold-500/60"
                        rows={2}
                        maxLength={250}
                        value={issuesToday}
                        onChange={(e) => setIssuesToday(e.target.value)}
                      />
                      <p className="text-xs text-gray-600 text-right">{issuesToday.length}/250</p>
                    </div>
                  </div>
                </Card>
              </>
            )}

            {/* Creator-specific */}
            {!isSales && (
              <>
                <Card>
                  <CardTitle className="mb-3">Creator KPIs</CardTitle>
                  <div className="space-y-3">
                    <Input label="Reels Given" type="number" min="0"
                      value={reelsGiven} onChange={(e) => setReelsGiven(+e.target.value)} />
                    <div>
                      <Input label="Viral Videos" type="number" min="0"
                        value={viralVideos} onChange={(e) => {
                          const n = +e.target.value;
                          setViralVideos(n);
                          setViralVideoRows(Array.from({ length: n }, (_, i) => viralVideoRows[i] ?? { title: '', videoUrl: '', currentViews: 0 }));
                        }} />
                      {viralVideoRows.map((vr, i) => (
                        <div key={i} className="mt-2 bg-raasta-dark rounded-lg p-3 space-y-2 border border-raasta-border">
                          <p className="text-xs text-gray-500 font-medium">Viral Video {i + 1}</p>
                          <Input placeholder="Title" value={vr.title} onChange={(e) => {
                            const updated = [...viralVideoRows];
                            updated[i] = { ...updated[i], title: e.target.value };
                            setViralVideoRows(updated);
                          }} />
                          <Input placeholder="Video URL" type="url" value={vr.videoUrl} onChange={(e) => {
                            const updated = [...viralVideoRows];
                            updated[i] = { ...updated[i], videoUrl: e.target.value };
                            setViralVideoRows(updated);
                          }} />
                          <Input placeholder="Current Views" type="number" min="0" value={vr.currentViews} onChange={(e) => {
                            const updated = [...viralVideoRows];
                            updated[i] = { ...updated[i], currentViews: +e.target.value };
                            setViralVideoRows(updated);
                          }} />
                        </div>
                      ))}
                    </div>
                    <div>
                      <Input label="Leads Generated" type="number" min="0"
                        value={leadsGenerated} onChange={(e) => {
                          const n = +e.target.value;
                          setLeadsGenerated(n);
                          if (leadDistRows.length === 0 && n > 0) {
                            setLeadDistRows([{ recipientLabel: '', leadsCount: n }]);
                          }
                        }} />
                      {leadsGenerated > 0 && (
                        <div className="mt-2">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-xs text-gray-500 font-medium">Lead Distribution</p>
                            <p className={`text-xs font-medium ${
                              leadDistRows.reduce((s, r) => s + r.leadsCount, 0) === leadsGenerated
                                ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {leadDistRows.reduce((s, r) => s + r.leadsCount, 0)}/{leadsGenerated}
                            </p>
                          </div>
                          {leadDistRows.map((ld, i) => (
                            <div key={i} className="flex gap-2 mb-2">
                              <Input placeholder="Recipient name" value={ld.recipientLabel} onChange={(e) => {
                                const updated = [...leadDistRows];
                                updated[i] = { ...updated[i], recipientLabel: e.target.value };
                                setLeadDistRows(updated);
                              }} className="flex-1" />
                              <Input placeholder="Leads" type="number" min="1" value={ld.leadsCount} onChange={(e) => {
                                const updated = [...leadDistRows];
                                updated[i] = { ...updated[i], leadsCount: +e.target.value };
                                setLeadDistRows(updated);
                              }} className="w-20" />
                              {i > 0 && (
                                <button type="button" onClick={() => setLeadDistRows((d) => d.filter((_, j) => j !== i))}
                                  className="text-red-400 hover:text-red-300 px-2">✕</button>
                              )}
                            </div>
                          ))}
                          <Button type="button" variant="ghost" size="sm"
                            onClick={() => setLeadDistRows((d) => [...d, { recipientLabel: '', leadsCount: 0 }])}>
                            + Add Recipient
                          </Button>
                        </div>
                      )}
                    </div>
                    <div>
                      <Input label="Instagram Videos" type="number" min="0"
                        value={instagramVideos} onChange={(e) => {
                          const n = +e.target.value;
                          setInstagramVideos(n);
                          setIgVideoRows(Array.from({ length: n }, (_, i) => igVideoRows[i] ?? { title: '', status: '' }));
                        }} />
                      {igVideoRows.map((ig, i) => (
                        <div key={i} className="mt-2 bg-raasta-dark rounded-lg p-3 space-y-2 border border-raasta-border">
                          <p className="text-xs text-gray-500 font-medium">IG Video {i + 1}</p>
                          <Input placeholder="Title" value={ig.title} onChange={(e) => {
                            const updated = [...igVideoRows];
                            updated[i] = { ...updated[i], title: e.target.value };
                            setIgVideoRows(updated);
                          }} />
                          <Select placeholder="Select status" options={[
                            { value: 'Shooting', label: 'Shooting' },
                            { value: 'Editing', label: 'Editing' },
                            { value: 'Posted', label: 'Posted' },
                            { value: 'Scheduled', label: 'Scheduled' },
                          ]} value={ig.status} onChange={(e) => {
                            const updated = [...igVideoRows];
                            updated[i] = { ...updated[i], status: e.target.value };
                            setIgVideoRows(updated);
                          }} />
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                      Remarks (max 500 chars)
                    </label>
                    <textarea
                      className="w-full bg-raasta-dark border border-raasta-border rounded-xl px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-gold-500/60"
                      rows={3}
                      maxLength={500}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                    />
                    <p className="text-xs text-gray-600 text-right">{remarks.length}/500</p>
                  </div>
                </Card>
              </>
            )}
          </>
        )}

        <Button type="submit" className="w-full" loading={submitting}>
          Submit Daily Log
        </Button>
      </form>
    );
  }

  // ─── Receipt ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Card className="text-center">
        <div className="w-14 h-14 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <CardTitle>Log Submitted!</CardTitle>
        <p className="text-sm text-gray-500 mt-1">{today} — {selectedMember?.fullName}</p>
        <div className="mt-4 bg-raasta-dark rounded-lg px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Reference Number</p>
          <p className="text-gold-500 font-mono font-bold text-lg">{referenceNumber}</p>
        </div>
      </Card>
      <Button variant="outline" className="w-full"
        onClick={() => { setStep('category'); setCategory(null); setSelectedMember(null); }}>
        Submit Another Log
      </Button>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-gray-400 hover:text-white shrink-0">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
