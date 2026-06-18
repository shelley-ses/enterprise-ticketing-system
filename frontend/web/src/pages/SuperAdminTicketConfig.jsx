import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Plus, MoreVertical } from 'lucide-react';
import { createPortal } from 'react-dom';
import NotificationModal from '@/components/NotificationModal';
import { 
  getSuperAdminConfig,
  createSuperAdminEquipment,
  updateSuperAdminEquipment,
  deleteSuperAdminEquipment,
  createSuperAdminPriority,
  updateSuperAdminPriority,
  deleteSuperAdminPriority
} from '@/services/ticketService';
import useRealtimeRefresh from '@/hooks/useRealtimeRefresh';

const TAB_EQUIPMENT = 'equipment';
const TAB_PRIORITY = 'priority';

const priorityColorOptions = [
  { value: 'bg-red-100 text-red-700', label: 'Red' },
  { value: 'bg-orange-100 text-orange-700', label: 'Orange' },
  { value: 'bg-yellow-100 text-yellow-700', label: 'Yellow' },
  { value: 'bg-green-100 text-green-700', label: 'Green' },
  { value: 'bg-blue-100 text-blue-700', label: 'Blue' },
  { value: 'bg-purple-100 text-purple-700', label: 'Purple' },
  { value: 'bg-indigo-100 text-indigo-700', label: 'Indigo' },
  { value: 'bg-pink-100 text-pink-700', label: 'Pink' },
  { value: 'bg-gray-100 text-gray-700', label: 'Gray' },
];

