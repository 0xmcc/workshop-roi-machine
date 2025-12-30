import React, { useState, useRef } from 'react';
import { importLumaGuestList, validateLumaCsv } from '../services/lumaImportService';
import type { LumaImportResult, FieldEventId } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  fieldEvents: Array<{ id: FieldEventId; title: string }>;
}

type ImportStep = 'select' | 'preview' | 'importing' | 'complete';

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  fieldEvents
}) => {
  const [step, setStep] = useState<ImportStep>('select');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [csvContent, setCsvContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    rowCount: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);
  const [importResult, setImportResult] = useState<LumaImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setStep('select');
    setSelectedEventId('');
    setCsvContent('');
    setFileName('');
    setValidationResult(null);
    setImportResult(null);
    setError(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      
      // Validate the CSV
      const validation = validateLumaCsv(content);
      setValidationResult(validation);
      
      if (validation.rowCount === 0) {
        setError('CSV file is empty or has no data rows');
      } else {
        setStep('preview');
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!selectedEventId || !csvContent) return;

    setStep('importing');
    setError(null);

    try {
      const result = await importLumaGuestList(csvContent, {
        fieldEventId: selectedEventId,
        continueOnError: true
      });
      
      setImportResult(result);
      setStep('complete');
      
      if (result.errors.length === 0) {
        onImportComplete();
      }
    } catch (err: any) {
      setError(err?.message || 'Import failed');
      setStep('preview');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-bold">Import Luma Guest List</h2>
          <button onClick={handleClose} className="text-white/80 hover:text-white text-2xl">
            ×
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Select Event & File */}
          {step === 'select' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Select Field Event
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Choose an event...</option>
                  {fieldEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Upload Luma CSV Export
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedEventId}
                  className={`w-full border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    selectedEventId
                      ? 'border-slate-300 hover:border-indigo-400 cursor-pointer'
                      : 'border-slate-200 bg-slate-50 cursor-not-allowed'
                  }`}
                >
                  {fileName ? (
                    <div>
                      <div className="text-indigo-600 font-medium">{fileName}</div>
                      <div className="text-sm text-slate-500 mt-1">Click to change file</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-slate-500">
                        {selectedEventId ? 'Click to select CSV file' : 'Select an event first'}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        Export from Luma → Guest List → Export CSV
                      </div>
                    </div>
                  )}
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && validationResult && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="text-sm text-slate-600">
                  <strong>File:</strong> {fileName}
                </div>
                <div className="text-sm text-slate-600">
                  <strong>Rows to import:</strong> {validationResult.rowCount}
                </div>
                <div className="text-sm text-slate-600">
                  <strong>Event:</strong> {fieldEvents.find(e => e.id === selectedEventId)?.title}
                </div>
              </div>

              {validationResult.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="text-amber-800 font-medium text-sm mb-2">
                    {validationResult.errors.length} validation warning(s)
                  </div>
                  <div className="text-xs text-amber-700 max-h-32 overflow-y-auto space-y-1">
                    {validationResult.errors.slice(0, 5).map((err, i) => (
                      <div key={i}>Row {err.row}: {err.error}</div>
                    ))}
                    {validationResult.errors.length > 5 && (
                      <div>...and {validationResult.errors.length - 5} more</div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  onClick={handleImport}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
                >
                  Import {validationResult.rowCount} Guests
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {step === 'importing' && (
            <div className="text-center py-8">
              <div className="animate-spin w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4" />
              <div className="text-slate-600">Importing guests...</div>
              <div className="text-sm text-slate-400 mt-1">This may take a moment</div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && importResult && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="text-lg font-bold text-slate-900">Import Complete</div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">People created:</span>
                  <span className="font-medium text-slate-900">{importResult.peopleCreated}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">People updated:</span>
                  <span className="font-medium text-slate-900">{importResult.peopleUpdated}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Attendance records created:</span>
                  <span className="font-medium text-slate-900">{importResult.attendanceCreated}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Attendance records updated:</span>
                  <span className="font-medium text-slate-900">{importResult.attendanceUpdated}</span>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="text-amber-800 font-medium text-sm mb-2">
                    {importResult.errors.length} row(s) had errors
                  </div>
                  <div className="text-xs text-amber-700 max-h-32 overflow-y-auto space-y-1">
                    {importResult.errors.slice(0, 5).map((err, i) => (
                      <div key={i}>Row {err.row} ({err.email}): {err.error}</div>
                    ))}
                    {importResult.errors.length > 5 && (
                      <div>...and {importResult.errors.length - 5} more</div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
