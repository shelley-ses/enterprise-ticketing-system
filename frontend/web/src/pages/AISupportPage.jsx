import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Bot, Send, Paperclip, ChevronDown, ChevronUp, X, CheckCircle, AlertTriangle, Plus, MessageSquare, Trash2, ArrowLeft, Clock } from 'lucide-react';

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

function AISupportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState([
    { id: 'conv-1', title: 'Printer Error 402', timestamp: new Date(Date.now() - 300000).toISOString(), messageCount: 8 },
    { id: 'conv-2', title: 'Paper Jam Issue', timestamp: new Date(Date.now() - 86400000).toISOString(), messageCount: 5 },
    { id: 'conv-3', title: 'Scanner not detected', timestamp: new Date(Date.now() - 172800000).toISOString(), messageCount: 3 },
  ]);
  const [activeConversationId, setActiveConversationId] = useState('conv-1');
  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestionChips, setShowSuggestionChips] = useState(true);
  const [showTicketCard, setShowTicketCard] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [conversationPhase, setConversationPhase] = useState(0);

  // Store per-conversation state
  const conversationStateRef = useRef({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Load conversation state
  const loadConversation = useCallback((convId) => {
    const saved = conversationStateRef.current[convId];
    if (saved) {
      setMessages(saved.messages);
      setShowSuggestionChips(saved.showSuggestionChips);
      setShowTicketCard(saved.showTicketCard);
      setConversationPhase(saved.conversationPhase);
    } else {
      setMessages([welcomeMessage]);
      setShowSuggestionChips(true);
      setShowTicketCard(false);
      setConversationPhase(0);
    }
    setActiveConversationId(convId);
  }, []);

  // Save conversation state
  const saveConversationState = useCallback((convId, msgs, phase, showSugg, showCard) => {
    conversationStateRef.current[convId] = {
      messages: msgs,
      conversationPhase: phase,
      showSuggestionChips: showSugg,
      showTicketCard: showCard,
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
      saveConversationState(activeConversationId, updated, conversationPhase, showSuggestionChips, showTicketCard);
      return updated;
    });
  }, [activeConversationId, conversationPhase, showSuggestionChips, showTicketCard, saveConversationState]);

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

    addMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    });
    setInput('');
    const hadChips = showSuggestionChips;
    if (showSuggestionChips) setShowSuggestionChips(false);

    const lower = text.toLowerCase();

    if (conversationPhase === 0 && (lower.includes('error') || lower.includes('issue') || lower.includes('problem') || lower.includes('won\'t') || lower.includes('not') || lower.includes('jam') || lower.includes('toner'))) {
      const newPhase = 1;
      setConversationPhase(newPhase);
      saveConversationState(activeConversationId, [...messages, { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: new Date().toISOString() }], newPhase, false, showTicketCard);
      setTimeout(() => {
        simulateAIResponse(
          <div>
            <p className="text-sm font-semibold mb-2">I'd be happy to help you with that!</p>
            <p className="text-sm leading-relaxed">To better assist you, could you please provide the following details:</p>
            <ol className="mt-2 space-y-1 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-[#252578] font-bold">1.</span>
                <span>What is the <strong>machine model</strong> you're using?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#252578] font-bold">2.</span>
                <span>What is your <strong>company name</strong>?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#252578] font-bold">3.</span>
                <span>When was the machine <strong>purchased</strong> (approximate date)?</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#252578] font-bold">4.</span>
                <span>Can you describe the <strong>issue</strong> in detail?</span>
              </li>
            </ol>
          </div>,
          ['AI Support Knowledge Base v3.2', 'Troubleshooting FAQ — Common Issues']
        );
      }, 500);
    } else if (conversationPhase === 1) {
      const newPhase = 2;
      setConversationPhase(newPhase);
      setTimeout(() => {
        simulateAIResponse(
          <div>
            <p className="text-sm font-semibold mb-2">Thank you for the information!</p>
            <p className="text-sm leading-relaxed">Based on the details you've shared, here is what I've found:</p>
            <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                <AlertTriangle size={14} />
                Possible Cause
              </p>
              <p className="text-sm text-red-800 mt-1">The Error 402 indicates a paper feed issue.</p>
            </div>
            <div className="mt-3">
              <p className="text-sm font-semibold mb-1.5">Recommended Steps</p>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-[#252578] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <span>Check the paper tray for any obstructions or misaligned paper.</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-[#252578] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <span>Remove any jammed paper and ensure the paper guides are properly set.</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-[#252578] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <span>Restart the machine and run a test print.</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-[#252578] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                  <span>If the error persists, check for firmware updates in the settings menu.</span>
                </div>
              </div>
            </div>
          </div>,
          ['Canon X120 User Manual — Section 4.3', 'Troubleshooting Guide v2.1', 'Internal Knowledge Base']
        );
      }, 500);
    } else if (conversationPhase === 2) {
      const newPhase = 3;
      setConversationPhase(newPhase);
      setTimeout(() => {
        setShowTicketCard(true);
        addMessage({
          id: `ai-${Date.now()}`,
          role: 'ai',
          content: (
            <div>
              <p className="text-sm leading-relaxed">
                I've documented everything we've discussed. If you'd like, I can prepare a support ticket with all the information gathered so one of our technicians can follow up with you directly.
              </p>
            </div>
          ),
          sources: ['AI Support Assistant — Session Summary'],
          timestamp: new Date().toISOString(),
        });
      }, 500);
    } else {
      setTimeout(() => {
        simulateAIResponse(
          <p className="text-sm leading-relaxed">I understand. Is there anything else I can help you with regarding this issue? If you're ready, I can also create a support ticket for further assistance.</p>,
          null
        );
      }, 1000);
    }
  }, [input, conversationPhase, messages, showSuggestionChips, showTicketCard, activeConversationId, isTyping, addMessage, simulateAIResponse, saveConversationState]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleNewChat = useCallback(() => {
    const id = `conv-${Date.now()}`;
    setConversations(prev => [{ id, title: 'New Conversation', timestamp: new Date().toISOString(), messageCount: 1 }, ...prev]);
    setActiveConversationId(id);
    setMessages([welcomeMessage]);
    setShowSuggestionChips(true);
    setShowTicketCard(false);
    setConversationPhase(0);
    conversationStateRef.current[id] = {
      messages: [welcomeMessage],
      conversationPhase: 0,
      showSuggestionChips: true,
      showTicketCard: false,
    };
  }, []);

  const handleDeleteConversation = useCallback((e, convId) => {
    e.stopPropagation();
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConversationId === convId) {
      const remaining = conversations.filter(c => c.id !== convId);
      if (remaining.length > 0) {
        loadConversation(remaining[0].id);
      } else {
        handleNewChat();
      }
    }
  }, [activeConversationId, conversations, loadConversation, handleNewChat]);

  const handleCreateTicket = useCallback(() => {
    setReviewData({
      machineModel: 'Canon X120',
      companyName: 'Acme Corporation',
      purchaseDate: '2025-03-15',
      problemSummary: 'Machine displaying Error 402 — paper feed issue. Steps attempted: checked tray, removed obstructions, restarted machine.',
      category: 'Hardware',
      priority: 'Medium',
      conversationSummary: 'User reported Error 402 on Canon X120. Troubleshooting steps provided but issue persists. Recommended to escalate to technical support.',
    });
    setShowReviewModal(true);
  }, []);

  const handleSubmitTicket = useCallback((formData) => {
    setShowReviewModal(false);
    setTicketNumber('TCK-000123');
    setShowSuccess(true);
    setShowTicketCard(false);
  }, []);

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
      simulateAIResponse(
        <p className="text-sm leading-relaxed">Sounds good! Feel free to come back anytime if you need further assistance. I'll be here to help.</p>,
        null
      );
    }, 1200);
  }, [addMessage, simulateAIResponse]);

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
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-all border-l-2 cursor-pointer ${
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
                </button>
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
                    {msg.role === 'ai' && (
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
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
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
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578]"
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
