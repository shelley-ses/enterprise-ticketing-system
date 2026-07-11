import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { MessageCircle, Send, Users, User, AlertCircle, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import {
  getTicketMessages,
  sendTicketMessage,
  editTicketMessage,
  deleteTicketMessage,
} from '@/services/messagingService';
import { getMessagingEcho } from '@/services/messagingEcho';
import {
  getCustomerTickets,
  getCSIncomingTickets,
  getEmployeeInternalTickets,
} from '@/services/ticketService';

// ─── Badge Styling Helpers ──────────────────────────────────────────────────
const statusBadges = {
  'Open': 'bg-blue-50 text-blue-700 border-blue-100',
  'In Progress': 'bg-amber-50 text-amber-700 border-amber-100',
  'Resolved': 'bg-green-50 text-green-700 border-green-100',
  'Closed': 'bg-gray-50 text-gray-700 border-gray-100',
  'Pending Assignment': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Pending': 'bg-amber-50 text-amber-700 border-amber-100',
};

const priorityBadges = {
  'Low': 'bg-gray-50 text-gray-600 border-gray-200',
  'Medium': 'bg-blue-50 text-blue-600 border-blue-200',
  'High': 'bg-orange-50 text-orange-600 border-orange-200',
  'Critical': 'bg-red-50 text-red-600 border-red-200',
};

// ─── Helpers ──────────────────────────────────────────────────────────────

const formatTime = (iso) => {
  if (!iso) return '';
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

  const userType = isCS ? 'cs' : (isEmployee ? 'employee' : 'customer');
  const userId = isCustomer ? user?.id : user?.emp_id;
  const currentUserKey = `${userType}:${userId}`;

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editInputText, setEditInputText] = useState('');
  const [activeHistoryMsgId, setActiveHistoryMsgId] = useState(null);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);

  const location = useLocation();
  const initialTicketId = location.state?.selectedTicketId;
  const [showDetailsSidebar, setShowDetailsSidebar] = useState(true);

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [csFilter, setCsFilter] = useState('external');
  
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [lastMessageIdOnLoad, setLastMessageIdOnLoad] = useState(null);

  const messagesEndRef = useRef(null);

  const lastLoadIndex = useMemo(() => {
    if (!lastMessageIdOnLoad) return -1;
    return messages.findIndex(m => (m.id === lastMessageIdOnLoad || m._id === lastMessageIdOnLoad));
  }, [messages, lastMessageIdOnLoad]);

  const firstNewMessageIndex = useMemo(() => {
    if (lastLoadIndex === -1) return -1;
    for (let i = lastLoadIndex + 1; i < messages.length; i++) {
      const msg = messages[i];
      const isMine = (msg.sender_type === userType && Number(msg.sender_id) === Number(userId)) ||
                     (msg.sender_type === 'cs' && userType === 'cs');
      if (!isMine) {
        return i;
      }
    }
    return -1;
  }, [messages, lastLoadIndex, userType, userId]);

  // 1. Fetch tickets for chat list
  useEffect(() => {
    let active = true;
    async function loadTickets() {
      try {
        setLoading(true);
        let list = [];
        if (isCS) {
          list = await getCSIncomingTickets({ limit: 100, forceRefresh: true });
        } else if (isEmployee) {
          const res = await getEmployeeInternalTickets();
          list = res?.tickets || [];
        } else {
          list = await getCustomerTickets({ createdBy: user?.id, limit: 100, forceRefresh: true });
        }
        if (active) {
          setTickets(list);

          // Auto-select if initialTicketId is in the list
          if (initialTicketId) {
            const numericId = Number(initialTicketId);
            const found = list.find(t => {
              const ticketId = t.ticket_ID || t.id;
              const numericTicketId = Number(String(ticketId).replace(/\D/g, ''));
              return numericTicketId === numericId || String(ticketId) === String(initialTicketId);
            });
            if (found) {
              const selectedId = found.ticket_ID || found.id;
              setSelectedContactId(selectedId);
              // Clear location state so it doesn't keep resetting selection on refresh
              window.history.replaceState({}, document.title);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load tickets for messaging page", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadTickets();
    return () => { active = false; };
  }, [isCS, isEmployee, user, initialTicketId]);

  // 2. Map tickets to formatted contacts
  const contacts = useMemo(() => {
    return tickets.map(t => {
      const ticketId = t.ticket_ID || t.id;
      let contactName = '';
      let contactRole = '';
      let type = 'external';

      if (isCS) {
        contactName = t.customer || t.client_name || t.created_by_name || 'Client';
        contactRole = t.is_internal ? 'Employee' : 'Customer';
        type = t.is_internal ? 'internal' : 'external';
      } else {
        contactName = 'Customer Support';
        contactRole = 'Representative';
        type = isEmployee ? 'internal' : 'external';
      }

      // Delegated check — once a ticket is assigned or moved past Open/Pending status,
      // it is read-only for both CS agents and Customers.
      const hasAssignment = (t.assigned_to !== undefined && t.assigned_to !== null)
        ? true
        : (Array.isArray(t.assigned) && t.assigned.length > 0);

      const isDelegated = hasAssignment || (t.status !== 'Open' && t.status !== 'Pending Assignment' && t.status !== 'Pending');

      return {
        id: ticketId,
        name: `${contactName} (${t.title})`,
        displayTitle: t.title,
        subtitle: contactName,
        role: contactRole,
        type,
        status: t.status || t.status_name || 'Open',
        isDelegated,
        requested_by: t.requested_by,
        description: t.description || 'No description provided.',
        category: t.category || t.category_name || 'General',
        equipment: t.equipment || (t.machine_name ? `${t.machine_name} - ${t.serial_number}` : 'Unspecified equipment'),
        date: t.date_created || t.created_at || t.date || '',
        priority: t.priority || t.priority_name || 'Low',
      };
    });
  }, [tickets, isCS, isEmployee]);

  // 3. Auto select first contact if none selected
  useEffect(() => {
    if (contacts.length > 0 && !selectedContactId) {
      const firstId = isCS
        ? (contacts.find(c => c.type === 'external')?.id || contacts[0].id)
        : contacts[0].id;
      setSelectedContactId(firstId);
    }
  }, [contacts, selectedContactId, isCS]);

  const selectedContact = useMemo(() => contacts.find(c => c.id === selectedContactId), [contacts, selectedContactId]);

  // 4. Fetch messages and bind WebSockets on selection
  useEffect(() => {
    if (!selectedContactId) return;

    let active = true;
    setMessagesLoading(true);

    getTicketMessages(selectedContactId)
      .then(msgs => {
        if (active) {
          setMessages(msgs);
          setMessagesLoading(false);
          if (msgs.length > 0) {
            const lastMsg = msgs[msgs.length - 1];
            setLastMessageIdOnLoad(lastMsg.id || lastMsg._id);
          } else {
            setLastMessageIdOnLoad(null);
          }
        }
      })
      .catch(err => {
        console.error("Failed to load messages", err);
        if (active) setMessagesLoading(false);
      });

    // Use the singleton Echo instance (no new connections created)
    const echo = getMessagingEcho();
    const channelName = `ticket.${selectedContactId}`;
    const channel = echo.private(channelName);

    channel.listen('.App\\Events\\MessageSent', (e) => {
      if (active) {
        setMessages(prev => {
          const msgId = e.id || e._id;
          if (prev.some(m => m.id === msgId || m._id === msgId)) {
            return prev;
          }
          return [...prev, {
            id: msgId,
            _id: msgId,
            ticket_id: e.ticket_id,
            sender_id: e.sender_id,
            sender_name: e.sender_name,
            sender_type: e.sender_type,
            message: e.message,
            created_at: e.created_at,
          }];
        });
      }
    });

    channel.listen('.App\\Events\\MessageUpdated', (e) => {
      if (active) {
        setMessages(prev => {
          return prev.map(m => {
            if (m.id === e.id || m._id === e.id) {
              return {
                ...m,
                message: e.message,
                edit_history: e.edit_history,
                updated_at: e.updated_at,
              };
            }
            return m;
          });
        });
      }
    });

    channel.listen('.App\\Events\\MessageDeleted', (e) => {
      if (active) {
        if (e.user_key === currentUserKey) {
          setMessages(prev => prev.filter(m => m.id !== e.id && m._id !== e.id));
        }
      }
    });

    return () => {
      active = false;
      // Leave the channel but keep the WebSocket connection alive for reuse
      echo.leave(channelName);
    };
  }, [selectedContactId, currentUserKey]);

  // 5. Listen to ticket status/updates channel globally
  useEffect(() => {
    let active = true;
    const echo = getMessagingEcho();
    const updatesChannel = echo.channel('ticket-updates');

    const handleTicketChanged = (e) => {
      if (!active) return;
      const changedTicketId = e.ticket_ID || e.ticketId || e.id;
      if (!changedTicketId) return;

      setTickets(prev => {
        return prev.map(t => {
          const tId = t.ticket_ID || t.id;
          const match = Number(String(tId).replace(/\D/g, '')) === Number(changedTicketId) ||
                        String(tId) === String(changedTicketId);
          if (match) {
            // Read updated ticket details
            const rawTicket = e.ticket || {};
            const updatedStatus = rawTicket.status_name || rawTicket.status || t.status || t.status_name;
            const updatedPriority = rawTicket.priority_name || rawTicket.priority || t.priority || t.priority_name;
            const updatedDescription = rawTicket.description || t.description;
            const updatedCategory = rawTicket.category_name || rawTicket.category || t.category;
            const updatedEquipment = rawTicket.machine_name 
              ? `${rawTicket.machine_name} - ${rawTicket.serial_number}`
              : (rawTicket.equipment || t.equipment);

            return {
              ...t,
              status: updatedStatus,
              status_name: updatedStatus,
              priority: updatedPriority,
              priority_name: updatedPriority,
              description: updatedDescription,
              category: updatedCategory,
              equipment: updatedEquipment,
              assigned_to: rawTicket.assigned_to !== undefined ? rawTicket.assigned_to : t.assigned_to,
            };
          }
          return t;
        });
      });
    };

    updatesChannel.listen('.ticket.changed', handleTicketChanged);

    return () => {
      active = false;
      updatesChannel.stopListening('.ticket.changed', handleTicketChanged);
    };
  }, []);

  // 6. Scroll to bottom of message logs
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, selectedContactId]);

  // 7. Filter contacts
  const filteredContacts = useMemo(() => {
    let filtered = contacts;
    if (isCS) filtered = filtered.filter(c => c.type === csFilter);
    return filtered;
  }, [contacts, isCS, csFilter]);

  const handleSelectContact = useCallback((contactId) => {
    setSelectedContactId(contactId);
  }, []);

  const handleSend = useCallback(async () => {
    const text = messageInput.trim();
    if (!text || !selectedContactId) return;
    if (selectedContact?.isDelegated) return;

    setMessageInput('');

    try {
      const newMsg = await sendTicketMessage(selectedContactId, text);
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id || m._id === newMsg._id)) {
          return prev;
        }
        return [...prev, newMsg];
      });
    } catch (err) {
      console.error("Failed to send message", err);
      window.alert("Failed to send message. Please try again.");
    }
  }, [messageInput, selectedContactId, selectedContact?.isDelegated]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleInputFocus = useCallback(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      setLastMessageIdOnLoad(lastMsg.id || lastMsg._id);
    }
  }, [messages]);

  const handleUpdateMessage = useCallback(async (messageId) => {
    const trimmed = editInputText.trim();
    if (!trimmed || !selectedContactId) return;

    try {
      const updated = await editTicketMessage(selectedContactId, messageId, trimmed);
      setMessages(prev => prev.map(m => (m.id === messageId || m._id === messageId) ? updated : m));
      setEditingMessageId(null);
    } catch (err) {
      console.error("Failed to update message", err);
      window.alert("Failed to update message. Please try again.");
    }
  }, [editInputText, selectedContactId]);

  const handleDeleteMessage = useCallback(async (messageId) => {
    if (!selectedContactId) return;
    if (!window.confirm("Are you sure you want to delete this message for you? It will still be visible to other participants.")) {
      return;
    }

    try {
      await deleteTicketMessage(selectedContactId, messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId && m._id !== messageId));
    } catch (err) {
      console.error("Failed to delete message", err);
      window.alert("Failed to delete message. Please try again.");
    }
  }, [selectedContactId]);

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <h1 className="text-2xl font-bold text-gray-800 mb-4 flex-shrink-0">Messages</h1>

      <div className="flex flex-1 bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden min-h-0">
        {/* ── Left Panel ── */}
        <div className="w-[360px] lg:w-[380px] border-r border-gray-100 flex flex-col flex-shrink-0">
          {/* Filter bar — CS: External / Internal */}
          {isCS && (
            <div className="flex items-center gap-2 p-3 pb-2 border-b border-gray-100 flex-shrink-0 flex-wrap">
              <button
                onClick={() => setCsFilter('external')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  csFilter === 'external'
                    ? 'bg-[#252578] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Users size={13} />
                External
              </button>
              <button
                onClick={() => setCsFilter('internal')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  csFilter === 'internal'
                    ? 'bg-[#252578] text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <User size={13} />
                Internal
              </button>
            </div>
          )}

          {/* Section label for non-CS */}
          {!isCS && (
            <div className="flex items-center justify-between px-4 pt-3 pb-1 flex-shrink-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {isCustomer ? 'Your CS Active Tickets' : 'Active Ticket Chats'}
              </p>
            </div>
          )}

          {/* Contact list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading tickets...</div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle size={32} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No active tickets for chat</p>
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
                  <Avatar name={contact.subtitle} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800 truncate">
                        {contact.displayTitle}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-500 truncate">
                        {contact.subtitle}
                      </span>
                      {contact.isDelegated ? (
                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">Delegated</span>
                      ) : (
                        <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Active CS</span>
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
          <div className="flex-1 flex flex-row min-w-0">
            {/* Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 border-r border-gray-100">
              {/* Conversation header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
                <div className="flex items-center gap-3">
                  <Avatar name={selectedContact.subtitle} />
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{selectedContact.displayTitle}</p>
                    <p className="text-xs text-gray-500">Owner: {selectedContact.subtitle} • Status: {selectedContact.status}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailsSidebar(!showDetailsSidebar)}
                  className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                    showDetailsSidebar
                      ? 'bg-[#252578] text-white border-[#252578] shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  title="Toggle Ticket Details"
                >
                  <AlertCircle size={14} />
                  <span>Ticket Details</span>
                </button>
              </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 bg-[#f4f7fb]/50">
              {messagesLoading ? (
                <div className="text-center py-8 text-gray-400">Loading chat history...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <MessageCircle size={28} className="mx-auto text-gray-300 mb-1" />
                  <p className="text-xs">No messages yet. Send a message to start the conversation.</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const msgId = msg.id || msg._id;
                  const isMine = (msg.sender_type === userType && Number(msg.sender_id) === Number(userId)) ||
                                 (msg.sender_type === 'cs' && userType === 'cs');
                  const isAuthor = msg.sender_type === userType && Number(msg.sender_id) === Number(userId);
                  const showNewMessagesBanner = idx === firstNewMessageIndex;

                  if (msg.sender_type === 'system' || msg.sender_name === 'System') {
                    return (
                      <React.Fragment key={msgId}>
                        {showNewMessagesBanner && (
                          <div className="flex items-center my-4 select-none">
                            <div className="flex-1 border-t border-gray-200"></div>
                            <span className="mx-4 text-[10px] font-bold text-gray-600 bg-gray-50 px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm border border-gray-200 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse shrink-0"></span>
                              New Messages
                            </span>
                            <div className="flex-1 border-t border-gray-200"></div>
                          </div>
                        )}
                        <div className="flex justify-center my-3 select-none">
                          <span className="text-[11px] text-gray-500 bg-gray-100 border border-gray-200/50 px-3.5 py-1.5 rounded-full shadow-xs flex items-center gap-1.5 font-medium max-w-[90%] text-center">
                            <AlertCircle size={12} className="text-gray-400 shrink-0" />
                            {msg.message}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={msgId}>
                      {showNewMessagesBanner && (
                        <div className="flex items-center my-4 select-none">
                          <div className="flex-1 border-t border-gray-200"></div>
                          <span className="mx-4 text-[10px] font-bold text-gray-600 bg-gray-50 px-2.5 py-1 rounded-full uppercase tracking-wider shadow-sm border border-gray-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse shrink-0"></span>
                            New Messages
                          </span>
                          <div className="flex-1 border-t border-gray-200"></div>
                        </div>
                      )}
                      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} group/msg`}>
                        <div className="max-w-[75%] flex flex-col">
                        <div className="text-[10px] text-gray-400 mb-0.5 px-1 flex justify-between gap-2">
                          <span>{msg.sender_name}</span>
                        </div>
                        
                        <div className={`flex items-center gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                          {/* Message Bubble */}
                          <div className={`px-4 py-2.5 ${
                            isMine
                              ? 'bg-[#252578] text-white rounded-2xl rounded-br-md'
                              : 'bg-white text-gray-800 border border-gray-100 rounded-2xl rounded-bl-md shadow-sm'
                          }`}>
                            {editingMessageId === msgId ? (
                              <div className="flex flex-col gap-1.5 min-w-[200px]">
                                <input
                                  type="text"
                                  value={editInputText}
                                  onChange={e => setEditInputText(e.target.value)}
                                  className="w-full text-sm text-gray-800 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#252578] dark:text-gray-900"
                                  autoFocus
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleUpdateMessage(msgId);
                                    if (e.key === 'Escape') setEditingMessageId(null);
                                  }}
                                />
                                <div className="flex justify-end gap-1.5 text-[10px]">
                                  <button
                                    onClick={() => setEditingMessageId(null)}
                                    className="px-2 py-0.5 rounded hover:bg-gray-100 text-gray-500 font-semibold cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleUpdateMessage(msgId)}
                                    disabled={!editInputText.trim()}
                                    className="px-2 py-0.5 bg-[#f3f4f6] text-gray-800 hover:bg-gray-200 rounded font-semibold cursor-pointer disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                            )}
                          </div>

                          {/* Options Menu Trigger & Dropdown */}
                          {editingMessageId !== msgId && (
                            <div className="relative flex items-center">
                              <button
                                onClick={() => setActiveMenuMsgId(activeMenuMsgId === msgId ? null : msgId)}
                                className="opacity-0 group-hover/msg:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity p-1 rounded-full hover:bg-gray-100 cursor-pointer flex items-center justify-center"
                                title="Options"
                              >
                                <MoreVertical size={14} />
                              </button>
                              {activeMenuMsgId === msgId && (
                                <div className={`absolute bottom-6 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-10 w-32 text-left text-xs ${isMine ? 'right-0' : 'left-0'}`}>
                                  {isAuthor && (
                                    <button
                                      onClick={() => {
                                        setEditingMessageId(msgId);
                                        setEditInputText(msg.message);
                                        setActiveMenuMsgId(null);
                                      }}
                                      className="w-full px-3 py-1.5 hover:bg-gray-50 flex items-center gap-1.5 text-gray-700 cursor-pointer font-medium whitespace-nowrap"
                                    >
                                      <Edit2 size={12} />
                                      Edit
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      handleDeleteMessage(msgId);
                                      setActiveMenuMsgId(null);
                                    }}
                                    className="w-full px-3 py-1.5 hover:bg-gray-50 flex items-center gap-1.5 text-red-600 hover:text-red-700 cursor-pointer font-medium whitespace-nowrap"
                                  >
                                    <Trash2 size={12} />
                                    Delete for you
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Footer / Edit History Toggle */}
                        <div className={`flex items-center mt-1 text-[10px] text-gray-400 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span>{formatTime(msg.created_at)}</span>
                          {msg.edit_history && msg.edit_history.length > 0 && (
                            <button
                              onClick={() => setActiveHistoryMsgId(activeHistoryMsgId === msgId ? null : msgId)}
                              className="hover:text-gray-600 underline ml-2 cursor-pointer font-medium text-[9px]"
                            >
                              (edited)
                            </button>
                          )}
                        </div>

                        {/* Edit History dropdown */}
                        {activeHistoryMsgId === msgId && msg.edit_history && (
                          <div className={`mt-2 bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-600 max-w-[280px] shadow-sm ${isMine ? 'self-end' : 'self-start'}`}>
                            <p className="font-semibold mb-1 border-b border-gray-100 pb-0.5 text-[9px] uppercase text-gray-400 tracking-wider">Edit History</p>
                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                              {msg.edit_history.map((hist, idx) => (
                                <div key={idx} className="border-b border-gray-100/50 pb-1 last:border-0 last:pb-0">
                                  <p className="font-medium text-gray-800 break-words">{hist.message}</p>
                                  <p className="text-[9px] text-gray-400 mt-0.5">{new Date(hist.edited_at).toLocaleString()}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    </React.Fragment>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input / Delegated Banner / Self-created Ticket Banner */}
            {selectedContact.isDelegated ? (
              <div className="flex items-center justify-center gap-2 px-6 py-5 border-t border-gray-100 bg-amber-50/50 flex-shrink-0">
                <AlertCircle className="text-amber-600" size={18} />
                <p className="text-xs text-amber-800 font-medium">
                  This ticket has been delegated or updated beyond the initial CS phase. Chat is now read-only.
                </p>
              </div>
            ) : isCS && Number(selectedContact.requested_by) === Number(user?.emp_id ?? user?.id) ? (
              <div className="flex items-center justify-center gap-2 px-6 py-5 border-t border-gray-100 bg-amber-50/50 flex-shrink-0">
                <AlertCircle className="text-amber-600" size={18} />
                <p className="text-xs text-amber-800 font-medium">
                  You cannot send messages on an internal ticket you created.
                </p>
              </div>
            ) : (
              <div className="px-6 py-4 border-t border-gray-100 bg-white flex-shrink-0">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={handleInputFocus}
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
            )}
          </div>

          {/* Collapsible details sidebar */}
          {showDetailsSidebar && (
            <div className="w-[300px] xl:w-[320px] bg-white flex flex-col flex-shrink-0 overflow-y-auto border-l border-gray-100 select-none">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-800 text-sm">Ticket Information</h3>
                <button onClick={() => setShowDetailsSidebar(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Ticket ID</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">
                    {typeof selectedContact.id === 'number'
                      ? `TKT-${String(selectedContact.id).padStart(4, '0')}`
                      : selectedContact.id}
                  </p>
                </div>
                
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Title</p>
                  <p className="text-xs font-semibold text-gray-700 mt-0.5 whitespace-normal break-words leading-relaxed">
                    {selectedContact.displayTitle}
                  </p>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</p>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        statusBadges[selectedContact.status] || 'bg-gray-50 text-gray-700 border-gray-100'
                      }`}>
                        {selectedContact.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Priority</p>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        priorityBadges[selectedContact.priority] || 'bg-gray-50 text-gray-700 border-gray-100'
                      }`}>
                        {selectedContact.priority}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Category</p>
                  <p className="text-xs font-medium text-gray-700 mt-0.5">{selectedContact.category}</p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Equipment</p>
                  <p className="text-xs font-medium text-gray-700 mt-0.5">{selectedContact.equipment}</p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Date Created</p>
                  <p className="text-xs font-medium text-gray-700 mt-0.5">
                    {selectedContact.date ? new Date(selectedContact.date).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'N/A'}
                  </p>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Description</p>
                  <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    {selectedContact.description}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-[#f4f7fb]/50">
            <div className="text-center">
              <MessageCircle size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 font-medium">Select a conversation</p>
              <p className="text-xs text-gray-300 mt-1">Choose a ticket from the left panel</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
