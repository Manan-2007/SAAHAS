import React, { useState } from 'react';
import { CaseData, InterventionItem } from '../types';

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
  const [newAssignedTo, setNewAssignedTo] = useState('Dr. Ananya Sharma');

  const handleAddIntervention = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: InterventionItem = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      subtitle: `Assigned to ${newAssignedTo} • Custom Protocol`,
      assignedTo: newAssignedTo,
      priority: 'Priority 2',
      status: 'Pending',
      completed: false,
    };

    activeCase.interventions.push(newItem);
    setNewTitle('');
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-xl p-5 shadow-xs border border-[#ece2ce] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#9c6743] text-[24px]">
              health_and_safety
            </span>
            <h2 className="font-['Plus_Jakarta_Sans'] text-xl text-[#352e24] font-bold">
              Interventions & Care Coordination
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#e7d3b5] text-[#7a5a3f] font-['Inter'] text-xs font-bold">
              Human-Certified
            </span>
          </div>
          <p className="font-['Plus_Jakarta_Sans'] text-xs text-[#837562] mt-1">
            Trauma-informed action plans. No algorithmic intervention is dispatched without counselor review.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenScheduleFollowUp}
            className="px-3 py-2 rounded-lg bg-[#e7d3b5] hover:bg-[#e7d3b5] text-[#7a5a3f] font-['Inter'] text-xs font-semibold flex items-center gap-1 shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            <span>Schedule Follow-up</span>
          </button>
          <button
            type="button"
            onClick={onOpenAssignCounsellor}
            className="px-3 py-2 rounded-lg bg-[#9c6743] hover:bg-[#b3654a] text-white font-['Inter'] text-xs font-semibold flex items-center gap-1 shadow-xs"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            <span>Assign Staff</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Case selector sidebar on left */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#352e24] px-1">
            Active Care Plans
          </h3>
          <div className="space-y-2">
            {cases.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedCaseId(c.id)}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${
                  c.id === activeCase.id
                    ? 'bg-[#efe7d6] border-[#9c6743] shadow-xs'
                    : 'bg-white border-[#ece2ce] hover:bg-[#f5f1e8]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#352e24]">{c.name}</span>
                  <span className="text-xs font-mono text-[#837562]">{c.number}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-[#837562]">
                  <span>{c.interventions.length} items planned</span>
                  <span
                    className={`font-semibold ${
                      c.interventions.filter((i) => i.completed).length === c.interventions.length
                        ? 'text-[#8a6a4a]'
                        : 'text-[#ba1a1a]'
                    }`}
                  >
                    {c.interventions.filter((i) => i.completed).length} / {c.interventions.length} done
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Case Interventions Checklist & Manager */}
        <div className="lg:col-span-8 bg-white rounded-xl p-6 shadow-xs border border-[#ece2ce] space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#efe7d6]">
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#352e24]">
                Care Protocol for {activeCase.name} ({activeCase.number})
              </h3>
              <p className="text-xs text-[#837562] mt-0.5">
                Caregiver: {activeCase.assignedCounsellor} • Rationale: {activeCase.whyRecommended}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#efe7d6] text-[#9c6743] font-['Inter'] text-xs font-bold">
              {activeCase.status}
            </span>
          </div>

          {/* Intervention Items */}
          <div className="space-y-3">
            {activeCase.interventions.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl border border-[#e5dac4] bg-[#f5f1e8] hover:bg-[#efe7d6] transition-colors flex items-center justify-between"
              >
                <label className="flex items-center gap-3 cursor-pointer flex-1 mr-3">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => onToggleIntervention(activeCase.id, item.id)}
                    className="w-5 h-5 rounded text-[#9c6743] focus:ring-[#9c6743] accent-[#9c6743]"
                  />
                  <div className="flex flex-col">
                    <span
                      className={`text-sm font-medium ${
                        item.completed ? 'line-through text-[#837562]' : 'text-[#352e24]'
                      }`}
                    >
                      {item.title}
                    </span>
                    <span className="text-xs text-[#837562]">{item.subtitle}</span>
                  </div>
                </label>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${
                      item.status === 'In Progress'
                        ? 'bg-[#e7d3b5] text-[#7a5a3f]'
                        : item.status === 'Completed'
                        ? 'bg-[#efe7d6] text-[#9c6743]'
                        : 'bg-[#e5dac4] text-[#837562]'
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
            className="p-4 rounded-xl bg-[#efe7d6] border border-[#e5dac4] space-y-3"
          >
            <h4 className="font-['Plus_Jakarta_Sans'] text-xs font-bold text-[#352e24] uppercase tracking-wider">
              Add Tailored Clinical Intervention
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="e.g. Schedule trauma legal aid escort..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="sm:col-span-2 p-2.5 rounded-lg border border-[#e5dac4] bg-white text-xs text-[#352e24] focus:outline-none focus:border-[#9c6743]"
              />
              <select
                value={newAssignedTo}
                onChange={(e) => setNewAssignedTo(e.target.value)}
                className="p-2.5 rounded-lg border border-[#e5dac4] bg-white text-xs text-[#352e24]"
              >
                <option>Dr. Ananya Sharma</option>
                <option>Advocate Meera Sen</option>
                <option>Security Coordinator Tarun</option>
                <option>Finance Desk</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#9c6743] text-white hover:bg-[#b3654a] font-['Inter'] text-xs font-semibold shadow-xs"
            >
              Add to Active Protocol
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
