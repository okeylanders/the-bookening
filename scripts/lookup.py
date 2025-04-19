#!/usr/bin/env python3
import argparse
import json
import sys
import os
import subprocess
import difflib
# Attempt imports and check for errors
try:
    import nltk
    from nltk.corpus import wordnet as wn
    from nltk import data
    from tabulate import tabulate
except ImportError:
    print(json.dumps({"error": "missing_dependencies", "message": "Required Python packages (nltk, tabulate) are missing."}))
    sys.exit(1)

def ensure_wordnet():
    try:
        data.find('corpora/wordnet')
    except LookupError:
        nltk.download('wordnet', quiet=True, raise_on_error=True)

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

    # Additional WordNet info
    pos_tags = set()
    hypernyms = set()
    holonyms = set()
    meronyms = set()
    derivationally_related_forms = set()
    similar_tos = set()
    pertainyms = set()
    verb_frames = set()

    for syn in synsets:
        pos_tags.add(syn.pos())
        # Hypernyms
        for h in syn.hypernyms():
            for lemma in h.lemmas():
                hypernyms.add(lemma.name())
        # Holonyms
        for h in syn.member_holonyms() + syn.part_holonyms() + syn.substance_holonyms():
            for lemma in h.lemmas():
                holonyms.add(lemma.name())
        # Meronyms
        for m in syn.member_meronyms() + syn.part_meronyms() + syn.substance_meronyms():
            for lemma in m.lemmas():
                meronyms.add(lemma.name())
        # Derivationally related forms
        for lemma in syn.lemmas():
            synonyms.add(lemma.name())
            for anti in lemma.antonyms():
                antonyms.add(anti.name())
            for drf in lemma.derivationally_related_forms():
                derivationally_related_forms.add(drf.name())
            for pert in lemma.pertainyms():
                pertainyms.add(pert.name())
        # Hyponyms
        for hy in syn.hyponyms():
            for lemma in hy.lemmas():
                hyponyms.add(lemma.name())
        # Similar-to (for adjectives)
        for sim in syn.similar_tos():
            for lemma in sim.lemmas():
                similar_tos.add(lemma.name())
        # Verb frames
        for lemma in syn.lemmas():
            for frame in lemma.frame_strings():
                verb_frames.add(frame)
        examples.extend(syn.examples())

    result = {
        "definitions": definitions,
        "synonyms": sorted(list(synonyms)),
        "antonyms": sorted(list(antonyms)),
        "hyponyms": sorted(list(hyponyms)),
        "examples": examples,
        # Additional info
        "pos_tags": sorted(list(pos_tags)),
        "hypernyms": sorted(list(hypernyms)),
        "holonyms": sorted(list(holonyms)),
        "meronyms": sorted(list(meronyms)),
        "derivationally_related_forms": sorted(list(derivationally_related_forms)),
        "similar_tos": sorted(list(similar_tos)),
        "pertainyms": sorted(list(pertainyms)),
        "verb_frames": sorted(list(verb_frames)),
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

        print("\nPART OF SPEECH")
        print(tabulate([[p] for p in result["pos_tags"]], headers=["POS"], tablefmt="grid"))

        print("\nSYNONYMS")
        print(tabulate([[s] for s in result["synonyms"]], headers=["Synonym"], tablefmt="grid"))

        print("\nANTONYMS")
        print(tabulate([[a] for a in result["antonyms"]], headers=["Antonym"], tablefmt="grid"))

        print("\nHYPONYMS")
        print(tabulate([[h] for h in result["hyponyms"]], headers=["Hyponym"], tablefmt="grid"))

        print("\nHYPERNYMS")
        print(tabulate([[h] for h in result["hypernyms"]], headers=["Hypernym"], tablefmt="grid"))

        print("\nHOLONYMS")
        print(tabulate([[h] for h in result["holonyms"]], headers=["Holonym"], tablefmt="grid"))

        print("\nMERONYMS")
        print(tabulate([[m] for m in result["meronyms"]], headers=["Meronym"], tablefmt="grid"))

        print("\nDERIVATIONALLY RELATED FORMS")
        print(tabulate([[d] for d in result["derivationally_related_forms"]], headers=["Related Form"], tablefmt="grid"))

        print("\nSIMILAR TO")
        print(tabulate([[s] for s in result["similar_tos"]], headers=["Similar To"], tablefmt="grid"))

        print("\nPERTAINYMS")
        print(tabulate([[p] for p in result["pertainyms"]], headers=["Pertainym"], tablefmt="grid"))

        print("\nVERB FRAMES")
        print(tabulate([[v] for v in result["verb_frames"]], headers=["Verb Frame"], tablefmt="grid"))

        print("\nEXAMPLES")
        print(tabulate([(i+1, ex) for i, ex in enumerate(examples)], headers=["#","Example"], tablefmt="grid"))
        return

    print(json.dumps(result))

if __name__ == "__main__":
    main()
