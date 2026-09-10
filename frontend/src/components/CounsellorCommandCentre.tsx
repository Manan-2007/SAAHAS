import React, { useState } from 'react';
import { 
  Shield, 
  Users, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp, 
  FileText, 
  MessageSquare, 
  Phone, 
  ArrowLeft, 
  UserCheck, 
  Plus, 
  Search,
  ExternalLink
} from 'lucide-react';
import { ClientRecord, UserPersona, AppView } from '../types';
import { COUNSELLOR_CASELOAD, USER_PROFILE } from '../data/mockData';

interface CounsellorCommandCentreProps {
  onBack: () => void;
  onPersonaChange: (persona: UserPersona) => void;
  onOpenCall: () => void;
  onNavigate: (view: AppView) => void;
}

export const CounsellorCommandCentre: React.FC<CounsellorCommandCentreProps> = ({
  onBack,
  onPersonaChange,
  onOpenCall,
  onNavigate,
}) => {
  const [caseload, setCaseload] = useState<ClientRecord[]>(COUNSELLOR_CASELOAD);
  const [selectedClient, setSelectedClient] = useState<ClientRecord>(COUNSELLOR_CASELOAD[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newNote, setNewNote] = useState('');

  const filteredClients = caseload.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.caseRef.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const updated = caseload.map(c => {
      if (c.id === selectedClient.id) {
        return {
          ...c,
          notes: `${newNote.trim()} (${new Date().toLocaleDateString()})\n\n${c.notes}`,
        };
      }
      return c;
    });
    setCaseload(updated);
    setSelectedClient(prev => ({
      ...prev,
      notes: `${newNote.trim()} (${new Date().toLocaleDateString()})\n\n${prev.notes}`,
    }));
    setNewNote('');
  };

  return (
    <div className="flex flex-col max-w-4xl mx-auto w-full px-4 gap-5 pb-8 animate-fadeIn">
      {/* Top Banner with Persona Switch Back */}
      <div className="bg-gradient-to-r from-[#263238] to-[#111d23] text-white p-4 rounded-2xl shadow-sm flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <img
            src={USER_PROFILE.counsellorAvatar}
            alt={USER_PROFILE.assignedCounsellor}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-[#a3ede4]"
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">{USER_PROFILE.assignedCounsellor}</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#00685d] text-[#a3ede4] text-[10px] font-bold uppercase tracking-wider">
                Clinical Caregiver
              </span>
            </div>
            <p className="text-xs text-slate-300">Trauma-Informed Victim Support Caseload (3 active cases)</p>
          </div>
        </div>

        <button
          onClick={() => {
            onPersonaChange('victim');
            onNavigate('home-dashboard');
          }}
          className="px-3.5 py-1.5 rounded-xl bg-[#a3ede4] text-[#00201c] hover:bg-[#8cf5e4] text-xs font-bold transition-all active:scale-95 shadow-sm flex items-center gap-1.5"
        >
          <UserCheck className="w-4 h-4" />
          <span>Switch to Sunita (Victim View)</span>
        </button>
      </div>

      {/* Caseload Grid & Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left column: Caseload list */}
        <div className="bg-white rounded-2xl p-4 border border-[#ddeaf2] shadow-xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#111d23]">Active Client Roster</h3>
            <span className="text-xs text-[#00685d] font-semibold">{filteredClients.length} clients</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[#6d7a77]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search case # or name..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#e9f6fd] text-xs text-[#111d23] placeholder-[#6d7a77] outline-none border border-[#ddeaf2]"
            />
          </div>

          <div className="flex flex-col gap-2 mt-1">
            {filteredClients.map((client) => {
              const isSelected = client.id === selectedClient.id;
              return (
                <div
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-[#00685d] bg-[#e9f6fd]'
                      : 'border-[#ddeaf2] hover:bg-[#f4faff]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#111d23]">{client.name}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        client.status === 'Stable'
                          ? 'bg-[#a3ede4]/50 text-[#1d6e67]'
                          : client.status === 'Attention'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {client.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#6d7a77] mt-1">
                    <span>{client.caseRef}</span>
                    <span>Next: {client.nextHearing.split(' ')[0]} {client.nextHearing.split(' ')[1]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 columns: Selected client details, telemetry & care plan */}
        <div className="md:col-span-2 flex flex-col gap-4">
          {/* Header Card for Selected Client */}
          <div className="bg-white rounded-2xl p-5 border border-[#ddeaf2] shadow-xs flex flex-col gap-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-[#111d23]">{selectedClient.name}</h3>
                  <span className="text-xs text-[#6d7a77]">Age {selectedClient.age}</span>
                </div>
                <p className="text-xs text-[#00685d] font-semibold mt-0.5">
                  Case ID: {selectedClient.caseRef} · {selectedClient.assignedCounsellor}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenCall}
                  className="px-3 py-1.5 rounded-lg bg-[#00685d] text-white text-xs font-semibold flex items-center gap-1 hover:bg-[#008376] transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Initiate Call</span>
                </button>
                <button
                  onClick={() => onNavigate('safe-chat')}
                  className="px-3 py-1.5 rounded-lg bg-[#e9f6fd] text-[#00685d] text-xs font-semibold flex items-center gap-1 hover:bg-[#a3ede4]/40 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Open Safe Chat</span>
                </button>
              </div>
            </div>

            {/* Well-being telemetry snapshot */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#f4faff] border border-[#ddeaf2]">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[#6d7a77] uppercase">Stress Drift</span>
                <span className="text-xs font-bold text-[#00685d] mt-0.5">
                  {selectedClient.recentTrends.stress}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[#6d7a77] uppercase">Energy Baseline</span>
                <span className="text-xs font-bold text-[#166963] mt-0.5">
                  {selectedClient.recentTrends.energy}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[#6d7a77] uppercase">Physical Fatigue</span>
                <span className="text-xs font-bold text-[#4e5f62] mt-0.5">
                  {selectedClient.recentTrends.fatigue}
                </span>
              </div>
            </div>

            {/* Hearing & Session Schedule */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#e9f6fd]/70 text-xs border border-[#ddeaf2]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#00685d]" />
                <span className="text-[#111d23]">
                  Next Legal Session: <strong>{selectedClient.nextHearing}</strong>
                </span>
              </div>
              <span className="text-[#00685d] font-semibold">Liaison Assigned</span>
            </div>
          </div>

          {/* Clinical Notes & Action Plan */}
          <div className="bg-white rounded-2xl p-5 border border-[#ddeaf2] shadow-xs flex flex-col gap-3">
            <h4 className="text-sm font-bold text-[#111d23] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#00685d]" />
              <span>Trauma-Informed Care Notes & Observations</span>
            </h4>

            <div className="bg-[#f4faff] p-3.5 rounded-xl border border-[#ddeaf2] text-xs text-[#3d4947] leading-relaxed whitespace-pre-line max-h-40 overflow-y-auto">
              {selectedClient.notes}
            </div>

            {/* Add note input */}
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Log observation or prep milestone..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#e9f6fd] text-xs text-[#111d23] placeholder-[#6d7a77] outline-none border border-[#ddeaf2]"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="px-4 py-2 rounded-xl bg-[#00685d] text-white text-xs font-semibold hover:bg-[#008376] disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
