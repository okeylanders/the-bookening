#!/usr/bin/env python3
import argparse
import json
import nltk
from nltk.corpus import wordnet as wn
from nltk import data

def ensure_wordnet():
    try:
        data.find('corpora/wordnet')
    except LookupError:
        nltk.download('wordnet', quiet=True)

def main():
    parser = argparse.ArgumentParser(description="Lookup definitions, synonyms, antonyms, and example sentences for a word.")
    parser.add_argument('--word', required=True, help="The word to lookup in WordNet")
    args = parser.parse_args()

    ensure_wordnet()
    synsets = wn.synsets(args.word)

    definitions = [syn.definition() for syn in synsets]
    synonyms = set()
    antonyms = set()
    examples = []

    for syn in synsets:
        for lemma in syn.lemmas():
            synonyms.add(lemma.name())
            for anti in lemma.antonyms():
                antonyms.add(anti.name())
        examples.extend(syn.examples())

    result = {
        "definitions": definitions,
        "synonyms": sorted(synonyms),
        "antonyms": sorted(antonyms),
        "examples": examples
    }

    print(json.dumps(result))

if __name__ == "__main__":
    main()
