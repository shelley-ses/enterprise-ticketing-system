import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Bot, Send, Paperclip, ChevronDown, ChevronUp, X, CheckCircle, AlertTriangle, Plus, MessageSquare, Trash2, ArrowLeft, Clock } from 'lucide-react';
import axiosInstance from '@/api/axiosInstance';
import { AI_API_URL } from '@/config/api.config';
import { getTicketFormOptions, createTicket } from '@/services/ticketService';

const formatTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const formatShortTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

function FormattedText({ text }) {
  if (typeof text !== 'string') return text;

  const lines = text.split('\n');
  return (
    <div className="text-sm leading-relaxed break-words space-y-1">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const cleanLine = isBullet ? trimmed.substring(2) : line;

        // Match **bold**, *italic*, and `code`
        const parts = cleanLine.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
        const elements = parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
            return <strong key={idx} className="font-bold">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
            return <em key={idx} className="italic">{part.slice(1, -1)}</em>;
          }
          if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
            return <code key={idx} className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
          }
          return part;
        });

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-2">
              <span className="text-gray-900 font-bold flex-shrink-0 select-none">•</span>
              <div>{elements}</div>
            </div>
          );
        }

        return (
          <p key={lineIdx} className={lineIdx > 0 && line === '' ? 'h-2' : ''}>
            {elements}
          </p>
        );
      })}
    </div>
  );
}

const suggestionChips = [
  'Printer won\'t start',
  'Machine Error 402',
  'Paper Jam',
  'Scanner not detected',
  'Network Issue',
  'Replace Toner',
];

const welcomeMessage = {
  id: 'welcome',
  role: 'ai',
  content: (
    <div>
      <p className="text-base font-semibold mb-2">Hello! I'm your AI Support Assistant.</p>
      <p className="text-sm leading-relaxed">
        I can help troubleshoot your purchased machines using the company's knowledge base, manuals, FAQs, and troubleshooting guides. If your issue cannot be resolved, I can also assist in preparing a support ticket for submission.
      </p>
    </div>
  ),
  timestamp: new Date().toISOString(),
};

