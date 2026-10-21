import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, File, CheckCircle, AlertCircle } from 'lucide-react';
import TopNav from '../../components/Layout/TopNav';
import { useDemo } from '../../context/DemoContext';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker to load from CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

const DemoUpload = () => {
  const { setTransactionsFromParsed } = useDemo();
  const navigate = useNavigate();

  const [provider, setProvider] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);

  const cleanMerchant = (raw) => {
    let cleaned = raw.trim();
    // Strip prefixes
    cleaned = cleaned.replace(/^(Paid to|Received from|Refund from|for)\s+/i, '');
    // Strip trailing DEBIT/CREDIT
    cleaned = cleaned.replace(/\s+(DEBIT|CREDIT)$/i, '');
    
    // Title case the result
    return cleaned
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const normalizeMerchant = (display) => {
    return display.toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const parseDateToISO = (dateStr) => {
    // Format 1: DD/MM/YYYY or DD-MM-YYYY
    let match = dateStr.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
    if (match) {
      let day = match[1].padStart(2, '0');
      let month = match[2].padStart(2, '0');
      let year = match[3];
      if (year.length === 2) {
        year = '20' + year;
      }
      return `${year}-${month}-${day}`;
    }

    // Format 2: DD-MMM-YYYY or DD/MMM/YYYY (e.g. 15-Dec-2025)
    match = dateStr.match(/^(\d{1,2})[/\-]([A-Za-z]{3,9})[/\-](\d{2,4})$/);
    if (match) {
      let day = match[1].padStart(2, '0');
      let monthStr = match[2].toLowerCase().slice(0, 3);
      let year = match[3];
      if (year.length === 2) {
        year = '20' + year;
      }
      const months = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      };
      let month = months[monthStr] || '01';
      return `${year}-${month}-${day}`;
    }

    // Format 3: DD MMM YYYY (e.g. 26 Jun 2026)
    match = dateStr.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
    if (match) {
      let day = match[1].padStart(2, '0');
      let monthStr = match[2].toLowerCase().slice(0, 3);
      let year = match[3];
      if (year.length === 2) {
        year = '20' + year;
      }
      const months = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      };
      let month = months[monthStr] || '01';
      return `${year}-${month}-${day}`;
    }

    // Fallback Date parser
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  };

  const parseTransactions = (text) => {
    const lines = text.split('\n');
    const parsed = [];
    
    // Pattern looking for date, description, amount, type (Dr/Cr)
    const regex = /(\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{1,2}[/\-][A-Za-z]{3,9}[/\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\s+(.+?)\s+(\d+(?:,\d+)*(?:\.\d+)?)\s*(Dr|Cr|debit|credit)/i;
    
    lines.forEach(line => {
      const match = line.match(regex);
      if (match) {
        const rawDate = match[1];
        const rawDesc = match[2];
        const rawAmount = match[3].replace(/,/g, '');
        const rawType = match[4].toLowerCase();
        
        const cleanDesc = cleanMerchant(rawDesc);
        const normalizedDesc = normalizeMerchant(cleanDesc);
        const parsedDate = parseDateToISO(rawDate);
        
        let type = 'debit';
        if (rawType === 'cr' || rawType === 'credit') {
          type = 'credit';
        }
        
        parsed.push({
          id: crypto.randomUUID(),
          date: parsedDate,
          description: rawDesc.trim(),
          merchant: cleanDesc,
          normalized: normalizedDesc,
          amount: parseFloat(rawAmount),
          type: type,
          category: 'Uncategorized'
        });
      }
    });
    
    return parsed;
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  const validateFile = (file) => {
    if (!file) return false;
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are accepted. Please upload a valid statement PDF.');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10MB.');
      return false;
    }
    setError('');
    return true;
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (validateFile(droppedFile)) {
        setFile(droppedFile);
      }
    }
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setError('');
    
    try {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
          }
          
          const parsed = parseTransactions(fullText);
          if (parsed.length === 0) {
            setError("Could not parse transactions from this PDF. Try a PhonePe or Google Pay statement.");
            setIsUploading(false);
            return;
          }

          setTransactionsFromParsed(parsed);
          setResult({
            extracted: parsed.length,
            added: parsed.length,
            duplicates: 0
          });
        } catch (err) {
          console.error("PDF Parsing error:", err);
          setError("Failed to parse PDF file. Ensure it is a valid, unencrypted statement: " + err.message);
          setIsUploading(false);
        }
      };
      fileReader.readAsArrayBuffer(file);
    } catch (err) {
      setError(err.message || 'An error occurred during file reading.');
      setIsUploading(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setResult(null);
    setError('');
  };

  if (result) {
    return (
      <div className="min-h-full bg-primary-bg pb-10">
        <TopNav 
          title="Upload Statement"
          meta="Session-based transaction ingestion"
        />
        <div className="px-6 lg:px-10 py-6">
          <div className="glass-panel p-5 sm:p-8 max-w-2xl mx-auto w-full animate-in fade-in zoom-in duration-300">
            <div className="flex items-center gap-4 mb-6 border-b border-[#22222E] pb-6">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <div>
                <h2 className="text-2xl font-syne font-bold text-success mb-1">Upload Successful!</h2>
                <p className="text-text-secondary">Your statement has been parsed locally in your browser.</p>
              </div>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between p-4 bg-secondary-bg rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📊</span>
                  <span className="text-text-primary font-medium">Transactions Found</span>
                </div>
                <span className="text-2xl font-bold">{result.extracted}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-success/10 rounded-xl border border-success/20">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">✨</span>
                  <span className="text-success font-medium">New Transactions Added</span>
                </div>
                <span className="text-2xl font-bold text-success">+{result.added}</span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={resetState} className="flex-1 btn-secondary">
                Upload Another
              </button>
              <button 
                onClick={() => navigate('/guest/merchants')} 
                className="flex-1 btn-primary text-center"
              >
                Continue to Merchant Mapping →
              </button>
            </div>
            <div className="mt-6 pt-4 border-t border-white/5 text-center">
              <p className="text-xs text-gray-400 mb-2">
                Parsed locally in Guest Mode. Log in to permanently save these transactions to your account.
              </p>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 underline"
              >
                Log In to Save Permanently →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const providerNames = {
    phonepe: 'PhonePe',
    gpay: 'Google Pay',
    paytm: 'Paytm',
    others: 'statement'
  };
  const providerName = providerNames[provider] || 'statement';

  return (
    <div className="min-h-full bg-primary-bg pb-10">
      <TopNav 
        title="Upload Statement"
        meta="Upload your statement PDF (PhonePe, Google Pay, Paytm, Others) parsed fully in-browser"
      />
      
      <div className="px-6 lg:px-10 py-6 flex justify-center">
        <div className="max-w-3xl mx-auto w-full space-y-6">
          {/* Guest Notice Banner */}
          <div className="bg-[#12121c] border border-purple-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="text-xl">📤</span>
              <div>
                <h4 className="text-sm font-semibold text-white">Client-Side Statement Preview (Guest Mode)</h4>
                <p className="text-xs text-gray-400">
                  Statements uploaded here are parsed strictly in your browser. Log in to permanently store your transactions in SpendX.
                </p>
              </div>
            </div>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="shrink-0 px-3.5 py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/30 rounded-xl transition-all"
            >
              Log In for Permanent Storage →
            </button>
          </div>

          <div 
            className={`glass-panel p-6 sm:p-10 border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center min-h-[400px] ${
              !provider ? 'border-border-light' :
              isDragging ? 'border-accent bg-accent/5' : 'border-border-light hover:border-text-muted'
            }`}
            onDragEnter={provider ? handleDrag : undefined}
            onDragLeave={provider ? handleDrag : undefined}
            onDragOver={provider ? handleDrag : undefined}
            onDrop={provider ? handleDrop : undefined}
          >
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              accept="application/pdf"
              onChange={handleFileSelect}
              disabled={!provider}
            />
            
            {!file ? (
              <>
                {/* Provider Selector inside dashed box */}
                <div className="w-full mb-10 border-b border-border pb-8">
                  <label className="block text-text-secondary text-[13px] font-medium mb-3 text-center sm:text-left">
                    Select statement provider
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'phonepe', name: 'PhonePe' },
                      { id: 'gpay', name: 'Google Pay' },
                      { id: 'paytm', name: 'Paytm' },
                      { id: 'others', name: 'Others' }
                    ].map((p) => {
                      const isSelected = provider === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProvider(p.id);
                          }}
                          className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200 text-center ${
                            isSelected
                              ? 'bg-accent border-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.25)] bg-[#6c63ff] border-[#6c63ff]'
                              : 'bg-[#0c0c14] border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20'
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Upload Zone Body */}
                <div className="w-20 h-20 rounded-full bg-[#111118] flex items-center justify-center mb-6 shadow-xl border border-white/5">
                  <UploadCloud className={`w-10 h-10 ${provider ? 'text-purple-400' : 'text-text-muted'}`} />
                </div>
                <h3 className={`text-2xl font-syne font-bold mb-3 text-center ${provider ? 'text-text-primary' : 'text-text-muted'}`}>
                  {!provider ? 'Select a provider first' : `Drag & drop your ${providerName} PDF`}
                </h3>
                <p className="text-text-muted mb-8 text-center max-w-sm">
                  {!provider 
                    ? 'Please choose a statement provider from the options above before uploading.' 
                    : `Upload your ${providerName} statement here. Only PDF files are supported.`}
                </p>
                
                <div className="flex items-center gap-4 w-full max-w-sm">
                  <div className="h-px bg-border flex-1"></div>
                  <span className="text-text-muted font-medium uppercase text-sm">or</span>
                  <div className="h-px bg-border flex-1"></div>
                </div>
                
                <label 
                  htmlFor={provider ? "file-upload" : undefined}
                  className={`mt-8 btn-secondary ${provider ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}`}
                >
                  Choose File
                </label>
              </>
            ) : (
              <div className="w-full max-w-md bg-secondary-bg border border-border rounded-xl p-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                  <File className="w-8 h-8 text-purple-400" />
                </div>
                <h4 className="font-medium text-text-primary mb-1 truncate w-full px-4">{file.name}</h4>
                <p className="text-sm text-text-muted mb-6">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                
                <div className="flex flex-col sm:flex-row w-full gap-3">
                  <button 
                    onClick={() => setFile(null)} 
                    className="w-full sm:flex-1 min-w-0 py-2 px-4 rounded-lg bg-card border border-border text-text-muted hover:text-text-primary transition-colors order-2 sm:order-1"
                    disabled={isUploading}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="w-full sm:flex-1 min-w-0 btn-primary flex items-center justify-center gap-2 order-1 sm:order-2 bg-[#6c63ff] hover:bg-[#5b54e0]"
                  >
                    {isUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : 'Parse Statement'}
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {error && (
            <div className="mt-6 flex items-start gap-3 p-4 bg-danger-bg border border-danger/20 rounded-xl text-danger animate-in fade-in slide-in-from-top-4">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm font-medium whitespace-pre-wrap">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DemoUpload;
