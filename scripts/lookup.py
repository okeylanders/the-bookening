#!/usr/bin/env python3
import argparse
import json
import sys
import nltk
import os
import subprocess
import difflib
from nltk.corpus import wordnet as wn
from nltk import data

# try import tabulate, else install requirements.txt and retry
try:
    from tabulate import tabulate
except ImportError:
    # install into the same Python where this script is running
    req = os.path.join(os.path.dirname(__file__), 'requirements.txt')
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', req], check=True)
    from tabulate import tabulate

def ensure_wordnet():
    try:
        data.find('corpora/wordnet')
    except LookupError:
        nltk.download('wordnet', quiet=True)

def main():
    parser = argparse.ArgumentParser(description="Lookup definitions, synonyms, antonyms, hyponyms, and example sentences for a word.")
    parser.add_argument('--word', required=True, help="The word to lookup in WordNet")
    parser.add_argument('--formatted', '-f', action='store_true', help="Print output in pretty tables (requires tabulate)")
    args = parser.parse_args()

    ensure_wordnet()
    synsets = wn.synsets(args.word)

    # suggest close matches if no synsets found
    if not synsets:
        suggestions = difflib.get_close_matches(args.word, wn.all_lemma_names(), n=5, cutoff=0.8)
        if suggestions:
            print(f"No entries found for '{args.word}'. Did you mean: {', '.join(suggestions)}?")
        else:
            print(f"No entries found for '{args.word}'.")
        sys.exit(1)

    definitions = [syn.definition() for syn in synsets]
    synonyms = set()
    antonyms = set()
    examples = []
    hyponyms = set()

    for syn in synsets:
        for lemma in syn.lemmas():
            synonyms.add(lemma.name())
            for anti in lemma.antonyms():
                antonyms.add(anti.name())
        # collect hyponyms
        for hy in syn.hyponyms():
            for lemma in hy.lemmas():
                hyponyms.add(lemma.name())
        examples.extend(syn.examples())

    result = {
        "definitions": definitions,
        "synonyms": sorted(synonyms),
        "antonyms": sorted(antonyms),
        "hyponyms": sorted(hyponyms),
        "examples": examples
    }

    if args.formatted:
        if tabulate is None:
            print(
                "Error: formatted output requires the 'tabulate' package.\n"
                "Install with: pip install tabulate",
                file=sys.stderr
            )
            sys.exit(1)

        # pretty-print each section as tables
        print("\nDEFINITIONS")
        print(tabulate([(i+1, d) for i, d in enumerate(definitions)], headers=["#","Definition"], tablefmt="grid"))

        print("\nSYNONYMS")
        print(tabulate([[s] for s in result["synonyms"]], headers=["Synonym"], tablefmt="grid"))

        print("\nANTONYMS")
        print(tabulate([[a] for a in result["antonyms"]], headers=["Antonym"], tablefmt="grid"))

        print("\nHYPONYMS")
        print(tabulate([[h] for h in result["hyponyms"]], headers=["Hyponym"], tablefmt="grid"))

        print("\nEXAMPLES")
        print(tabulate([(i+1, ex) for i, ex in enumerate(examples)], headers=["#","Example"], tablefmt="grid"))
        return

    print(json.dumps(result))

if __name__ == "__main__":
    main()