const gatherDetailsMessage = {
  id: 'gather-details',
  role: 'ai',
  content: (
    <div>
      <p className="text-sm font-semibold mb-2">Before I begin troubleshooting, I'd like to gather a few details so I can provide the most accurate assistance</p>
      <ol className="list-decimal list-inside text-sm space-y-1 text-gray-700">
        <li>What machine are you having an issue?</li>
        <li>What is the brand and model of the machine?</li>
        <li>Do you know the serial number? (Type "Not Available" if you dont)</li>
        <li>What problem are you experiencing?</li>
        <li>Are there any troubleshooting you already did?</li>
      </ol>
    </div>
  ),
  timestamp: new Date().toISOString(),
};

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-3 max-w-[75%]">
        <div className="w-8 h-8 rounded-full bg-[#252578] flex items-center justify-center flex-shrink-0">
          <Bot size={16} className="text-white" />
        </div>
        <div className="bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-md shadow-sm px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AISourceList({ sources }) {
  const [expanded, setExpanded] = useState(false);
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#252578] hover:underline cursor-pointer"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Sources ({sources.length})
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {sources.map((src, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className="w-1 h-1 rounded-full bg-gray-400" />
              {src}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TicketRecommendationCard({ onCreateTicket, onContinue }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] w-full">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl rounded-bl-md shadow-sm p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800">Need Further Assistance?</p>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                It appears that your issue requires technical support. Would you like to create a support ticket using the information we've gathered?
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={onCreateTicket}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Create Ticket
                </button>
                <button
                  onClick={onContinue}
                  className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                >
                  Continue Chatting
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketReviewModal({ isOpen, data, onClose, onSubmit }) {
  const [form, setForm] = useState(data || {});
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Review Support Ticket</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 cursor-pointer">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Machine Model</label>
              <input
                type="text"
                value={form.machineModel || ''}
                onChange={(e) => setForm({ ...form, machineModel: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Company Name</label>
              <input
                type="text"
                value={form.companyName || ''}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Purchase Date</label>
              <input
                type="date"
                value={form.purchaseDate || ''}
                onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Suggested Category</label>
              <select
                value={form.category || 'Hardware'}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578] bg-white"
              >
                <option>Hardware</option>
                <option>Software</option>
                <option>Network</option>
                <option>Consumables</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Suggested Priority</label>
              <select
                value={form.priority || 'Medium'}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578] bg-white"
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Problem Summary</label>
            <textarea
              rows={3}
              value={form.problemSummary || ''}
              onChange={(e) => setForm({ ...form, problemSummary: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578] resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Conversation Summary</label>
            <textarea
              rows={4}
              value={form.conversationSummary || ''}
              onChange={(e) => setForm({ ...form, conversationSummary: e.target.value })}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-[#252578] resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#252578] hover:bg-[#1f1f66] transition-all cursor-pointer"
          >
            Submit Ticket
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessDialog({ isOpen, ticketNumber, onViewTicket, onClose }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle size={24} className="text-green-700" />
        </div>
        <h2 className="mt-4 text-lg font-bold text-gray-900">Support Ticket Successfully Created</h2>
        <p className="mt-2 text-sm text-gray-500">Ticket Number</p>
        <p className="text-2xl font-bold text-[#252578]">{ticketNumber}</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={onViewTicket}
            className="rounded-xl bg-[#252578] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f1f66] cursor-pointer"
          >
            View Ticket
          </button>
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

function AISupportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const effectiveUser = user || getStoredUser();
  const currentUserId = effectiveUser?.id;

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messages, setMessages] = useState([welcomeMessage, gatherDetailsMessage]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestionChips, setShowSuggestionChips] = useState(true);
  const [showTicketCard, setShowTicketCard] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [conversationPhase, setConversationPhase] = useState(0);
  const [escalationTicketData, setEscalationTicketData] = useState(null);
  const [ticketOptions, setTicketOptions] = useState(null);

  useEffect(() => {
    getTicketFormOptions()
      .then(opts => setTicketOptions(opts))
      .catch(err => console.warn("Failed to load ticket form options:", err));
  }, []);

  // Store per-conversation state
  const conversationStateRef = useRef({});

  // Load all conversations from MongoDB
  const fetchConversationsListOnly = useCallback(() => {
    axiosInstance.get(`${AI_API_URL}/conversations`, { baseURL: '', params: { user_id: currentUserId } })
      .then(res => {
        if (res.data.success && res.data.conversations) {
          setConversations(res.data.conversations);
        }
      })
      .catch(err => {
        console.error("Failed to refresh conversations list:", err);
      });
  }, [currentUserId]);

  const fetchConversations = useCallback(() => {
    axiosInstance.get(`${AI_API_URL}/conversations`, { baseURL: '', params: { user_id: currentUserId } })
      .then(res => {
        if (res.data.success && res.data.conversations) {
          const fetched = res.data.conversations;
          setConversations(fetched);
          if (fetched.length > 0 && fetched[0].id) {
            loadConversation(fetched[0].id);
          } else {
            handleNewChat();
          }
        } else {
          handleNewChat();
        }
      })
      .catch(err => {
        console.error("Failed to load conversations:", err);
        handleNewChat();
      });
  }, [currentUserId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Load conversation state
  const loadConversation = useCallback((convId) => {
    axiosInstance.get(`${AI_API_URL}/conversations/${convId}`, { baseURL: '' })
      .then(res => {
        if (res.data.success && res.data.conversation) {
          const conv = res.data.conversation;
          let finalMessages = conv.messages || [];
          if (typeof finalMessages === 'string') {
            try {
              finalMessages = JSON.parse(finalMessages);
            } catch (e) {
              console.error("Failed to parse messages string:", e);
              finalMessages = [];
            }
          }
          
          if (finalMessages.length === 0) {
            finalMessages = [welcomeMessage, gatherDetailsMessage];
          } else {
            if (finalMessages[0] && finalMessages[0].role !== 'system') {
              finalMessages = [welcomeMessage, gatherDetailsMessage, ...finalMessages];
            }
          }

          setMessages(finalMessages);
          setShowSuggestionChips(finalMessages.length <= 2);

          // Determine if ticket recommendation card should be displayed
          const isEscalatedStatus = conv.status === 'escalated' || conv.escalation_data != null;
          let shouldShowCard = isEscalatedStatus;

          if (!shouldShowCard && finalMessages.length > 0) {
            const aiMsgs = finalMessages.filter(m => m.role === 'ai' || m.role === 'assistant');
            const lastAiMsg = aiMsgs[aiMsgs.length - 1];
            const userMsgs = finalMessages.filter(m => m.role === 'user');
            const lastUserMsg = userMsgs[userMsgs.length - 1];

            if (lastAiMsg && typeof lastAiMsg.content === 'string') {
              const lower = lastAiMsg.content.toLowerCase();
              const suggestsTicket = lower.includes('support ticket') || 
                                     lower.includes('create a ticket') || 
                                     lower.includes('open a ticket') || 
                                     lower.includes('technician') ||
                                     lower.includes('escalate');
              
              const userDismissed = lastUserMsg && typeof lastUserMsg.content === 'string' &&
                (lastUserMsg.content.includes("I'll try the steps first") || 
                 lastUserMsg.content.includes("I'll try the steps") || 
                 lastUserMsg.content.includes("successfully created"));

              if (suggestsTicket && !userDismissed) {
                shouldShowCard = true;
              }
            }
          }

          if (conv.status === 'resolved' || conv.status === 'ticket_created') {
            shouldShowCard = false;
          }

          setShowTicketCard(shouldShowCard);
          setConversationPhase(shouldShowCard ? 3 : 0);
          setEscalationTicketData(conv.escalation_data || null);
          setActiveConversationId(convId);
          
          conversationStateRef.current[convId] = {
            messages: finalMessages,
            conversationPhase: shouldShowCard ? 3 : 0,
            showSuggestionChips: finalMessages.length <= 2,
            showTicketCard: shouldShowCard,
            escalationTicketData: conv.escalation_data || null,
          };
        }
      })
      .catch(err => {
        console.error("Failed to load conversation from backend:", err);
        const saved = conversationStateRef.current[convId];
        if (saved) {
          setMessages(saved.messages);
          setShowSuggestionChips(saved.showSuggestionChips);
          setShowTicketCard(saved.showTicketCard);
          setConversationPhase(saved.conversationPhase);
          setEscalationTicketData(saved.escalationTicketData || null);
        } else {
          setMessages([welcomeMessage, gatherDetailsMessage]);
          setShowSuggestionChips(true);
          setShowTicketCard(false);
          setConversationPhase(0);
          setEscalationTicketData(null);
        }
        setActiveConversationId(convId);
      });
  }, []);

  // Save conversation state
  const saveConversationState = useCallback((convId, msgs, phase, showSugg, showCard, escData) => {
    conversationStateRef.current[convId] = {
      messages: msgs,
      conversationPhase: phase,
      showSuggestionChips: showSugg,
      showTicketCard: showCard,
      escalationTicketData: escData !== undefined ? escData : null,
    };
    setConversations(prev => prev.map(c =>
      c.id === convId
        ? { ...c, timestamp: new Date().toISOString(), messageCount: msgs.length }
        : c
    ));
  }, []);

  const addMessage = useCallback((msg) => {
    setMessages(prev => {
      const updated = [...prev, msg];
      saveConversationState(activeConversationId, updated, conversationPhase, showSuggestionChips, showTicketCard, escalationTicketData);
      return updated;
    });
  }, [activeConversationId, conversationPhase, showSuggestionChips, showTicketCard, escalationTicketData, saveConversationState]);

  const simulateAIResponse = useCallback((content, sources) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      addMessage({
        id: `ai-${Date.now()}`,
        role: 'ai',
        content,
        sources,
        timestamp: new Date().toISOString(),
      });
    }, 1500);
  }, [addMessage]);

  const handleSuggestionClick = useCallback((chip) => {
    setInput(chip);
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    addMessage(userMessage);
    setInput('');
    if (showSuggestionChips) setShowSuggestionChips(false);
    setIsTyping(true);

    const updatedMessages = [...messages, userMessage];
    const apiMessages = updatedMessages
      .filter(m => m.id !== 'welcome')
      .map(m => ({
        role: m.role === 'ai' ? 'assistant' : m.role,
        content: typeof m.content === 'string' ? m.content : ''
      }))
      .filter(m => m.content !== '');

    axiosInstance.post(`${AI_API_URL}/chat`, { 
      messages: apiMessages,
      conversation_id: activeConversationId,
      user_id: currentUserId
    }, { baseURL: '' })
      .then(res => {
        setIsTyping(false);
        const reply = res.data.content || 'I could not generate a response. Please try again.';
        
        const aiMessage = {
          id: `ai-${Date.now()}`,
          role: 'ai',
          content: reply,
          timestamp: new Date().toISOString(),
        };

        const isEscalated = res.data.escalate === true;
        const escTicketData = res.data.ticket_data || null;

        if (isEscalated && escTicketData) {
          setEscalationTicketData(escTicketData);
        }

        setMessages(prev => {
          const updated = [...prev, aiMessage];
          const lowerReply = reply.toLowerCase();
          const shouldSuggestTicket = isEscalated ||
                                       (res.data.attempt && res.data.attempt >= 1) ||
                                       lowerReply.includes('support ticket') || 
                                       lowerReply.includes('create a ticket') || 
                                       lowerReply.includes('open a ticket') || 
                                       lowerReply.includes('technician') ||
                                       lowerReply.includes('escalate');
          
          if (shouldSuggestTicket) {
            setShowTicketCard(true);
          }

          saveConversationState(activeConversationId, updated, conversationPhase, false, shouldSuggestTicket, escTicketData);
          fetchConversationsListOnly();
          return updated;
        });
      })
      .catch(err => {
        setIsTyping(false);
        console.error(err);
        const errMsg = err.response?.data?.error || 'Sorry, I encountered an issue connecting to the AI support service. Please try again.';
        
        const aiMessage = {
          id: `ai-${Date.now()}`,
          role: 'ai',
          content: errMsg,
          timestamp: new Date().toISOString(),
        };

        setMessages(prev => {
          const updated = [...prev, aiMessage];
          saveConversationState(activeConversationId, updated, conversationPhase, false, showTicketCard, escalationTicketData);
          return updated;
        });
      });

  }, [input, conversationPhase, messages, showSuggestionChips, showTicketCard, activeConversationId, isTyping, addMessage, saveConversationState, escalationTicketData, fetchConversationsListOnly]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleNewChat = useCallback(() => {
    const id = `conv-${Date.now()}`;
    setConversations(prev => [{ id, title: 'New Conversation', timestamp: new Date().toISOString(), messageCount: 2 }, ...prev]);
    setActiveConversationId(id);
    setMessages([welcomeMessage, gatherDetailsMessage]);
    setShowSuggestionChips(true);
    setShowTicketCard(false);
    setConversationPhase(0);
    setEscalationTicketData(null);
    conversationStateRef.current[id] = {
      messages: [welcomeMessage, gatherDetailsMessage],
      conversationPhase: 0,
      showSuggestionChips: true,
      showTicketCard: false,
      escalationTicketData: null,
    };
  }, []);

  const handleDeleteConversation = useCallback((e, convId) => {
    e.stopPropagation();
    axiosInstance.delete(`${AI_API_URL}/conversations/${convId}`, { baseURL: '' })
      .then(() => {
        axiosInstance.get(`${AI_API_URL}/conversations`, { baseURL: '', params: { user_id: currentUserId } })
          .then(res => {
            if (res.data.success && res.data.conversations) {
              const fetched = res.data.conversations;
              setConversations(fetched);
              if (activeConversationId === convId) {
                if (fetched.length > 0 && fetched[0].id) {
                  loadConversation(fetched[0].id);
                } else {
                  handleNewChat();
                }
              }
            } else {
              setConversations([]);
              if (activeConversationId === convId) handleNewChat();
            }
          })
          .catch(() => {
            setConversations(prev => prev.filter(c => c.id !== convId));
            if (activeConversationId === convId) handleNewChat();
          });
      })
      .catch(err => {
        console.error("Failed to delete conversation from backend:", err);
      });
  }, [activeConversationId, loadConversation, handleNewChat, currentUserId]);

  const generateRealReviewData = useCallback((escData) => {
    const activeConv = conversations.find(c => c.id === activeConversationId);

    const userMsgs = messages
      .filter(m => m.role === 'user' && typeof m.content === 'string')
      .map(m => m.content.trim())
      .filter(txt => txt.length > 0 && !['hi', 'hello', 'hey', 'yes', 'no', 'ok', 'okay', 'not working'].includes(txt.toLowerCase()));

    const firstUserMsg = userMsgs.length > 0 ? userMsgs[0] : '';
    const convoTitle = (activeConv?.title && activeConv.title !== 'New Conversation' && activeConv.title !== 'New Chat')
      ? activeConv.title
      : (firstUserMsg ? (firstUserMsg.length > 60 ? firstUserMsg.slice(0, 60) + '...' : firstUserMsg) : 'Support Request');

    const userOrg = user?.company_name || user?.organization || user?.client_name || user?.company ||
      (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '') || 'Customer Organization';

    // ─── DYNAMIC MACHINE MODEL RESOLUTION ─────────────────────
    let model = escData?.machineModel;
    if (model && model.trim() !== '' && model.toLowerCase() !== 'unknown machine' && model.toLowerCase() !== 'general equipment') {
      model = model.trim();
    } else {
      model = null;
    }

    // Match chat messages against database equipment list
    if (!model && ticketOptions?.machines && ticketOptions.machines.length > 0) {
      const combinedChatText = userMsgs.join(' ').toLowerCase();
      const matchedMachine = ticketOptions.machines.find(m => {
        const nameMatch = m.machine_name && combinedChatText.includes(m.machine_name.toLowerCase());
        const modelMatch = m.model && combinedChatText.includes(m.model.toLowerCase());
        const brandMatch = m.brand && combinedChatText.includes(m.brand.toLowerCase());
        return nameMatch || modelMatch || brandMatch;
      });

      if (matchedMachine) {
        const brandStr = matchedMachine.brand ? `${matchedMachine.brand} ` : '';
        const modelStr = matchedMachine.model ? `${matchedMachine.model} ` : '';
        model = `${brandStr}${modelStr}(${matchedMachine.machine_name})`.trim();
      }
    }

    // Fallback to user's chat message answers if no database match
    if (!model) {
      if (userMsgs.length >= 2 && userMsgs[1].length < 80) {
        model = `${userMsgs[1]} ${userMsgs[0]}`.trim();
      } else if (userMsgs.length >= 1 && userMsgs[0].length < 80) {
        model = userMsgs[0];
      } else if (ticketOptions?.machines && ticketOptions.machines.length > 0) {
        const first = ticketOptions.machines[0];
        model = `${first.brand || ''} ${first.model || ''} (${first.machine_name})`.trim();
      } else {
        model = 'Equipment Support Request';
      }
    }

    let convSummary = escData?.conversationSummary;
    if (convSummary && typeof convSummary === 'string') {
      convSummary = convSummary
        .replace(/(?:\b|\n)(?:\d+[\.\)]|Step \d+:|-|\*)\s+[^\n]+/gi, '')
        .replace(/\n{2,}/g, '\n\n')
        .trim();
    }

    if (!convSummary || convSummary.trim() === '') {
      const userProblemDetails = userMsgs.length > 0 ? userMsgs.join('. ') : 'Issue reported via AI Assistant.';
      convSummary = `Customer reported an issue regarding "${convoTitle}". Machine: ${model}. Problem details: ${userProblemDetails}. Automated troubleshooting was attempted but the issue persists. Ticket escalated to technical team for follow-up.`;
    }

    return {
      machineModel: model,
      companyName: userOrg,
      purchaseDate: new Date().toISOString().split('T')[0],
      problemSummary: convoTitle,
      category: escData?.category || 'Hardware',
      priority: escData?.priority || 'Medium',
      conversationSummary: convSummary,
    };
  }, [conversations, activeConversationId, messages, user, ticketOptions]);

  const handleCreateTicket = useCallback(() => {
    setReviewData(generateRealReviewData(escalationTicketData));
    setShowReviewModal(true);
  }, [escalationTicketData, generateRealReviewData]);

  const handleSubmitTicket = useCallback(async (formData) => {
    try {
      const options = await getTicketFormOptions().catch(() => null);

      let machineId = 1;
      if (options?.machines && options.machines.length > 0) {
        const found = options.machines.find(m =>
          m.machine_name?.toLowerCase().includes((formData.machineModel || '').toLowerCase()) ||
          m.model?.toLowerCase().includes((formData.machineModel || '').toLowerCase()) ||
          ((formData.machineModel || '').toLowerCase().includes(m.machine_name?.toLowerCase()))
        );
        if (found) machineId = found.machine_ID;
        else machineId = options.machines[0].machine_ID;
      }

      let categoryId = 1;
      if (options?.problem_categories && options.problem_categories.length > 0) {
        const found = options.problem_categories.find(c =>
          c.category_name?.toLowerCase() === (formData.category || '').toLowerCase()
        );
        if (found) categoryId = found.problem_category_ID;
        else categoryId = options.problem_categories[0].problem_category_ID;
      }

      let priorityId = 2;
      if (options?.ticket_priorities && options.ticket_priorities.length > 0) {
        const found = options.ticket_priorities.find(p =>
          p.priority_name?.toLowerCase() === (formData.priority || '').toLowerCase()
        );
        if (found) priorityId = found.priority_ID;
        else priorityId = options.ticket_priorities[0].priority_ID;
      }

      const activeConv = conversations.find(c => c.id === activeConversationId);
      const ticketTitle = (activeConv?.title && activeConv.title !== 'New Conversation' && activeConv.title !== 'New Chat')
        ? activeConv.title
        : (formData.problemSummary || 'Support Ticket');

      const payload = new FormData();
      payload.append('title', ticketTitle);
      payload.append('machine_ID', machineId);
      payload.append('problem_category_ID', categoryId);
      payload.append('priority_ID', priorityId);
      payload.append('description', formData.conversationSummary || formData.problemSummary || 'Submitted via AI Support Assistant.');

      let response;
      try {
        response = await createTicket(payload);
      } catch (err1) {
        console.warn("FormData ticket creation attempt failed, attempting JSON payload fallback...", err1);
        const objPayload = {
          title: ticketTitle,
          machine_ID: machineId,
          problem_category_ID: categoryId,
          priority_ID: priorityId,
          description: formData.conversationSummary || formData.problemSummary || 'Submitted via AI Support Assistant.',
        };
        response = await createTicket(objPayload);
      }

      const rawTicketId = response?.ticket?.ticket_ID || response?.ticket_ID || response?.dashboard_ticket?.ticket_ID || response?.id;
      const formattedNo = rawTicketId ? (String(rawTicketId).startsWith('TKT-') ? String(rawTicketId) : `TKT-${String(rawTicketId).padStart(4, '0')}`) : 'TKT-0001';

      setShowReviewModal(false);
      setTicketNumber(formattedNo);
      setShowSuccess(true);
      setShowTicketCard(false);

      addMessage({
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: `Support ticket **${formattedNo}** has been successfully created. Our technical support team will review your ticket and get back to you shortly.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to submit support ticket to enterprise ticketing system:', err);
      alert(err?.response?.data?.message || 'Failed to submit ticket. Please check enterprise ticketing service connection.');
    }
  }, [addMessage, conversations, activeConversationId]);

  const handleViewTicket = useCallback(() => {
    setShowSuccess(false);
    navigate('/my-tickets');
  }, [navigate]);

  const handleCloseSuccess = useCallback(() => {
    setShowSuccess(false);
  }, []);

  const handleContinueChatting = useCallback(() => {
    setShowTicketCard(false);
    addMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: 'I\'ll try the steps first and let you know.',
      timestamp: new Date().toISOString(),
    });
    setTimeout(() => {
      addMessage({
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: 'Sounds good! Feel free to come back anytime if you need further assistance. I\'ll be here to help.',
        timestamp: new Date().toISOString(),
      });
    }, 1200);
  }, [addMessage]);

  const handleBack = useCallback(() => {
    const dept = (user?.department || user?.profile?.department?.name || '').toLowerCase();
    const role = (user?.role || user?.profile?.role?.name || '').toLowerCase();
    const isCS = dept.includes('customer service') || dept.includes('customer support') || dept === 'cs' || role.includes('customer service') || role.includes('customer-service') || role === 'cs';
    const isEmployee = !isCS && (dept === 'service' || dept.includes('engineer') || role === 'employee' || role.includes('service') || role.includes('engineer'));

    if (isCS) navigate('/cs/dashboard');
    else if (isEmployee) navigate('/employee/dashboard');
    else navigate('/customer-dashboard');
  }, [navigate, user]);

  return (
    <div className="flex flex-col h-screen p-4">
      <div className="flex flex-1 bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden min-h-0">
        {sidebarOpen && (
          <div className="w-[280px] lg:w-[300px] border-r border-gray-100 flex flex-col flex-shrink-0 bg-gray-50/50">
            <div className="px-3 pt-6 pb-3 border-b border-gray-100 flex-shrink-0 space-y-4">
              <button
                onClick={handleBack}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 hover:text-[#252578] hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
              >
                <ArrowLeft size={14} />
                Back to Dashboard
              </button>
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 hover:border-[#252578] hover:text-[#252578] text-gray-700 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                New Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {conversations.map((conv) => (                <div
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`group w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-all border-l-2 cursor-pointer ${
                    activeConversationId === conv.id
                      ? 'bg-[#252578]/5 border-l-[#252578]'
                      : 'border-l-transparent hover:bg-gray-100'
                  }`}
                >
                  <MessageSquare size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs truncate ${activeConversationId === conv.id ? 'font-semibold text-[#252578]' : 'font-medium text-gray-700'}`}>
                      {conv.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-gray-400">{formatShortTime(conv.timestamp)}</span>
                      <span className="text-[10px] text-gray-300">·</span>
                      <span className="text-[10px] text-gray-400">{conv.messageCount} msgs</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => handleDeleteConversation(e, conv.id)}
                    className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-200 text-gray-400 hover:text-red-500 transition-all flex-shrink-0 cursor-pointer"
                    title="Delete conversation"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <div className="w-7 h-7 rounded-full bg-[#252578] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  {(() => {
                    const name = user?.first_name || user?.name || 'User';
                    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">
                    {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : (user?.name || 'User')}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">{user?.email || ''}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#252578] flex items-center justify-center">
                <Bot size={18} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-800">AI Support Assistant</p>
                <p className="text-[11px] text-gray-500">Powered by AI Knowledge Base</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Online
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-[#f4f7fb]/50">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[75%] flex flex-col">
                  <div className="flex items-start gap-3">
                    {(msg.role === 'ai' || msg.role === 'assistant') && (
                      <div className="w-8 h-8 rounded-full bg-[#252578] flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot size={16} className="text-white" />
                      </div>
                    )}
                    <div>
                      <div className={msg.role === 'user'
                        ? 'px-4 py-2.5 bg-[#252578] text-white rounded-2xl rounded-br-md'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-md shadow-sm px-4 py-3'
                      }>
                        {typeof msg.content === 'string' ? (
                          <FormattedText text={msg.content} />
                        ) : (
                          msg.content
                        )}
                      </div>
                      {msg.role === 'ai' && msg.sources && msg.sources.length > 0 && (
                        <AISourceList sources={msg.sources} />
                      )}
                      <p className={`text-[10px] text-gray-400 mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {showSuggestionChips && messages.length === 1 && (
              <div className="flex justify-start pl-11">
                <div className="flex flex-wrap gap-2">
                  {suggestionChips.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleSuggestionClick(chip)}
                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600 hover:border-[#252578] hover:text-[#252578] hover:bg-[#252578]/5 transition-all cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isTyping && <TypingIndicator />}

            {showTicketCard && (
              <TicketRecommendationCard
                onCreateTicket={handleCreateTicket}
                onContinue={handleContinueChatting}
              />
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="px-6 py-3 border-t border-gray-100 bg-white flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all flex-shrink-0 cursor-pointer"
                title="Attach file"
              >
                <Paperclip size={18} />
              </button>
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578] resize-none min-h-[42px] max-h-[120px] overflow-y-auto"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="bg-[#252578] text-white rounded-xl px-4 py-2.5 transition-all hover:bg-[#1f1f66] disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 cursor-pointer"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <TicketReviewModal
        isOpen={showReviewModal}
        data={reviewData}
        onClose={() => setShowReviewModal(false)}
        onSubmit={handleSubmitTicket}
      />

      <SuccessDialog
        isOpen={showSuccess}
        ticketNumber={ticketNumber}
        onViewTicket={handleViewTicket}
        onClose={handleCloseSuccess}
      />
    </div>
  );
}

export default AISupportPage;
