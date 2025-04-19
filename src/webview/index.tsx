import React, { useState, useEffect, FormEvent, useCallback } from 'react';
import ReactDOM from 'react-dom';
import './index.css';

const debugging = false;

declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
  getState: () => any;
  setState: (state: any) => void;
};

let vscode: ReturnType<typeof acquireVsCodeApi>;
try {
  vscode = acquireVsCodeApi();
} catch (e) {
  console.error('Failed to acquire VS Code API', e);
  // Handle the error appropriately
}

interface Results {
  definitions: string[];
  synonyms: string[];
  antonyms: string[];
  hyponyms: string[];
  examples: string[];
  // Additional WordNet info
  pos_tags: string[];
  hypernyms: string[];
  holonyms: string[];
  meronyms: string[];
  derivationally_related_forms: string[];
  similar_tos: string[];
  pertainyms: string[];
  verb_frames: string[];
}

type ErrorType = 'python_missing' | 'missing_dependencies' | 'script_error' | 'parse_error' | 'no_results' | 'communication_error' | 'install_error' | null;

interface AppState {
  word: string;
  results: Results | null;
  loading: boolean;
  error: string | null;
  errorType: ErrorType;
  installStatus: 'idle' | 'installing' | 'success' | 'error';
  installMessage: string | null;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    try {
      const savedState = vscode.getState();
      return {
        word: savedState?.word || '',
        results: savedState?.results || null,
        loading: false, // Don't persist loading state
        error: savedState?.error || null,
        errorType: savedState?.errorType || null,
        installStatus: 'idle', // Don't persist install status
        installMessage: null,
      };
    } catch {
      return {
        word: '',
        results: null,
        loading: false,
        error: null,
        errorType: null,
        installStatus: 'idle',
        installMessage: null,
      };
    }
  });

  const { word, results, loading, error, errorType, installStatus, installMessage } = state;

  // Effect to save state (excluding transient states like loading/install)
  useEffect(() => {
    try {
      const stateToSave = { word, results, error, errorType };
      debugging && console.log('Saving state to VS Code:', stateToSave);
      vscode.setState(stateToSave);
    } catch (e) {
      debugging && console.error('Failed to set state in VS Code', e);
    }
  }, [word, results, error, errorType]);

  // Effect to handle messages from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      debugging && console.log('Webview received message:', event.data);
      const msg = event.data;

      setState(prevState => {
        switch (msg.type) {
          case 'results':
            return { ...prevState, loading: false, results: msg.data, error: null, errorType: null, installStatus: 'idle' };
          case 'error':
            const specificErrorType = msg.error_type || 'script_error'; 
            return { ...prevState, loading: false, results: null, error: msg.message || msg.error, errorType: specificErrorType, installStatus: 'idle' };
          case 'word':
            // Only set loading if it's a new word lookup, not just state restoration
            return { ...prevState, loading: true, results: null, error: null, errorType: null, word: msg.word, installStatus: 'idle' };
          case 'install_status':
            return { ...prevState, loading: false, installStatus: msg.status, installMessage: msg.message, error: msg.status === 'error' ? msg.message : null, errorType: msg.status === 'error' ? 'install_error' : prevState.errorType };
          default:
            return prevState;
        }
      });
    };
    window.addEventListener('message', handleMessage);

    // Request python check on initial load
    try {
      vscode.postMessage({ type: 'check_python' });
    } catch (e) {
      debugging && console.error('Failed to post check_python message', e);
      setState(prev => ({ ...prev, error: 'Failed to communicate with extension on startup.', errorType: 'communication_error' }));
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const performLookup = useCallback((lookupWord: string) => {
    const trimmedWord = lookupWord.trim();
    if (!trimmedWord) {
      return;
    }
    debugging && console.log('Webview sending lookup message:', trimmedWord);

    setState(prev => ({ ...prev, loading: true, results: null, error: null, errorType: null, word: trimmedWord, installStatus: 'idle', installMessage: null }));
    try {
      vscode.postMessage({ type: 'lookup', word: trimmedWord });
    } catch (e) {
      debugging && console.error('Failed to post message to VS Code', e);
      setState(prev => ({ ...prev, error: 'Failed to communicate with the extension.', errorType: 'communication_error', loading: false }));
    }
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    performLookup(word);
  };

  const handleWordClick = (clickedWord: string) => {
    performLookup(clickedWord);
  };

  const handleInstallDeps = () => {
    setState(prev => ({ ...prev, installStatus: 'installing', installMessage: 'Initiating installation...' }));
    try {
      vscode.postMessage({ type: 'install_dependencies' });
    } catch (e) {
      debugging && console.error('Failed to post install_dependencies message', e);
      setState(prev => ({ ...prev, installStatus: 'error', installMessage: 'Failed to send install request to extension.', errorType: 'communication_error' }));
    }
  };


  const renderStatusMessage = () => {
    if (installStatus === 'installing') {
      return <div className="success-panel w-full"><p>{installMessage || 'Installing...'}</p></div>;
    }

    if (installStatus === 'success') {
      return <div className="success-panel w-full"><p>{installMessage || 'Success!'}</p></div>;
    }

    // Handle error states (installStatus is 'idle' or 'error' here)
    if (errorType === 'python_missing') {
      return <div className="error-panel w-full"><p>Error: {error}</p></div>;
    }

    if (errorType === 'missing_dependencies' || errorType === 'install_error') {
      return (
        <div className="p-0 space-y-2">
          <div 
            className='error-panel'
          >
            <p>Error: {error}</p>
          </div>
          <button
            onClick={handleInstallDeps}
            className="primary-button w-full text-center"
          >
            {'Install Dependencies'}
          </button>
        </div>
      );
    }

    if (error) { // Catches script_error, parse_error, no_results, communication_error, etc.
      return <div className="error-panel w-full"><p>Error: {error}</p></div>;
    }

    return null;
  };

  return (
    <div className="p-0 font-sans flex flex-col h-screen">
      <form onSubmit={onSubmit} className="flex p-0 w-full flex-shrink-0 mb-2">
        <input
          type="text"
          value={word}
          onChange={(e) => setState(prev => ({ ...prev, word: e.target.value }))}
          placeholder="Enter a word..."
          className="flex-grow"
          disabled={installStatus === 'installing'}
        />
        <button
          type="submit"
          className="primary-button disabled:opacity-50"
          disabled={loading || installStatus === 'installing'}
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      <hr className='mb-4'/>

      <div className="flex-grow relative overflow-y-auto pb-8">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: 'var(--vscode-editor-background)' }}>
            <p style={{ color: 'var(--vscode-editor-foreground)' }}>Loading...</p>
          </div>
        )}

        {renderStatusMessage()}

        {!loading && !errorType && results && (
          <div className="p-0 space-y-6">
            <Section title="Definitions" items={results.definitions} />
            <Section title="Part of Speech" items={results.pos_tags} />
            <Section title="Synonyms" items={results.synonyms} onWordClick={handleWordClick} />
            <Section title="Antonyms" items={results.antonyms} onWordClick={handleWordClick} />
            <Section title="Hyponyms" items={results.hyponyms} onWordClick={handleWordClick} />
            <Section title="Hypernyms" items={results.hypernyms} onWordClick={handleWordClick} />
            <Section title="Holonyms" items={results.holonyms} onWordClick={handleWordClick} />
            <Section title="Meronyms" items={results.meronyms} onWordClick={handleWordClick} />
            <Section title="Derivationally Related Forms" items={results.derivationally_related_forms} onWordClick={handleWordClick} />
            <Section title="Similar To" items={results.similar_tos} onWordClick={handleWordClick} />
            <Section title="Pertainyms" items={results.pertainyms} onWordClick={handleWordClick} />
            <Section title="Verb Frames" items={results.verb_frames} />
            <Section title="Examples" items={results.examples} />
          </div>
        )}
      </div>
    </div>
  );
};

interface SectionProps {
  title: string;
  items: string[];
  onWordClick?: (word: string) => void;
}

const Section: React.FC<SectionProps> = ({ title, items, onWordClick }) => {
  if (!items || items.length === 0) {
    return null;
  }

  const isMultiColumn = ['Synonyms', 'Antonyms', 'Hyponyms','Hypernyms','Holonyms','Meronyms','Similar To','Pertainyms','Derivationally Related Forms'].includes(title);
  const allowWordClick = isMultiColumn && onWordClick;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <ul
        className={isMultiColumn
          ? "grid grid-cols-2 gap-x-4 gap-y-1"
          : "list-disc pl-5 space-y-1"
        }
      >
        {items.map((item, i) => (
          <li key={i} className="break-words">
            {allowWordClick ? (
              <button
                onClick={() => onWordClick(item)}
                className="text-left hover:underline focus:underline focus:outline-none"
                style={{ color: 'var(--vscode-textLink-foreground)' }}
              >
                {item}
              </button>
            ) : (
              item
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
