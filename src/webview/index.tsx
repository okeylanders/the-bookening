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
}

const App: React.FC = () => {
  const [word, setWord] = useState(() => {
    try {
      return vscode.getState()?.word || '';
    } catch {
      return '';
    }
  });
  const [results, setResults] = useState<Results | null>(() => {
    try {
      return vscode.getState()?.results || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    try {
      return vscode.getState()?.error || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      debugging && console.log('Saving state to VS Code:', { word, results, error });
      vscode.setState({ word, results, error });
    } catch (e) {
      debugging && console.error('Failed to set state in VS Code', e);
    }
  }, [word, results, error]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      debugging && console.log('Webview received message:', event.data);
      const msg = event.data;
      setLoading(false);
      if (msg.type === 'results') {
        setResults(msg.data);
        setError(null);
      }
      else if (msg.type === 'error') {
        setError(msg.error);
        setResults(null);
      }
      else if (msg.type === 'word') {
        setLoading(true);
        setResults(null);
        setWord(msg.word);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const performLookup = useCallback((lookupWord: string) => {
    const trimmedWord = lookupWord.trim();
    if (!trimmedWord) {
      return;
    }
    debugging && console.log('Webview sending lookup message:', trimmedWord);
    setLoading(true);
    setResults(null);
    setError(null);
    setWord(trimmedWord);
    try {
      vscode.postMessage({ type: 'lookup', word: trimmedWord });
    } catch (e) {
      debugging && console.error('Failed to post message to VS Code', e);
      setError('Failed to communicate with the extension.');
      setLoading(false);
    }
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    performLookup(word);
  };

  const handleWordClick = (clickedWord: string) => {
    performLookup(clickedWord);
  };

  return (
    // Use flex column layout for the whole app, make it fill the viewport height
    <div className="p-0 font-sans flex flex-col h-screen">
      {/* Search form remains at the top */}
      <form onSubmit={onSubmit} className="flex text-black p-0 w-full flex-shrink-0">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Enter a word..."
          className="flex-grow p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          className="px-4 bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Container for content below the search bar, takes remaining space */}
      <div className="flex-grow relative overflow-y-auto"> {/* Added relative positioning and overflow */}
        {/* Loading indicator: positioned absolutely to cover this container */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-opacity-75 z-10" style={{ backgroundColor: 'var(--vscode-editor-background)' }}> {/* Use theme background */}
            <p style={{ color: 'var(--vscode-editor-foreground)' }}>Loading...</p> {/* Use theme foreground */}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-4 text-red-600"> {/* Added padding */}
            Error: {error}
          </div>
        )}

        {/* Results display: Only rendered when not loading and results exist */}
        {!loading && results && (
          <div className="p-4 space-y-6"> {/* Removed mt-6, padding handled by parent */}
            <Section title="Definitions" items={results.definitions} />
            <Section title="Synonyms" items={results.synonyms} onWordClick={handleWordClick} />
            <Section title="Antonyms" items={results.antonyms} onWordClick={handleWordClick} />
            <Section title="Hyponyms" items={results.hyponyms} onWordClick={handleWordClick} />
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

  const isMultiColumn = ['Synonyms', 'Antonyms', 'Hyponyms'].includes(title);
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
