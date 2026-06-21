import React, { useEffect, useState } from 'react';
import { getCachedTicketFormOptions, getTicketFormOptions } from '@/services/ticketService';

const initialFormData = {
  title: '',
  machine_ID: '',
  problem_category_ID: '',
  description: '',
  created_by: 1,
};

const allowedFileTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_TITLE_CHARS = 250;
const MAX_DESCRIPTION_CHARS = 500;

export default function TicketModal({ isOpen, onClose, onSubmit }) {
  if (!isOpen) return null;

  const [loadingOptions, setLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [optionsError, setOptionsError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [options, setOptions] = useState({
    equipment_options: [],
    category_options: [],
    machines: [],
    problem_categories: [],
  });
  const [formData, setFormData] = useState(initialFormData);
  const [attachments, setAttachments] = useState([]);
  const [fileError, setFileError] = useState('');
  const [touched, setTouched] = useState({});

  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const titleChars = formData.title?.length || 0;
  const descriptionChars = formData.description?.length || 0;
  const titleError = !formData.title?.trim() ? 'Title is required.' : titleChars > MAX_TITLE_CHARS ? `Title exceeds ${MAX_TITLE_CHARS} characters (${titleChars}).` : '';
  const categoryError = !formData.problem_category_ID ? 'Category is required.' : '';
  const equipmentError = !formData.machine_ID ? 'Equipment is required.' : '';
  const descriptionError = !formData.description?.trim() ? 'Description is required.' : descriptionChars > MAX_DESCRIPTION_CHARS ? `Description exceeds ${MAX_DESCRIPTION_CHARS} characters (${descriptionChars}).` : '';

  const resetFormState = () => {
    setFormData(initialFormData);
    setAttachments([]);
    setFileError('');
    setSubmitError('');
    setTouched({});
  };

  useEffect(() => {
    if (!isOpen) return;

    resetFormState();

    const cachedOptions = getCachedTicketFormOptions();
    if (cachedOptions) {
      setOptions(cachedOptions);
    }

    const loadOptions = async () => {
      if (!cachedOptions) setLoadingOptions(true);
      setOptionsError('');

      try {
        const data = await getTicketFormOptions({ forceRefresh: true });
        setOptions(data);
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401) {
          setOptionsError('Session expired (401). Please log in again, then reopen this form.');
        } else {
          setOptionsError(error?.response?.data?.message || 'Failed to load ticket options.');
        }
      } finally {
        setLoadingOptions(false);
      }
    };

    loadOptions();
  }, [isOpen]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleFileChange = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    setFileError('');

    if (selectedFiles.length === 0) {
      setAttachments([]);
      return;
    }

    const invalidFile = selectedFiles.find((selected) => !allowedFileTypes.includes(selected.type));
    if (invalidFile) {
      setFileError('Invalid file type. Allowed: PDF, JPG, PNG, DOCX.');
      setAttachments([]);
      event.target.value = '';
      return;
    }

    const oversizedFile = selectedFiles.find((selected) => selected.size > 5 * 1024 * 1024);
    if (oversizedFile) {
      setFileError('File size must be under 5MB.');
      setAttachments([]);
      event.target.value = '';
      return;
    }

    setAttachments(selectedFiles);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      await onSubmit?.({
        ...formData,
        attachments,
      });
      resetFormState();
    } catch (error) {
      setSubmitError(error?.response?.data?.message || 'Failed to create ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    resetFormState();
    onClose();
  };

  const equipmentOptions = options.equipment_options?.length
    ? options.equipment_options
    : options.machines.map((machine) => ({
      value: machine.machine_ID,
      label: `${machine.machine_name} - ${machine.serial_number}`,
    }));

  const categoryOptions = options.category_options?.length
    ? options.category_options
    : options.problem_categories.map((category) => ({
      value: category.problem_category_ID,
      label: category.category_name,
    }));

  const isFormValid = Boolean(
    formData.title?.trim() &&
    titleChars <= MAX_TITLE_CHARS &&
    formData.problem_category_ID &&
    formData.machine_ID &&
    formData.description?.trim() &&
    descriptionChars <= MAX_DESCRIPTION_CHARS
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[1.5px]">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-8 py-6">
          <div>
            <h2 className="text-2xl font-bold text-[#252578]">Create New Ticket</h2>
            <p className="mt-1 text-sm text-gray-500">Submit a new support request for your equipment</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-8">
          {optionsError && <p className="text-sm text-red-500">{optionsError}</p>}
          {submitError && <p className="text-sm text-red-500">{submitError}</p>}

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Ticket Title</label>
            <div className="relative">
              <input
                name="title"
                type="text"
                required
                placeholder="Brief description of the issue"
                value={formData.title}
                onChange={handleChange}
                onBlur={() => touch('title')}
                disabled={isSubmitting}
                className={`w-full rounded-xl border bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578] ${touched.title && titleError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              />
              <span className={`absolute bottom-3 right-3 text-[10px] ${titleChars > MAX_TITLE_CHARS ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                {titleChars}/{MAX_TITLE_CHARS}
              </span>
            </div>
            {touched.title && titleError && <p className="mt-1.5 text-xs text-red-500">{titleError}</p>}
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Category</label>
              <select
                name="problem_category_ID"
                required
                value={formData.problem_category_ID}
                onChange={handleChange}
                onBlur={() => touch('category')}
                disabled={loadingOptions || isSubmitting}
                className={`w-full rounded-xl border bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578] ${touched.category && categoryError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              >
                <option value="">Select Category</option>
                {categoryOptions.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              {touched.category && categoryError && <p className="mt-1.5 text-xs text-red-500">{categoryError}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Equipment Name / ID</label>
              <select
                name="machine_ID"
                required
                value={formData.machine_ID}
                onChange={handleChange}
                onBlur={() => touch('equipment')}
                disabled={loadingOptions || isSubmitting}
                className={`w-full rounded-xl border bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578] ${touched.equipment && equipmentError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              >
                <option value="">Select Equipment</option>
                {equipmentOptions.map((machine) => (
                  <option key={machine.value} value={machine.value}>
                    {machine.label}
                  </option>
                ))}
              </select>
              {touched.equipment && equipmentError && <p className="mt-1.5 text-xs text-red-500">{equipmentError}</p>}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Detailed Description</label>
            <div className="relative">
              <textarea
                name="description"
                required
                rows="4"
                placeholder="Please provide as much detail as possible..."
                value={formData.description}
                onChange={handleChange}
                onBlur={() => touch('description')}
                disabled={isSubmitting}
                className={`w-full resize-none rounded-xl border bg-white px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[#252578] ${touched.description && descriptionError ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}
              />
              <span className={`absolute bottom-2 right-3 text-[10px] ${descriptionChars > MAX_DESCRIPTION_CHARS ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                {descriptionChars}/{MAX_DESCRIPTION_CHARS}
              </span>
            </div>
            {touched.description && descriptionError && <p className="mt-1.5 text-xs text-red-500">{descriptionError}</p>}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Attachment (Optional)</label>
            {attachments.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-300 p-8 text-center transition-colors hover:bg-gray-50">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.png,.docx"
                  disabled={isSubmitting}
                />
                <label htmlFor="file-upload" className="flex cursor-pointer flex-col items-center">
                  <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span className="text-sm font-medium text-[#252578]">Click to upload</span>
                  <span className="mt-1 text-xs text-gray-500">PDF, JPG, PNG or DOCX (max. 5MB)</span>
                </label>
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold">{attachments[0].name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setAttachments([]); document.getElementById('file-upload').value = ''; }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {fileError && <p className="mt-2 text-sm text-red-500">{fileError}</p>}
          </div>

          <div className="mt-4 flex justify-end gap-4 border-t border-gray-100 pt-6">
            <button
              type="submit"
              disabled={loadingOptions || isSubmitting || !isFormValid}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#252578] to-[#3b82f6] px-8 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting && (
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {isSubmitting ? 'Creating Ticket...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}