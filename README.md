# The Bookening: Dictionary

![Demo](https://raw.githubusercontent.com/okeylanders/the-bookening/main/assets/dictionary-run-through.gif)

**The Bookening: Dictionary** is a VS Code extension that lets you instantly look up definitions, synonyms, antonyms, and hyponyms using [NLTK WordNet](https://www.nltk.org/howto/wordnet.html). Access the dictionary via the sidebar search box or by selecting text and choosing the context menu command.

## Features

- Lookup definitions, synonyms, antonyms, and hyponyms
- Use the sidebar search or right-click selected text in the editor
- Fast, offline operation after initial setup (no further web requests)
- Clean React UI styled with Tailwind CSS

## Prerequisites

- **Python 3** (with [pip](https://pip.pypa.io/en/stable/))  
  (Most Python 3 installations include pip by default. [Check here if unsure.](https://pip.pypa.io/en/stable/installation/))
- [NLTK](https://www.nltk.org/) Python package
- [Tabulate](https://pypi.org/project/tabulate/) Python package

> The extension will check for required Python dependencies on first use. If NLTK or Tabulate are missing, you’ll be prompted to install them automatically—no manual setup required.

## License

MIT