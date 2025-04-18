import React, { useState, useEffect, FormEvent } from 'react';
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
  // Initialize state from vscode.getState() or defaults
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
  const [loading, setLoading] = useState(false); // Typically don't persist loading state
  const [error, setError] = useState<string | null>(() => {
    try {
      return vscode.getState()?.error || null;
    } catch {
      return null;
    }
  });

  // Effect to save state whenever relevant variables change
  useEffect(() => {
    try {
      debugging && console.log('Saving state to VS Code:', { word, results, error });
      vscode.setState({ word, results, error });
      // Note: We generally don't save 'loading' state
    } catch (e) {
      debugging && console.error('Failed to set state in VS Code', e);
    }
  }, [word, results, error]); // Dependency array ensures this runs when state changes

  // Effect to handle messages from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      debugging && console.log('Webview received message:', event.data);
      const msg = event.data;
      setLoading(false); // Always stop loading when a response arrives
      if (msg.type === 'results') {
        setResults(msg.data);
        setError(null); // Clear previous error on success
      }
      if (msg.type === 'error') {
        setError(msg.error);
        setResults(null); // Clear previous results on error
      }
      // State saving is handled by the other useEffect
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []); // Empty dependency array: runs only once on mount

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedWord = word.trim();
    if (!trimmedWord) {
      return;
    }
    debugging && console.log('Webview sending lookup message:', trimmedWord);
    setLoading(true);
    // Clear previous results/error immediately for better UX
    setResults(null);
    setError(null);
    vscode.postMessage({ type: 'lookup', word: trimmedWord });
  };

  return (
    <div className="p-0 font-sans">
      <form onSubmit={onSubmit} className="flex text-black p-0 w-full">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)} // Directly update state
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

      {error && (
        <div className="mt-4 text-red-600">
          Error: {error}
        </div>
      )}

      {results && (
        <div className="p-4 mt-6 space-y-6 text-white">
          <Section title="Definitions" items={results.definitions} />
          <Section title="Synonyms" items={results.synonyms} />
          <Section title="Antonyms" items={results.antonyms} />
          <Section title="Hyponyms" items={results.hyponyms} />
          <Section title="Examples" items={results.examples} />
        </div>
      )}
    </div>
  );
};

interface SectionProps {
  title: string;
  items: string[];
}

const Section: React.FC<SectionProps> = ({ title, items }) => {
  if (!items || items.length === 0) {
    return null;
  }
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <ul className="list-disc pl-5 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="break-words">{item}</li>
        ))}
      </ul>
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
