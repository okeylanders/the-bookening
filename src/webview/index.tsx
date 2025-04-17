import React, { useState, useEffect, FormEvent } from 'react';
import ReactDOM from 'react-dom';
import './index.css';

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
  examples: string[];
}

const App: React.FC = () => {
  const [word, setWord] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      console.log('Webview received message:', event.data);
      const msg = event.data;
      if (msg.type === 'results') {
        setResults(msg.data);
        setLoading(false);
        setError(null);
      }
      if (msg.type === 'error') {
        setError(msg.error);
        setLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!word.trim()) {
      return;
    }
    console.log('Webview sending lookup message:', word.trim());
    setLoading(true);
    setResults(null);
    setError(null);
    vscode.postMessage({ type: 'lookup', word: word.trim() });
  };

  return (
    <div className="p-4 font-sans text-gray-800">
      <form onSubmit={onSubmit} className="flex">
        <input
          type="text"
          value={word}
          onChange={e => setWord(e.target.value)}
          placeholder="Enter a word..."
          className="flex-grow p-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          className="px-4 bg-indigo-600 text-white rounded-r hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
        <div className="mt-6 space-y-6">
          <Section title="Definitions" items={results.definitions} />
          <Section title="Synonyms" items={results.synonyms} />
          <Section title="Antonyms" items={results.antonyms} />
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
