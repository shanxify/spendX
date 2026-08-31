import React, { useCallback, useState } from 'react';
import { UploadCloud, File, X, CheckCircle, AlertCircle } from 'lucide-react';

const UploadZone = ({ onUploadSuccess }) => {
  const [provider, setProvider] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState(null);

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
      const data = await onUploadSuccess(file, provider);
      setResult(data);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || 'An error occurred during upload.';
      setError(errMsg);
    } finally {
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
      <div className="glass-panel p-5 sm:p-8 max-w-2xl mx-auto w-full animate-in fade-in zoom-in duration-300">
        <div className="flex items-center gap-4 mb-6 border-b border-border pb-6">
          <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <div>
            <h2 className="text-2xl font-syne font-bold text-success mb-1">Upload Successful!</h2>
            <p className="text-text-secondary">Your statement has been parsed and processed.</p>
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
          <div className="flex items-center justify-between p-4 bg-success-bg rounded-xl border border-success/20">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✨</span>
              <span className="text-success font-medium">New Transactions Added</span>
            </div>
            <span className="text-2xl font-bold text-success">+{result.added}</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-secondary-bg rounded-xl border border-border">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔄</span>
              <span className="text-text-muted font-medium">Duplicates Skipped</span>
            </div>
            <span className="text-lg font-medium text-text-muted">{result.duplicates}</span>
          </div>
        </div>
        
        <div className="flex gap-4">
          <button onClick={resetState} className="flex-1 btn-secondary">
            Upload Another
          </button>
          <a href="/" className="flex-1 btn-primary text-center">
            View Dashboard →
          </a>
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
    <div className="max-w-3xl mx-auto w-full">
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
            {/* Merged Provider Selector inside dashed box */}
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
                          ? 'bg-accent border-accent text-white shadow-[0_0_15px_rgba(124,58,237,0.25)]'
                          : 'bg-[#0c0c14] border-white/10 text-text-secondary hover:text-text-primary hover:border-white/20'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic upload body */}
            <div className="w-20 h-20 rounded-full bg-secondary-bg flex items-center justify-center mb-6 shadow-xl">
              <UploadCloud className={`w-10 h-10 ${provider ? 'text-accent' : 'text-text-muted'}`} />
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
              <File className="w-8 h-8 text-accent" />
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
                className="w-full sm:flex-1 min-w-0 btn-primary flex items-center justify-center gap-2 order-1 sm:order-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : 'Upload File'}
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
  );
};

export default UploadZone;
