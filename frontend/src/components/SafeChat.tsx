import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Mic, 
  MicOff, 
  Lock, 
  Eye, 
  EyeOff, 
  Trash2, 
  Sparkles, 
  Phone, 
  ArrowLeft, 
  ShieldCheck, 
  Volume2 
} from 'lucide-react';
import { ChatMessage, AppView } from '../types';
import { INITIAL_CHAT_MESSAGES, USER_PROFILE } from '../data/mockData';

interface SafeChatProps {
  onBack: () => void;
  onOpenCall: () => void;
}

export const SafeChat: React.FC<SafeChatProps> = ({ onBack, onOpenCall }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [activePartner, setActivePartner] = useState<'sahaas' | 'counsellor'>('sahaas');
  const [discreetMode, setDiscreetMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const promptSuggestions = [
    "I'm feeling very overwhelmed about the hearing",
    "Can you help me ground myself right now?",
    "What rights do I have when speaking in court?",
    "I just need someone quiet to listen"
  ];

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      senderName: USER_PROFILE.name,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputText('');
    setIsTyping(true);

    // Realistic trauma-informed response
    setTimeout(() => {
      let replyText = '';
      if (activePartner === 'counsellor') {
        replyText = `Sunita, Dr. Ananya here. I read your words carefully. Your feelings are 100% valid and protective. You don't have to face this alone. I will be reviewing our prep notes with you before the session on Saturday, and our court liaison is confirmed for Thursday. Take a slow sip of water right now.`;
      } else {
        if (text.toLowerCase().includes('overwhelm') || text.toLowerCase().includes('hearing') || text.toLowerCase().includes('court')) {
          replyText = `I hear how heavy this feels. Court proceedings can trigger intense bodily alarms. Let's remember: you do not have to know all legal answers. Your advocate speaks for procedural steps. If you feel panic rising, you can request a 5-minute comfort recess at any point. Would you like to practice a 30-second sensory grounding right now?`;
        } else if (text.toLowerCase().includes('ground') || text.toLowerCase().includes('breathe')) {
          replyText = `Let's ground together: Feel the solid surface beneath you. Plant both feet flat. Inhale gently for 4 counts... 1, 2, 3, 4. Hold gently... 2, 3. Exhale like blowing through a straw... 1, 2, 3, 4, 5, 6. You are safe in this present second.`;
        } else {
          replyText = `Thank you for sharing that with me. It takes courage to put feelings into words. Take all the time you need. I am here with you, completely without judgment.`;
        }
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: activePartner === 'counsellor' ? 'counsellor' : 'sahaas',
        senderName: activePartner === 'counsellor' ? USER_PROFILE.assignedCounsellor : 'SAHAAS Sanctuary',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, botMsg]);
      setIsTyping(false);
    }, 1200);
  };

  const handleSendVoiceNote = () => {
    setIsRecordingAudio(true);
    setTimeout(() => {
      setIsRecordingAudio(false);
      const audioMsg: ChatMessage = {
        id: `aud-${Date.now()}`,
        sender: 'user',
        senderName: USER_PROFILE.name,
        text: 'Voice note (0:08) - "Sharing my thoughts gently without typing..."',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAudio: true,
        audioDuration: '0:08',
      };
      setMessages((prev) => [...prev, audioMsg]);
      setIsTyping(true);

      setTimeout(() => {
        const responseMsg: ChatMessage = {
          id: `bot-aud-${Date.now()}`,
          sender: 'sahaas',
          senderName: 'SAHAAS Sanctuary',
          text: 'Thank you for sharing your voice. It is warm, steady, and heard. You sounded calm despite the tiredness. Resting right now is productive care.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, responseMsg]);
        setIsTyping(false);
      }, 1500);
    }, 2500);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'msg-cleared',
        sender: 'sahaas',
        senderName: 'SAHAAS Sanctuary',
        text: 'Chat history cleared. Ephemeral memory wiped from active session.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-145px)] max-w-md md:max-w-2xl lg:max-w-3xl mx-auto w-full px-3 animate-fadeIn">
      {/* Top Chat Partner Bar */}
      <div className="bg-white rounded-2xl p-3 shadow-2xs border border-[#ddeaf2] flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <button 
            onClick={onBack}
            className="p-1.5 rounded-lg text-[#3d4947] hover:bg-[#e9f6fd] transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex bg-[#e9f6fd] p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActivePartner('sahaas')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activePartner === 'sahaas'
                  ? 'bg-white text-[#00685d] shadow-2xs'
                  : 'text-[#3d4947] hover:text-[#111d23]'
              }`}
            >
              SAHAAS AI
            </button>
            <button
              onClick={() => setActivePartner('counsellor')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                activePartner === 'counsellor'
                  ? 'bg-white text-[#00685d] shadow-2xs'
                  : 'text-[#3d4947] hover:text-[#111d23]'
              }`}
            >
              Dr. Ananya
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Discreet Mode Toggle */}
          <button
            onClick={() => setDiscreetMode(!discreetMode)}
            className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${
              discreetMode ? 'bg-[#ffdad6] text-[#93000a]' : 'bg-[#e9f6fd] text-[#1d6e67] hover:bg-[#a3ede4]/40'
            }`}
            title={discreetMode ? 'Discreet Mode Active (Hover to reveal)' : 'Turn on Discreet Masking'}
          >
            {discreetMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">{discreetMode ? 'Masked' : 'Discreet'}</span>
          </button>

          {/* Call Counsellor Quick Button */}
          <button
            onClick={onOpenCall}
            className="p-2 rounded-lg bg-[#00685d] text-white hover:bg-[#008376] transition-colors shadow-2xs"
            title="Direct Voice Call with Counsellor"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Ephemeral Wipe */}
          <button
            onClick={handleClearHistory}
            className="p-2 rounded-lg text-[#6d7a77] hover:text-[#ba1a1a] hover:bg-red-50 transition-colors"
            title="Wipe Session Memory"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Encryption & Security Banner */}
      <div className="flex items-center justify-center gap-1.5 py-1 text-[11px] text-[#00685d] font-medium bg-[#e9f6fd]/80 rounded-lg mb-2">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>End-to-End Encrypted · Zero Cloud Traces</span>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 py-2 scroll-smooth">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-baseline gap-1.5 mb-0.5 px-1">
                <span className="text-[11px] font-semibold text-[#3d4947]">{msg.senderName}</span>
                <span className="text-[10px] text-[#6d7a77]">{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[85%] sm:max-w-[75%] p-3.5 rounded-2xl text-sm leading-relaxed transition-all shadow-2xs ${
                  isUser
                    ? 'bg-[#00685d] text-white rounded-tr-xs'
                    : 'bg-white text-[#111d23] rounded-tl-xs border border-[#ddeaf2]'
                } ${discreetMode ? 'filter blur-sm hover:filter-none active:filter-none cursor-pointer select-none transition duration-200' : ''}`}
              >
                {msg.isAudio ? (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                      <Volume2 className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold">{msg.text}</span>
                      <span className="text-[10px] opacity-80">{msg.audioDuration} recorded</span>
                    </div>
                  </div>
                ) : (
                  <p>{msg.text}</p>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 p-3 bg-white rounded-2xl rounded-tl-xs border border-[#ddeaf2] w-24 text-[#00685d]">
            <span className="w-2 h-2 rounded-full bg-[#00685d] animate-bounce"></span>
            <span className="w-2 h-2 rounded-full bg-[#00685d] animate-bounce [animation-delay:0.2s]"></span>
            <span className="w-2 h-2 rounded-full bg-[#00685d] animate-bounce [animation-delay:0.4s]"></span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Suggested gentle conversation starters */}
      <div className="py-2 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {promptSuggestions.map((prompt, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(prompt)}
            className="whitespace-nowrap px-3 py-1 rounded-full bg-[#e9f6fd] text-[#1d6e67] hover:bg-[#a3ede4]/40 text-xs font-medium border border-[#ddeaf2] transition-colors shrink-0"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Message Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="bg-white p-2 rounded-2xl shadow-xs border border-[#ddeaf2] flex items-center gap-2"
      >
        <button
          type="button"
          onClick={handleSendVoiceNote}
          className={`p-2.5 rounded-xl transition-colors ${
            isRecordingAudio 
              ? 'bg-red-500 text-white animate-pulse' 
              : 'text-[#166963] hover:bg-[#e9f6fd]'
          }`}
          title="Send a gentle voice note"
        >
          {isRecordingAudio ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isRecordingAudio ? "Recording audio note (3s)..." : "Share whatever is on your mind..."}
          disabled={isRecordingAudio}
          className="flex-1 bg-transparent text-sm text-[#111d23] placeholder-[#6d7a77] outline-none px-1"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isRecordingAudio}
          className="p-2.5 rounded-xl bg-[#00685d] text-white disabled:opacity-40 hover:bg-[#008376] active:scale-95 transition-all shadow-2xs"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
