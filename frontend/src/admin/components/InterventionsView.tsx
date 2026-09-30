import React, { useState } from 'react';
import { CaseData, InterventionItem } from '../types';
import { PageHeader, QuietButton } from './PageHeader';

interface InterventionsViewProps {
  cases: CaseData[];
  onToggleIntervention: (caseId: string, interventionId: string) => void;
  onOpenAssignCounsellor: () => void;
  onOpenScheduleFollowUp: () => void;
}

export const InterventionsView: React.FC<InterventionsViewProps> = ({
  cases,
  onToggleIntervention,
  onOpenAssignCounsellor,
  onOpenScheduleFollowUp,
}) => {
  const [selectedCaseId, setSelectedCaseId] = useState<string>(cases[0].id);
  const activeCase = cases.find((c) => c.id === selectedCaseId) || cases[0];
  const [newTitle, setNewTitle] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('Counsellor');
  // Items added here are a checklist on this screen only; alerts and case dates come from the backend
  const [custom, setCustom] = useState<Record<string, InterventionItem[]>>({});

  const itemsFor = (c: CaseData) => [...c.interventions, ...(custom[c.id] ?? [])];

  const handleAddIntervention = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: InterventionItem = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      subtitle: `Assigned to ${newAssignedTo} • Added here`,
      assignedTo: newAssignedTo,
      priority: 'Priority 2',
      status: 'Pending',
      completed: false,
    };

    setCustom((prev) => ({ ...prev, [activeCase.id]: [...(prev[activeCase.id] ?? []), newItem] }));
    setNewTitle('');
  };

  const toggle = (item: InterventionItem) => {
    if (!item.id.startsWith('custom-')) {
      onToggleIntervention(activeCase.id, item.id);
      return;
    }
    setCustom((prev) => ({
      ...prev,
      [activeCase.id]: (prev[activeCase.id] ?? []).map((i) =>
        i.id === item.id ? { ...i, completed: !i.completed, status: i.completed ? 'Pending' : 'Completed' } : i,
      ),
    }));
  };

  return (
    <div className="flex flex-col space-y-6">
      <PageHeader
        title="Care plans"
        description="What each person's plan asks of you next. Nothing is sent to anyone without you."
        actions={
          <>
            <QuietButton icon="event" onClick={onOpenScheduleFollowUp}>Schedule follow-up</QuietButton>
            <QuietButton icon="person_add" onClick={onOpenAssignCounsellor}>Reassign</QuietButton>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Case selector sidebar on left */}
        <div className="lg:col-span-4 space-y-3">
          <h2 className="text-[13px] font-semibold text-ink-2 px-1">People</h2>
          <div className="space-y-2">
            {cases.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                className={`p-4 rounded-tile cursor-pointer transition-all border ${
                  c.id === activeCase.id
                    ? 'bg-raised border-line-strong'
                    : 'bg-surface border-line hover:bg-raised'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-ink">{c.name}</span>
                  <span className="text-xs font-mono text-ink-2">{c.number}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-ink-2">
                  <span>{itemsFor(c).length} {itemsFor(c).length === 1 ? 'step' : 'steps'}</span>
                  <span className="font-semibold text-ink-2">
                    {itemsFor(c).filter((i) => i.completed).length} of {itemsFor(c).length} done
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Case Interventions Checklist & Manager */}
        <div className="lg:col-span-8 bg-surface rounded-card p-6 border border-line space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <h3 className="text-[17px] font-semibold text-ink">
                {activeCase.name}’s plan <span className="text-[13px] font-normal text-ink-2">{activeCase.number}</span>
              </h3>
              <p className="text-[13px] text-ink-2 mt-0.5">Why: {activeCase.whyRecommended}</p>
            </div>
            <span className="text-[12px] text-ink-2 shrink-0">{activeCase.status}</span>
          </div>

          {/* Intervention Items */}
          <div>
            {itemsFor(activeCase).map((item) => (
              <div
                key={item.id}
                className="py-3 border-b border-line last:border-b-0 flex items-center justify-between"
              >
                <label className="flex items-center gap-3 cursor-pointer flex-1 mr-3">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggle(item)}
                    className="w-5 h-5 rounded text-sun focus:ring-sun accent-sun"
                  />
                  <div className="flex flex-col">
                    <span
                      className={`text-sm font-medium ${
                        item.completed ? 'line-through text-ink-2' : 'text-ink'
                      }`}
                    >
                      {item.title}
                    </span>
                    <span className="text-xs text-ink-2">{item.subtitle}</span>
                  </div>
                </label>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                      item.status === 'In Progress'
                        ? 'bg-soft text-ink'
                        : item.status === 'Completed'
                        ? 'bg-raised text-sun'
                        : 'bg-soft text-ink-2'
                    }`}
                  >
                    {item.completed ? 'Completed' : item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Add custom intervention action */}
          <form
            onSubmit={handleAddIntervention}
            className="p-4 rounded-tile border border-line space-y-3"
          >
            <h4 className="text-[13px] font-semibold text-ink">Add a step</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="e.g. Arrange a legal-aid escort for the hearing"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="sm:col-span-2 p-2.5 rounded-lg border border-line bg-surface text-xs text-ink focus:outline-none focus:border-sun"
              />
              <select
                value={newAssignedTo}
                onChange={(e) => setNewAssignedTo(e.target.value)}
                className="p-2.5 rounded-lg border border-line bg-surface text-xs text-ink"
              >
                <option>Counsellor</option>
                <option>Legal advocate</option>
                <option>Case worker</option>
                <option>Compensation desk</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-ink text-canvas hover:bg-ink/90 text-xs font-semibold"
            >
              Add to Active Protocol
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
