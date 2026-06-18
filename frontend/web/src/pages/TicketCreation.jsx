import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationModal from '@/components/NotificationModal';

export default function TicketCreation() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [successModal, setSuccessModal] = useState(false);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    setFileError('');
    if (selected) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(selected.type)) {
         setFileError('Invalid file type. Allowed: PDF, JPG, PNG, DOCX.');
         setFile(null);
         return;
      }
      if (selected.size > 5 * 1024 * 1024) {
         setFileError('File size must be under 5MB.');
         setFile(null);
         return;
      }
      setFile(selected);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSuccessModal(true);
  };

  const handleSuccessClose = () => {
    setSuccessModal(false);
    navigate('/customer-dashboard');
  };

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

      <div className="bg-white/70 backdrop-blur-lg border border-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.04)] p-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ticket Title</label>
              <input type="text" required placeholder="Brief description of the issue" className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Equipment Name / ID</label>
              <select required className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all">
                <option value="">Select Equipment</option>
                <option value="MRI-3T-B02">MRI - MRI-3T-B02</option>
                <option value="CT-SCAN-A1">CT Scan - CT-SCAN-A1</option>
                <option value="XRAY-M2">X-Ray Machine - XRAY-M2</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select required className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all">
                <option value="">Select Category</option>
                <option value="hardware">Hardware Issue</option>
                <option value="software">Software / System Error</option>
                <option value="maintenance">Routine Maintenance</option>
                <option value="calibration">Calibration Required</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select required className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all">
                <option value="low">Low - Non-critical</option>
                <option value="medium">Medium - Partially degraded</option>
                <option value="high">High - System down</option>
                <option value="critical">Critical - Patient care impacted</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Detailed Description</label>
            <textarea required rows="5" placeholder="Please provide as much detail as possible..." className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#252578] focus:border-transparent outline-none transition-all resize-y"></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (Optional)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition-colors">
              <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.png,.docx" />
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                <span className="text-sm font-medium text-[#252578]">Click to upload</span>
                <span className="text-xs text-gray-500 mt-1">PDF, JPG, PNG or DOCX (max. 5MB)</span>
              </label>
            </div>
            {file && <p className="text-sm text-green-600 mt-2 flex items-center gap-1"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg> Selected: {file.name}</p>}
            {fileError && <p className="text-sm text-red-500 mt-2">{fileError}</p>}
          </div>

          <div className="flex justify-end gap-4 mt-4 border-t border-gray-100 pt-6">
            <button type="button" onClick={() => navigate(-1)} className="px-6 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="px-8 py-3 bg-[#252578] text-white text-sm font-semibold rounded-xl hover:bg-[#1e1e60] transition-colors shadow-lg shadow-[#252578]/30">Submit Ticket</button>
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
