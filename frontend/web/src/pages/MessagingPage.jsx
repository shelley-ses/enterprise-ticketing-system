import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { MessageCircle, Send, Filter, Users, User } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────

const formatTime = (iso) => {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const checkIsCS = (user) => {
  if (!user) return false;
  const dept = (user.department || user.profile?.department?.name || '').toLowerCase();
  const role = (user.role || user.profile?.role?.name || '').toLowerCase();
  if (dept.includes('customer service') || dept.includes('customer support') || dept === 'cs') return true;
  return role.includes('customer service') || role.includes('customer-service') || role === 'cs';
};

const checkIsEmployee = (user) => {
  if (!user) return false;
  if (checkIsCS(user)) return false;
  const dept = (user.department || user.profile?.department?.name || '').toLowerCase();
  const role = (user.role || user.profile?.role?.name || '').toLowerCase();
  if (dept === 'service' || dept.includes('engineer')) return true;
  return role === 'employee' || role.includes('service') || role.includes('engineer');
};

// ─── Mock Data ────────────────────────────────────────────────────────────

const generateCustomerData = () => [
  {
    id: 'cs-1',
    name: 'Jessica Martinez',
    role: 'Customer Service Agent',
    type: 'external',
    unread: 2,
    lastMessage: "I've submitted your ticket to our IT department.",
    lastTime: '2:30 PM',
    messages: [
      { id: 1, text: 'Hi, I need help with my printer.', sender: 'me', timestamp: '2026-07-08T09:00:00' },
      { id: 2, text: "Hello! I'd be happy to help. What seems to be the problem?", sender: 'them', timestamp: '2026-07-08T09:05:00' },
      { id: 3, text: "It keeps saying 'paper jam' even after I cleared it.", sender: 'me', timestamp: '2026-07-08T09:07:00' },
      { id: 4, text: 'Let me check your account. One moment please.', sender: 'them', timestamp: '2026-07-08T09:10:00' },
      { id: 5, text: 'I see your ticket has been created. Our technician will follow up within 24 hours.', sender: 'them', timestamp: '2026-07-08T09:12:00' },
      { id: 6, text: 'Thank you!', sender: 'me', timestamp: '2026-07-08T09:15:00' },
      { id: 7, text: "I've submitted your ticket to our IT department.", sender: 'them', timestamp: '2026-07-08T14:30:00' },
    ],
  },
];

const generateCSData = () => ({
  internal: [
    {
      id: 'emp-1',
      name: 'Mark Reyes',
      role: 'IT Technician',
      type: 'internal',
      unread: 2,
      lastMessage: 'Sure, I can take a look at that ticket.',
      lastTime: '10:15 AM',
      messages: [
        { id: 1, text: 'Hey Mark, we have a ticket about a network issue.', sender: 'me', timestamp: '2026-07-08T08:00:00' },
        { id: 2, text: 'Can you share the ticket ID?', sender: 'them', timestamp: '2026-07-08T08:05:00' },
        { id: 3, text: 'Ticket #1041 — VLAN configuration error.', sender: 'me', timestamp: '2026-07-08T08:07:00' },
        { id: 4, text: "I'll check it out. Might need to reconfigure the switch.", sender: 'them', timestamp: '2026-07-08T08:10:00' },
        { id: 5, text: 'Sure, I can take a look at that ticket.', sender: 'them', timestamp: '2026-07-08T10:15:00' },
      ],
    },
    {
      id: 'emp-2',
      name: 'Anna Santos',
      role: 'Engineer',
      type: 'internal',
      unread: 0,
      lastMessage: 'The replacement parts have been ordered.',
      lastTime: 'Yesterday',
      messages: [
        { id: 1, text: 'Hi Anna, do we have ETA on the parts?', sender: 'me', timestamp: '2026-07-07T14:00:00' },
        { id: 2, text: 'I just checked with the supplier. They expect delivery by Friday.', sender: 'them', timestamp: '2026-07-07T14:10:00' },
        { id: 3, text: 'Great, thanks for the update!', sender: 'me', timestamp: '2026-07-07T14:15:00' },
        { id: 4, text: 'The replacement parts have been ordered.', sender: 'them', timestamp: '2026-07-07T16:30:00' },
      ],
    },
    {
      id: 'emp-3',
      name: 'Carlos Gomez',
      role: 'Field Technician',
      type: 'internal',
      unread: 1,
      lastMessage: "I'm on my way to the client site.",
      lastTime: '8:45 AM',
      messages: [
        { id: 1, text: 'Carlos, are you available for a service call today?', sender: 'me', timestamp: '2026-07-08T07:30:00' },
        { id: 2, text: 'Yes, what is the address?', sender: 'them', timestamp: '2026-07-08T07:35:00' },
        { id: 3, text: '123 Business Park, Unit 4. Customer named Robert Chen.', sender: 'me', timestamp: '2026-07-08T07:37:00' },
        { id: 4, text: "I'm on my way to the client site.", sender: 'them', timestamp: '2026-07-08T08:45:00' },
      ],
    },
  ],
  external: [
    {
      id: 'cust-1',
      name: 'John Doe',
      role: 'Customer',
      type: 'external',
      unread: 3,
      lastMessage: 'When will someone come to fix it?',
      lastTime: '9:45 AM',
      messages: [
        { id: 1, text: 'My air conditioning unit is not working.', sender: 'them', timestamp: '2026-07-07T10:00:00' },
        { id: 2, text: "I'm sorry to hear that, John. Let me check your service records.", sender: 'me', timestamp: '2026-07-07T10:05:00' },
        { id: 3, text: 'I can schedule a technician for tomorrow morning.', sender: 'me', timestamp: '2026-07-07T10:10:00' },
        { id: 4, text: 'That works for me. Thank you.', sender: 'them', timestamp: '2026-07-07T10:15:00' },
        { id: 5, text: "It's been two days and no one has arrived yet.", sender: 'them', timestamp: '2026-07-08T09:00:00' },
        { id: 6, text: 'When will someone come to fix it?', sender: 'them', timestamp: '2026-07-08T09:45:00' },
      ],
    },
    {
      id: 'cust-2',
      name: 'Maria Garcia',
      role: 'Customer',
      type: 'external',
      unread: 1,
      lastMessage: 'Thank you for the quick response!',
      lastTime: 'Yesterday',
      messages: [
        { id: 1, text: 'I have an issue with my invoice.', sender: 'them', timestamp: '2026-07-07T13:00:00' },
        { id: 2, text: 'Let me look into it. Can you provide the invoice number?', sender: 'me', timestamp: '2026-07-07T13:05:00' },
        { id: 3, text: 'INV-2026-0789', sender: 'them', timestamp: '2026-07-07T13:07:00' },
        { id: 4, text: 'I found it. There was a billing error which I have corrected.', sender: 'me', timestamp: '2026-07-07T13:15:00' },
        { id: 5, text: 'Thank you for the quick response!', sender: 'them', timestamp: '2026-07-07T13:20:00' },
      ],
    },
    {
      id: 'cust-3',
      name: 'Robert Chen',
      role: 'Customer',
      type: 'external',
      unread: 0,
      lastMessage: 'The machine is working perfectly now.',
      lastTime: 'Mon',
      messages: [
        { id: 1, text: 'The laboratory centrifuge is making a strange noise.', sender: 'them', timestamp: '2026-07-06T11:00:00' },
        { id: 2, text: "We'll send a technician to inspect it right away.", sender: 'me', timestamp: '2026-07-06T11:10:00' },
        { id: 3, text: 'The technician came and fixed the issue. It was a loose bearing.', sender: 'them', timestamp: '2026-07-06T15:30:00' },
        { id: 4, text: 'The machine is working perfectly now.', sender: 'them', timestamp: '2026-07-06T15:35:00' },
      ],
    },
  ],
});

const generateEmployeeData = () => [
  {
    id: 'cs-1',
    name: 'Jessica Martinez',
    role: 'Customer Service Agent',
    type: 'internal',
    unread: 1,
    lastMessage: 'Can you handle ticket #1042?',
    lastTime: '11:30 AM',
    messages: [
      { id: 1, text: 'Hi Jessica, looking for my next assignment.', sender: 'me', timestamp: '2026-07-08T10:00:00' },
      { id: 2, text: 'I have a ticket that needs a technician. AC repair at 456 Oak St.', sender: 'them', timestamp: '2026-07-08T10:05:00' },
      { id: 3, text: "Sure, I can take that. What's the ticket number?", sender: 'me', timestamp: '2026-07-08T10:07:00' },
      { id: 4, text: 'Can you handle ticket #1042?', sender: 'them', timestamp: '2026-07-08T11:30:00' },
    ],
  },
  {
    id: 'cs-2',
    name: 'David Kim',
    role: 'Customer Service Agent',
    type: 'internal',
    unread: 0,
    lastMessage: 'Thanks for your help on the calibration!',
    lastTime: 'Yesterday',
    messages: [
      { id: 1, text: 'David, I finished the calibration on the spectrometer.', sender: 'me', timestamp: '2026-07-07T16:00:00' },
      { id: 2, text: 'Great work! The client was very happy.', sender: 'them', timestamp: '2026-07-07T16:30:00' },
      { id: 3, text: 'Thanks for your help on the calibration!', sender: 'them', timestamp: '2026-07-07T17:00:00' },
    ],
  },
  {
    id: 'emp-1',
    name: 'Mark Reyes',
    role: 'IT Technician',
    type: 'internal',
    unread: 0,
    lastMessage: 'The network issue is resolved.',
    lastTime: '10:30 AM',
    messages: [
      { id: 1, text: 'Mark, did you manage to fix the VLAN config?', sender: 'me', timestamp: '2026-07-08T09:00:00' },
      { id: 2, text: "Yes, it was a routing table misconfiguration. All good now.", sender: 'them', timestamp: '2026-07-08T09:30:00' },
      { id: 3, text: 'The network issue is resolved.', sender: 'them', timestamp: '2026-07-08T10:30:00' },
    ],
  },
  {
    id: 'emp-2',
    name: 'Anna Santos',
    role: 'Engineer',
    type: 'internal',
    unread: 2,
    lastMessage: 'Can you review the design specs?',
    lastTime: '8:20 AM',
    messages: [
      { id: 1, text: 'Hey Anna, I sent you the design doc for the new cooling system.', sender: 'me', timestamp: '2026-07-07T15:00:00' },
      { id: 2, text: "I'll review it first thing tomorrow.", sender: 'them', timestamp: '2026-07-07T15:30:00' },
      { id: 3, text: 'Can you review the design specs?', sender: 'them', timestamp: '2026-07-08T08:20:00' },
    ],
  },
];

// ─── Avatar Component ─────────────────────────────────────────────────────

function Avatar({ name, size = 'md' }) {
  const sizeClasses = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`${sizeClasses} rounded-full bg-[#252578] text-white flex items-center justify-center font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Main Messaging Page ──────────────────────────────────────────────────

export default function MessagingPage() {
  const { user } = useAuth();

  const isCS = checkIsCS(user);
  const isEmployee = checkIsEmployee(user);
  const isCustomer = !isCS && !isEmployee;

  const [contacts, setContacts] = useState(() => {
    if (isCustomer) return generateCustomerData();
    if (isCS) {
      const data = generateCSData();
      return [...data.internal, ...data.external];
    }
    return generateEmployeeData();
  });

  const [selectedContactId, setSelectedContactId] = useState(null);
  const [csFilter, setCsFilter] = useState('external');
  const [unreadFilterActive, setUnreadFilterActive] = useState(false);
  const [messageInput, setMessageInput] = useState('');

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (contacts.length > 0 && !selectedContactId) {
      const firstId = isCS
        ? (contacts.find(c => c.type === 'external')?.id || contacts[0].id)
        : contacts[0].id;
      setSelectedContactId(firstId);
    }
  }, [contacts, selectedContactId, isCS]);

  const selectedContact = contacts.find(c => c.id === selectedContactId);
  const messages = selectedContact?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedContactId]);

  const filteredContacts = useMemo(() => {
    let filtered = contacts;
    if (isCS) filtered = filtered.filter(c => c.type === csFilter);
    if (unreadFilterActive) filtered = filtered.filter(c => c.unread > 0);
    return filtered;
  }, [contacts, isCS, csFilter, unreadFilterActive]);

  const totalUnread = useMemo(() => contacts.reduce((sum, c) => sum + c.unread, 0), [contacts]);

  const csInternalUnread = useMemo(
    () => contacts.filter(c => c.type === 'internal').reduce((s, c) => s + c.unread, 0),
    [contacts],
  );
  const csExternalUnread = useMemo(
    () => contacts.filter(c => c.type === 'external').reduce((s, c) => s + c.unread, 0),
    [contacts],
  );

  const handleSelectContact = useCallback((contactId) => {
    setSelectedContactId(contactId);
    setContacts(prev => prev.map(c =>
      c.id === contactId ? { ...c, unread: 0 } : c,
    ));
  }, []);

  const handleSend = useCallback(() => {
    const text = messageInput.trim();
    if (!text || !selectedContactId) return;
    const newMsg = {
      id: Date.now(),
      text,
      sender: 'me',
      timestamp: new Date().toISOString(),
    };
    setContacts(prev => prev.map(c =>
      c.id === selectedContactId
        ? { ...c, messages: [...c.messages, newMsg], lastMessage: text, lastTime: 'Just now', unread: 0 }
        : c,
    ));
    setMessageInput('');
  }, [messageInput, selectedContactId]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <h1 className="text-2xl font-bold text-gray-800 mb-4 flex-shrink-0">Messages</h1>

      <div className="flex flex-1 bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden min-h-0">
        {/* ── Left Panel ── */}
        <div className="w-[360px] lg:w-[380px] border-r border-gray-100 flex flex-col flex-shrink-0">
          {/* Filter bar — CS: External / Internal / Unread */}
          {isCS && (
            <div className="flex items-center gap-2 p-3 pb-2 border-b border-gray-100 flex-shrink-0 flex-wrap">
              <button
                onClick={() => { setCsFilter('external'); setUnreadFilterActive(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  csFilter === 'external'
                    ? 'bg-[#252578] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Users size={13} />
                External
                {csExternalUnread > 0 && (
                  <span className="bg-white/20 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold ml-0.5">
                    {csExternalUnread}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setCsFilter('internal'); setUnreadFilterActive(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  csFilter === 'internal'
                    ? 'bg-[#252578] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <User size={13} />
                Internal
                {csInternalUnread > 0 && (
                  <span className="bg-white/20 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold ml-0.5">
                    {csInternalUnread}
                  </span>
                )}
              </button>
              <button
                onClick={() => setUnreadFilterActive(prev => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  unreadFilterActive
                    ? 'bg-[#252578] text-white shadow-sm'
                    : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {totalUnread} unread
              </button>
            </div>
          )}

          {/* Section label + Unread filter for non-CS */}
          {!isCS && (
            <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {isCustomer ? 'Your CS Agent' : 'Conversations'}
              </p>
              <button
                onClick={() => setUnreadFilterActive(prev => !prev)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                  unreadFilterActive
                    ? 'bg-[#252578] text-white'
                    : 'border border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {totalUnread} unread
              </button>
            </div>
          )}

          {/* Contact list */}
          <div className="flex-1 overflow-y-auto">
            {filteredContacts.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">
                  {unreadFilterActive ? 'No unread conversations' : 'No conversations yet'}
                </p>
              </div>
            ) : (
              filteredContacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => handleSelectContact(contact.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all hover:bg-gray-50 border-b border-gray-50 ${
                    selectedContactId === contact.id ? 'bg-[#252578]/5' : ''
                  }`}
                >
                  <Avatar name={contact.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm truncate ${
                        contact.unread > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'
                      }`}>
                        {contact.name}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{contact.lastTime}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className={`text-xs truncate ${
                        contact.unread > 0 ? 'font-semibold text-gray-700' : 'text-gray-500'
                      }`}>
                        {contact.lastMessage}
                      </span>
                      {contact.unread > 0 && (
                        <span className="bg-[#252578] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 ml-2 flex-shrink-0">
                          {contact.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right Panel ── */}
        {selectedContact ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Conversation header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
              <Avatar name={selectedContact.name} />
              <div>
                <p className="font-semibold text-sm text-gray-800">{selectedContact.name}</p>
                <p className="text-xs text-gray-500">{selectedContact.role}</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-[#f4f7fb]/50">
              {messages.map(msg => {
                const isMine = msg.sender === 'me';
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[75%]">
                      <div className={`px-4 py-2.5 ${
                        isMine
                          ? 'bg-[#252578] text-white rounded-2xl rounded-br-md'
                          : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-md shadow-sm'
                      }`}>
                        <p className="text-sm leading-relaxed">{msg.text}</p>
                      </div>
                      <p className={`text-[10px] text-gray-400 mt-1 ${isMine ? 'text-right' : 'text-left'}`}>
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578]"
                />
                <button
                  onClick={handleSend}
                  disabled={!messageInput.trim()}
                  className="bg-[#252578] text-white rounded-xl px-4 py-2.5 transition-all hover:bg-[#1f1f66] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f4f7fb]/50">
            <div className="text-center">
              <MessageCircle size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 font-medium">Select a conversation</p>
              <p className="text-xs text-gray-300 mt-1">Choose a contact from the left panel</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
