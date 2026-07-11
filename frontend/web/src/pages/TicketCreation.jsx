import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationModal from '@/components/NotificationModal';
import { getTicketFormOptions, createTicket } from '@/services/ticketService';

export default function TicketCreation() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    machine_ID: '',
    problem_category_ID: '',
    description: '',
    priority_ID: 1, // default to Low (1)
  });
  const [options, setOptions] = useState({
    equipment_options: [],
    category_options: [],
    machines: [],
    problem_categories: [],
    ticket_priorities: [],
  });
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [fileError, setFileError] = useState('');
  const [successModal, setSuccessModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState(null);

  useEffect(() => {
    const loadOptions = async () => {
      setLoadingOptions(true);
      setError('');
      try {
        const data = await getTicketFormOptions({ forceRefresh: true });
        setOptions(data);
        if (data.ticket_priorities?.length > 0) {
          setFormData((prev) => ({
            ...prev,
            priority_ID: data.ticket_priorities[0].priority_ID,
          }));
        }
      } catch (err) {
        setError('Failed to load ticket configuration options. Please refresh the page.');
        console.error(err);
      } finally {
        setLoadingOptions(false);
      }
    };
    loadOptions();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setFileError('');
    if (selected.length > 0) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const invalidFile = selected.find((f) => !allowedTypes.includes(f.type));
      if (invalidFile) {
         setFileError('Invalid file type. Allowed: PDF, JPG, PNG, DOCX.');
         return;
      }
      const oversizedFile = selected.find((f) => f.size > 15 * 1024 * 1024);
      if (oversizedFile) {
         setFileError('File size must be under 15MB.');
         return;
      }
      setFiles((prev) => [...prev, ...selected]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);

    try {
      const payload = new FormData();
      payload.append('title', formData.title);
      payload.append('machine_ID', formData.machine_ID);
      payload.append('problem_category_ID', formData.problem_category_ID);
      payload.append('description', formData.description);
      payload.append('priority_ID', formData.priority_ID);
      if (files && files.length > 0) {
        files.forEach((f) => {
          payload.append('attachments[]', f);
        });
      }
      
      const response = await createTicket(payload);
      const newTicketId = response.ticket?.ticket_ID || response.ticket_ID;
      setCreatedTicketId(newTicketId);
      setSuccessModal(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to submit ticket. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModal(false);
    if (createdTicketId) {
      navigate('/messages', { state: { selectedTicketId: createdTicketId } });
    } else {
      navigate('/customer-dashboard');
    }
  };

  const equipmentOptions = options.equipment_options?.length
    ? options.equipment_options
    : (options.machines || []).map((machine) => ({
      value: machine.machine_ID,
      label: `${machine.machine_name} - ${machine.serial_number}`,
    }));

  const categoryOptions = options.category_options?.length
    ? options.category_options
    : (options.problem_categories || []).map((category) => ({
      value: category.problem_category_ID,
      label: category.category_name,
    }));

  const priorityOptions = options.priority_options?.length
    ? options.priority_options
    : (options.ticket_priorities || []).map((p) => ({
      value: p.priority_ID,
      label: p.priority_name,
    }));

  return (
    <>
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-[#252578] flex items-center gap-2 text-sm font-medium mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-[#252578]">Create New Ticket</h1>
        <p className="text-gray-500 mt-2">Submit a new support request for your equipment.</p>
      </div>

      {error && (
        <div className={`mb-6 rounded-xl p-4 text-sm font-medium border flex items-start gap-3 transition-all ${
          error.includes('Security threat')
            ? 'bg-red-50/90 text-red-800 border-red-200 shadow-md ring-2 ring-red-500/20'
            : 'bg-red-50 text-red-700 border-red-100'
        }`}>
          {error.includes('Security threat') && (
            <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          )}
          <div>{error}</div>
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-lg border border-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ticket Title</label>
              <input 
                name="title"
                type="text" 
                required 
                value={formData.title}
                onChange={handleChange}
                placeholder="Brief description of the issue" 
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Equipment Name / ID</label>
              <select 
                name="machine_ID"
                required 
                value={formData.machine_ID}
                onChange={handleChange}
                disabled={loadingOptions}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all"
              >
                <option value="">Select Equipment</option>
                {equipmentOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select 
                name="problem_category_ID"
                required 
                value={formData.problem_category_ID}
                onChange={handleChange}
                disabled={loadingOptions}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all"
              >
                <option value="">Select Category</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select 
                name="priority_ID"
                required 
                value={formData.priority_ID}
                onChange={handleChange}
                disabled={loadingOptions}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all"
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Description</label>
            <textarea 
              name="description"
              required 
              rows="5" 
              value={formData.description}
              onChange={handleChange}
              placeholder="Please provide as much detail as possible..." 
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all resize-y"
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (Optional)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors">
              <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.png,.docx" multiple />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                <span className="text-sm font-medium text-[#252578]">Click to upload</span>
                <span className="text-xs text-gray-500 mt-1">PDF, JPG, PNG or DOCX (max. 15MB)</span>
              </label>
            </div>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((f, idx) => (
                  <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium truncate max-w-xs">{f.name}</span>
                      <span className="text-xs text-gray-400">({(f.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {fileError && <p className="text-sm text-red-500 mt-2">{fileError}</p>}
          </div>

          <div className="flex justify-end gap-4 mt-4 border-t border-gray-100 pt-6">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
            <button 
              type="submit" 
              disabled={loadingOptions || submitting}
              className="px-8 py-3 bg-[#252578] text-white text-sm font-semibold rounded-xl hover:bg-[#1e1e60] transition-colors shadow-lg shadow-[#252578]/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>

      <NotificationModal
        isOpen={successModal}
        type="success"
        title="Ticket Submitted Successfully!"
        message="Your support ticket has been created and will be reviewed shortly."
        onClose={handleSuccessClose}
      />
    </>
  );
}
