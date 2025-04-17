# Dictionary VSCode Extension

Lookup definitions, synonyms, antonyms, and example sentences via NLTK WordNet in a side‑panel React UI powered by Tailwind CSS.

## Prerequisites

- **Node.js** (v12+)
- **Python 3** (with pip)
- **NLTK** Python package

## Installation

1. Clone or copy this extension into your VS Code extensions folder or your project directory.
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Install Python requirements and WordNet corpus:
   ```bash
   pip install nltk
   python3 - <<EOF
   import nltk
   nltk.download('wordnet')
   EOF
   ```

## Development

- **Build & watch**  
  ```bash
  npm run watch
  ```
- **Compile for release**  
  ```bash
  npm run build
  ```
- **Package**  
  ```bash
  npm install -g vsce
  vsce package
  ```
  This produces a `.vsix` file you can install in VS Code.

## Usage

1. In VS Code, open the **Extensions** view and install the generated `.vsix` package.
2. Reload VS Code.
3. Open the **Dictionary** panel in the sidebar.
4. Enter any word into the search bar and press **Search**.
5. View Definitions, Synonyms, Antonyms, and Example Sentences in the panel.

## Troubleshooting

- If you see errors about missing corpus, ensure WordNet is downloaded:
  ```bash
  python3 - <<EOF
  import nltk
  nltk.download('wordnet')
  EOF
  ```
- Make sure the Python executable `python3` is available on your PATH.

## License

MIT