export default function SuperAdminTicketConfig() {
  const [tab, setTab] = useState(TAB_EQUIPMENT);
  const [items, setItems] = useState({ equipment: [], priorities: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(priorityColorOptions[0].value);
  const [notification, setNotification] = useState(null);

  const closeNotif = () => setNotification(null);
  const showSuccess = (title, message) => setNotification({ type: 'success', title, message });
  const showConfirm = (title, message, onConfirm, opts = {}) => setNotification({ type: 'confirm', title, message, onConfirm, onCancel: closeNotif, ...opts });

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSuperAdminConfig();
      setItems({
        equipment: data.equipment || [],
        priorities: data.priorities || []
      });
    } catch (err) {
      console.error('Failed to load superadmin config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useRealtimeRefresh({
    refresh: loadConfig,
    channels: [{ name: 'ticket-updates', event: 'ticket.changed' }],
    intervalMs: 15000,
  });

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e) => {
      if (!e.target.closest('[data-menu-id]') && !e.target.closest('.menu-trigger')) {
        setOpenMenuId(null);
        setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  const list = tab === TAB_EQUIPMENT ? items.equipment : items.priorities;

  const filtered = useMemo(() => {
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [list, search]);

  const handleAdd = () => {
    setEditingItem({ id: null, name: '' });
    setEditName('');
    setEditColor(priorityColorOptions[0].value);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditColor(item.color || priorityColorOptions[0].value);
    setOpenMenuId(null);
    setMenuPos(null);
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    try {
      if (tab === TAB_EQUIPMENT) {
        if (editingItem.id === null) {
          await createSuperAdminEquipment({ name: editName.trim() });
        } else {
          await updateSuperAdminEquipment(editingItem.id, { name: editName.trim() });
        }
      } else {
        if (editingItem.id === null) {
          await createSuperAdminPriority({ name: editName.trim(), color: editColor });
        } else {
          await updateSuperAdminPriority(editingItem.id, { name: editName.trim(), color: editColor });
        }
      }
      setEditingItem(null);
      showSuccess('Saved', `${tab === TAB_EQUIPMENT ? 'Category' : 'Priority'} has been saved.`);
      loadConfig();
    } catch (err) {
      console.error(err);
      showSuccess('Error', 'Failed to save configuration settings.');
    }
  };

  const handleDelete = (item) => {
    setOpenMenuId(null);
    setMenuPos(null);
    const label = tab === TAB_EQUIPMENT ? 'category' : 'priority';
    showConfirm(`Delete ${label}?`, `Are you sure you want to delete "${item.name}"?`, () => confirmDelete(item), { confirmText: 'Delete', confirmClassName: 'bg-red-600 hover:bg-red-700' });
  };

  const confirmDelete = async (item) => {
    closeNotif();
    try {
      if (tab === TAB_EQUIPMENT) {
        await deleteSuperAdminEquipment(item.id);
      } else {
        await deleteSuperAdminPriority(item.id);
      }
      showSuccess('Deleted', `${item.name} has been deleted.`);
      loadConfig();
    } catch (err) {
      console.error(err);
      showSuccess('Error', 'Failed to delete configuration item.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-[#252578]">Ticket Configuration</h1>
        <p className="mt-1 text-sm text-gray-500">Manage equipment categories and priority levels.</p>
      </div>

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        <button onClick={() => setTab(TAB_EQUIPMENT)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === TAB_EQUIPMENT ? 'bg-white text-[#252578] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
          Equipment Categories
        </button>
        <button onClick={() => setTab(TAB_PRIORITY)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === TAB_PRIORITY ? 'bg-white text-[#252578] shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
          Priority Levels
        </button>
      </div>

      <div className="flex items-center justify-between gap-4">
        {tab === TAB_EQUIPMENT && (
          <div className="relative w-full max-w-none flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
            />
          </div>
        )}
        {tab === TAB_PRIORITY && <div className="flex-1" />}
        <button onClick={handleAdd} className="inline-flex items-center gap-2 rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg shrink-0">
          <Plus size={18} />
          Add {tab === TAB_EQUIPMENT ? 'Category' : 'Priority'}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-5 py-4">ID</th>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4 text-center w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan="3" className="px-5 py-8 text-center text-sm text-gray-500">
                  No {tab === TAB_EQUIPMENT ? 'categories' : 'priorities'} found.
                </td>
              </tr>
            )}
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm font-semibold text-[#252578]">{item.id}</td>
                <td className="px-5 py-4 text-sm text-gray-800">
                  {tab === TAB_PRIORITY && item.color ? (
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${item.color}`}>{item.name}</span>
                  ) : (
                    item.name
                  )}
                </td>
                <td className="px-5 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => {
                      if (openMenuId === item.id) { setOpenMenuId(null); setMenuPos(null); return; }
                      const rect = e.currentTarget.getBoundingClientRect();
                      setMenuPos({ x: rect.right - 132, y: rect.bottom + 4 });
                      setOpenMenuId(item.id);
                    }}
                    className="rounded-full p-2 text-gray-500 hover:bg-gray-100 menu-trigger"
                    aria-label="Actions"
                  >
                    <MoreVertical size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openMenuId && menuPos && createPortal(
        (() => {
          const t = filtered.find((x) => x.id === openMenuId);
          return t ? (
            <div data-menu-id={t.id} style={{ position: 'fixed', left: menuPos.x, top: menuPos.y, zIndex: 9999 }}
              className="w-32 rounded-xl border border-gray-200 bg-white shadow-lg">
              <button onClick={() => { handleEdit(t); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-t-xl">
                Edit
              </button>
              <button onClick={() => { handleDelete(t); }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-b-xl">
                Delete
              </button>
            </div>
          ) : null;
        })(),
        document.body
      )}

      {editingItem !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
              <h2 className="text-lg font-bold text-gray-900">{editingItem.id === null ? 'Add' : 'Edit'} {tab === TAB_EQUIPMENT ? 'Category' : 'Priority'}</h2>
              <button type="button" onClick={() => setEditingItem(null)} className="p-2 text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={`Enter ${tab === TAB_EQUIPMENT ? 'category' : 'priority'} name`}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#252578]"
                />
              </div>
              {tab === TAB_PRIORITY && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {priorityColorOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEditColor(opt.value)}
                        className={`h-8 w-8 rounded-full border-2 transition-all ${opt.value.split(' ')[0]} ${editColor === opt.value ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                        title={opt.label}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => setEditingItem(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
                <button onClick={handleSave} disabled={!editName.trim()} className="rounded-xl bg-[#252578] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <NotificationModal
        isOpen={!!notification}
        type={notification?.type}
        title={notification?.title}
        message={notification?.message}
        onClose={closeNotif}
        onConfirm={notification?.onConfirm}
        onCancel={notification?.onCancel}
        confirmText={notification?.confirmText}
        confirmClassName={notification?.confirmClassName}
      />
    </div>
  );
}
