import React, { useState } from 'react';
import { AlertCircle, CheckCircle, Upload, Loader, AlertTriangle } from 'lucide-react';

function FraudDetectionInterface() {
  // Get backend URL from environment variable
  // IMPORTANT: For production (Amplify), you MUST use HTTPS to avoid mixed content errors
  // If your Elastic Beanstalk doesn't support HTTPS yet, see fraud-detection-backend/HTTPS_SETUP.md
  const API_BASE_URL = process.env.REACT_APP_API_URL;
  console.log('🔍 API_BASE_URL:', API_BASE_URL);

  const [endpointName, setEndpointName] = useState('fraud-detection-model-2025-11-07-18-43-51');
  const [awsRegion, setAwsRegion] = useState('us-east-1');
  const [inputMethod, setInputMethod] = useState('manual'); // 'manual' or 'csv'
  const [manualInput, setManualInput] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvRows, setCsvRows] = useState([]); // Store all CSV rows
  const [fileInputKey, setFileInputKey] = useState(0); // For resetting file input
  const [prediction, setPrediction] = useState(null);
  const [predictions, setPredictions] = useState([]); // Store multiple predictions for CSV
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sampleTransaction = `0.0,-1.359807,-0.072781,2.536347,1.378155,-0.338321,0.462388,0.239599,0.098698,0.363787,0.090794,-0.551600,-0.617801,-0.991390,-0.311169,1.468177,-0.470401,0.207971,0.025791,0.403993,0.251412,-0.018307,0.277838,-0.110474,0.066928,0.128539,-0.189115,0.133558,-0.021053,149.62`;

  const handlePredict = async () => {
    setLoading(true);
    setError('');
    setPrediction(null);

    try {
      // Parse the input
      const values = manualInput.trim().split(',').map(v => parseFloat(v.trim()));
      
      if (values.length !== 30) {
        throw new Error(`Expected 30 features, got ${values.length}. Please provide all features (Time, V1-V28, Amount)`);
      }

      if (values.some(isNaN)) {
        throw new Error('Invalid input: all values must be numbers');
      }

      // Call backend API
      const apiUrl = `${API_BASE_URL}/api/predict`;
      console.log('Calling API:', apiUrl);
      console.log('Endpoint name:', endpointName.trim());
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpointName: endpointName.trim(),
          features: values
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Prediction failed');
      }

      // Parse prediction result
      const predictionValue = Array.isArray(data.prediction) 
        ? data.prediction[0] 
        : data.prediction;
      
      // Log raw prediction value for debugging
      console.log('Raw prediction value:', predictionValue);
      
      // Convert prediction to binary (0 or 1)
      const result = predictionValue >= 0.5 ? 1 : 0;
      
      // Calculate confidence: if prediction is close to 0 or 1, confidence is high
      // If prediction is close to 0.5, confidence is low
      // Confidence = distance from 0.5, scaled to 0-1 range
      let confidence;
      if (predictionValue >= 0.5) {
        // For fraud predictions (>= 0.5), confidence increases as value approaches 1
        confidence = (predictionValue - 0.5) * 2; // Maps 0.5->0 to 1.0->1.0
      } else {
        // For legitimate predictions (< 0.5), confidence increases as value approaches 0
        confidence = (0.5 - predictionValue) * 2; // Maps 0.5->0 to 0.0->1.0
      }
      
      // Ensure confidence is between 0 and 1
      confidence = Math.max(0, Math.min(1, confidence));

      setPrediction({
        result: result,
        confidence: confidence,
        features: values,
        rawPrediction: predictionValue // Store raw value for debugging
      });

    } catch (err) {
      console.error('Prediction error:', err);
      const errorMessage = err.message || 'Failed to fetch';
      setError(`${errorMessage}. API URL: ${API_BASE_URL}. Check: 1) Backend is running, 2) REACT_APP_API_URL is set in Amplify, 3) CORS is configured.`);
    } finally {
      setLoading(false);
    }
  };

  const loadSample = () => {
    setManualInput(sampleTransaction);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setCsvFile(file);
      setCsvFileName(file.name);
      setError('');
      
      // Read and parse CSV file
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target.result;
          const lines = text.split('\n').filter(line => line.trim());
          
          if (lines.length === 0) {
            throw new Error('CSV file is empty');
          }
          
          // Check if first line is a header (contains non-numeric values)
          let startIndex = 0;
          const firstLineValues = lines[0].split(',').map(v => v.trim()).filter(v => v);
          
          // If first line has non-numeric values or wrong number of columns, it's likely a header
          const hasNonNumeric = firstLineValues.some(v => isNaN(parseFloat(v)));
          const wrongColumnCount = firstLineValues.length !== 30;
          
          if (hasNonNumeric || wrongColumnCount) {
            startIndex = 1; // Skip header row
            if (lines.length < 2) {
              throw new Error('CSV file only contains a header row. Please include data rows.');
            }
          }
          
          // Parse all data lines
          const dataRows = [];
          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            const values = line.split(',').map(v => v.trim()).filter(v => v);
            
            if (values.length !== 30) {
              throw new Error(`Row ${i + 1}: Expected 30 features, got ${values.length}. Please ensure CSV has exactly 30 columns (Time, V1-V28, Amount)`);
            }
            
            // Validate all values are numbers
            const parsedValues = values.map(v => parseFloat(v));
            if (parsedValues.some(isNaN)) {
              throw new Error(`Row ${i + 1}: Invalid CSV - all values must be numbers`);
            }
            
            dataRows.push(parsedValues);
          }
          
          if (dataRows.length === 0) {
            throw new Error('No valid data rows found in CSV file');
          }
          
          // Store all rows
          setCsvRows(dataRows);
          // Set first row for preview
          setManualInput(dataRows[0].join(','));
          
        } catch (err) {
          setError(err.message);
          setCsvFile(null);
          setCsvFileName('');
        }
      };
      reader.onerror = () => {
        setError('Error reading CSV file');
        setCsvFile(null);
        setCsvFileName('');
      };
      reader.readAsText(file);
    }
  };

  const handleCsvPredict = async () => {
    if (!csvFile || csvRows.length === 0) {
      setError('Please upload a CSV file first');
      return;
    }

    setLoading(true);
    setError('');
    setPrediction(null);
    setPredictions([]);

    try {
      const allPredictions = [];
      
      // Process each row
      for (let i = 0; i < csvRows.length; i++) {
        const features = csvRows[i];
        
        // Call backend API for each row
        const apiUrl = `${API_BASE_URL}/api/predict`;
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpointName: endpointName.trim(),
            features: features
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Row ${i + 1}: ${errorData.error || `Server error: ${response.status}`}`);
        }

        const data = await response.json();
        
        if (!data.success) {
          throw new Error(`Row ${i + 1}: ${data.error || 'Prediction failed'}`);
        }

        // Parse prediction result
        const predictionValue = Array.isArray(data.prediction) 
          ? data.prediction[0] 
          : data.prediction;
        
        // Log raw prediction value for debugging
        console.log(`Row ${i + 1} - Raw prediction value:`, predictionValue);
        
        // Convert prediction to binary (0 or 1)
        const result = predictionValue >= 0.5 ? 1 : 0;
        
        // Calculate confidence: if prediction is close to 0 or 1, confidence is high
        // If prediction is close to 0.5, confidence is low
        let confidence;
        if (predictionValue >= 0.5) {
          // For fraud predictions (>= 0.5), confidence increases as value approaches 1
          confidence = (predictionValue - 0.5) * 2; // Maps 0.5->0 to 1.0->1.0
        } else {
          // For legitimate predictions (< 0.5), confidence increases as value approaches 0
          confidence = (0.5 - predictionValue) * 2; // Maps 0.5->0 to 0.0->1.0
        }
        
        // Ensure confidence is between 0 and 1
        confidence = Math.max(0, Math.min(1, confidence));

        allPredictions.push({
          row: i + 1,
          result: result,
          confidence: confidence,
          features: features,
          predictionValue: predictionValue // Store raw value for debugging
        });
      }

      setPredictions(allPredictions);
      // Set first prediction for display compatibility
      if (allPredictions.length > 0) {
        setPrediction(allPredictions[0]);
      }

    } catch (err) {
      console.error('CSV prediction error:', err);
      const errorMessage = err.message || 'Failed to fetch';
      setError(`${errorMessage}. API URL: ${API_BASE_URL}. Check: 1) Backend is running, 2) REACT_APP_API_URL is set in Amplify, 3) CORS is configured.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="mb-8 pb-6 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Fraud Detection System</h1>
                <p className="text-sm text-gray-400 mt-1">AWS SageMaker ML Endpoint</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Endpoint Status</div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-white font-medium">Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 mb-6 p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Configuration</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Endpoint Name
              </label>
              <input
                type="text"
                value={endpointName}
                onChange={(e) => setEndpointName(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="fraud-detection-model-..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                AWS Region
              </label>
              <input
                type="text"
                value={awsRegion}
                onChange={(e) => setAwsRegion(e.target.value)}
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded text-white text-sm font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="us-east-1"
              />
            </div>
          </div>
        </div>

        {/* Input Panel */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 mb-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Transaction Input</h2>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setInputMethod('manual');
                  setCsvFile(null);
                  setCsvFileName('');
                  setCsvRows([]);
                  setPredictions([]);
                  setFileInputKey(prev => prev + 1);
                  setError('');
                }}
                className={`px-4 py-2 text-xs font-medium rounded transition-all ${
                  inputMethod === 'manual'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-750 hover:text-gray-300'
                }`}
              >
                Manual
              </button>
              <button
                onClick={() => {
                  setInputMethod('csv');
                  setManualInput('');
                  setCsvRows([]);
                  setPredictions([]);
                  setError('');
                }}
                className={`px-4 py-2 text-xs font-medium rounded transition-all ${
                  inputMethod === 'csv'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-750 hover:text-gray-300'
                }`}
              >
                CSV
              </button>
            </div>
          </div>

          {inputMethod === 'manual' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Transaction Features (30 values: Time, V1-V28, Amount)
              </label>
              <textarea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded text-white font-mono text-xs leading-relaxed focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                placeholder="0.0,-1.359807,-0.072781,2.536347,1.378155,..."
              />
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={loadSample}
                  className="px-4 py-2 text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700 rounded hover:bg-gray-750 hover:text-white transition-all"
                >
                  Load Sample
                </button>
                <button
                  onClick={handlePredict}
                  disabled={loading || !manualInput}
                  className="px-6 py-2 text-xs font-semibold bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      <span>Processing</span>
                    </>
                  ) : (
                    <>
                      <span>Analyze</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {inputMethod === 'csv' && (
            <div>
              <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center mb-4 bg-gray-800/50 hover:border-gray-600 transition-all">
                <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-300 text-sm mb-1 font-medium">Upload CSV File</p>
                <p className="text-xs text-gray-500 mb-4">30 columns required: Time, V1-V28, Amount</p>
                <label className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded transition-all cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <input
                    key={fileInputKey}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  Select File
                </label>
                {csvFileName && (
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-green-900/30 border border-green-700 rounded text-xs text-green-300 font-mono">
                    <CheckCircle className="w-4 h-4" />
                    {csvFileName}
                  </div>
                )}
              </div>
              {csvFile && csvRows.length > 0 && (
                <div className="mb-4 p-4 bg-gray-800 border border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Preview (Row 1 of {csvRows.length})
                    </label>
                    <span className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-[10px] text-gray-400 font-mono">
                      {csvRows.length} transactions
                    </span>
                  </div>
                  <textarea
                    value={manualInput}
                    readOnly
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-white font-mono text-xs"
                  />
                </div>
              )}
              <button
                onClick={handleCsvPredict}
                disabled={loading || !csvFile || csvRows.length === 0}
                className="w-full px-6 py-2.5 text-xs font-semibold bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Processing {csvRows.length} transactions...</span>
                  </>
                ) : (
                  <>
                    <span>Analyze All ({csvRows.length})</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-950/30 border border-red-800 rounded-lg p-4 mb-6 flex items-start gap-3">
            <div className="p-1.5 bg-red-900/50 rounded border border-red-700 flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-red-400 text-xs font-semibold uppercase tracking-wider mb-1.5">Error</h3>
              <p className="text-red-300/90 text-xs leading-relaxed font-mono">{error}</p>
            </div>
          </div>
        )}

        {/* Multiple Predictions Results (CSV) */}
        {predictions.length > 0 && inputMethod === 'csv' && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Results</h2>
                <span className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-400 font-mono">
                  {predictions.length} transactions
                </span>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-3 px-4 text-xs text-gray-500 font-medium uppercase tracking-wider">#</th>
                    <th className="text-left py-3 px-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Status</th>
                    <th className="text-left py-3 px-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Confidence</th>
                    <th className="text-left py-3 px-4 text-xs text-gray-500 font-medium uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((pred, idx) => (
                    <tr key={idx} className={`border-b border-gray-800 hover:bg-gray-800/50 transition-colors ${pred.result === 1 ? 'bg-red-950/10' : ''}`}>
                      <td className="py-3 px-4 text-gray-300 font-mono text-xs">{pred.row}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {pred.result === 1 ? (
                            <>
                              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                              <span className="text-red-400 text-xs font-medium">FRAUD</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-green-400 text-xs font-medium">LEGIT</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-300 font-mono text-xs">{(pred.confidence * 100).toFixed(1)}%</span>
                        <span className="text-gray-600 ml-2 font-mono text-[10px]">
                          ({typeof pred.predictionValue === 'number' ? pred.predictionValue.toFixed(4) : pred.predictionValue})
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300 font-mono text-xs">${pred.features[29].toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-800">
              <div className="grid grid-cols-4 gap-4 text-xs">
                <div>
                  <div className="text-gray-500 uppercase tracking-wide mb-1">Total</div>
                  <div className="text-white font-semibold">{predictions.length}</div>
                </div>
                <div>
                  <div className="text-gray-500 uppercase tracking-wide mb-1">Fraudulent</div>
                  <div className="text-red-400 font-semibold">{predictions.filter(p => p.result === 1).length}</div>
                </div>
                <div>
                  <div className="text-gray-500 uppercase tracking-wide mb-1">Legitimate</div>
                  <div className="text-green-400 font-semibold">{predictions.filter(p => p.result === 0).length}</div>
                </div>
                <div>
                  <div className="text-gray-500 uppercase tracking-wide mb-1">Avg Confidence</div>
                  <div className="text-white font-semibold">
                    {(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Single Prediction Results (Manual) */}
        {prediction && inputMethod === 'manual' && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 mb-6 p-6">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Result</h2>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {/* Result Card */}
              <div className={`p-4 rounded border ${
                prediction.result === 1
                  ? 'bg-red-950/20 border-red-800'
                  : 'bg-green-950/20 border-green-800'
              }`}>
                <div className="flex items-center gap-3">
                  {prediction.result === 1 ? (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  )}
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</div>
                    <div className={`text-lg font-semibold ${
                      prediction.result === 1 ? 'text-red-400' : 'text-green-400'
                    }`}>
                      {prediction.result === 1 ? 'FRAUDULENT' : 'LEGITIMATE'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Class: {prediction.result}</div>
                  </div>
                </div>
              </div>

              {/* Confidence Card */}
              <div className="p-4 rounded border border-gray-800 bg-gray-800">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Confidence</div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl font-semibold text-white">
                    {(prediction.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                {prediction.rawPrediction !== undefined && (
                  <div className="text-xs text-gray-600 font-mono mt-1">
                    Raw: {typeof prediction.rawPrediction === 'number' ? prediction.rawPrediction.toFixed(4) : prediction.rawPrediction}
                  </div>
                )}
                <div className="w-full bg-gray-700 rounded-full h-2 mt-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      prediction.result === 1 ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${prediction.confidence * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Feature Summary */}
            <div className="pt-4 border-t border-gray-800">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Transaction Details</div>
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <div className="text-gray-500 mb-1">Time</div>
                  <div className="text-white font-mono">{prediction.features[0].toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Amount</div>
                  <div className="text-white font-mono">${prediction.features[29].toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Features</div>
                  <div className="text-gray-400">28 PCA (V1-V28)</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info Panel */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">System Information</h3>
          <div className="grid md:grid-cols-2 gap-3 text-xs text-gray-500">
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 bg-gray-600 rounded-full mt-1.5"></div>
              <span>Connects to AWS SageMaker endpoint for real-time predictions</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 bg-gray-600 rounded-full mt-1.5"></div>
              <span>Requires exactly 30 features: Time, V1-V28 (PCA), Amount</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 bg-gray-600 rounded-full mt-1.5"></div>
              <span>Endpoint must be active in AWS Console</span>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-1 h-1 bg-gray-600 rounded-full mt-1.5"></div>
              <span>Terminate endpoint after use to minimize costs</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FraudDetectionInterface;