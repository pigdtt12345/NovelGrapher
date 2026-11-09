"""
Dummy data standing in for a real database.

Each novel has:
  - a chapter range the slider will move across
  - a fixed cast of `characters` (graph nodes)
  - a list of `relationship_events`: dated changes to a relationship
    between two characters (graph edges). For any given chapter, the
    *current* state of a relationship is whichever event for that pair
    has the highest chapter number that is still <= the requested chapter.
    That's what lets "married" flip to "divorced" partway through.

`type` is either "bond" or "rupture" — that's the only value the frontend
uses to choose an edge color. `label` carries the human-readable detail
("married", "estranged", etc.) shown in the UI.

Replace this whole module with real queries once there's an actual model
behind it; nothing in views.py needs to change beyond that.
"""

NOVELS = {
    'pride': {
        'title': 'Pride and Prejudice',
        'author': 'Jane Austen',
        'year': 1813,
        'min_chapter': 1,
        'max_chapter': 61,
        'characters': [
            {'id': 'elizabeth', 'name': 'Elizabeth Bennet', 'role': 'Protagonist'},
            {'id': 'darcy', 'name': 'Mr. Darcy', 'role': 'Love interest'},
            {'id': 'jane', 'name': 'Jane Bennet', 'role': "Elizabeth's sister"},
            {'id': 'bingley', 'name': 'Mr. Bingley', 'role': "Darcy's friend"},
            {'id': 'wickham', 'name': 'Mr. Wickham', 'role': 'Militia officer'},
            {'id': 'lydia', 'name': 'Lydia Bennet', 'role': "Elizabeth's sister"},
            {'id': 'charlotte', 'name': 'Charlotte Lucas', 'role': "Elizabeth's friend"},
            {'id': 'collins', 'name': 'Mr. Collins', 'role': 'Clergyman'},
        ],
        'relationship_events': [
            {'chapter': 1, 'source': 'elizabeth', 'target': 'jane', 'type': 'bond', 'label': 'sisters'},
            {'chapter': 3, 'source': 'elizabeth', 'target': 'darcy', 'type': 'rupture', 'label': 'mutual dislike'},
            {'chapter': 4, 'source': 'jane', 'target': 'bingley', 'type': 'bond', 'label': 'acquainted'},
            {'chapter': 15, 'source': 'elizabeth', 'target': 'wickham', 'type': 'bond', 'label': 'charmed'},
            {'chapter': 21, 'source': 'jane', 'target': 'bingley', 'type': 'rupture', 'label': 'he leaves for London'},
            {'chapter': 22, 'source': 'charlotte', 'target': 'collins', 'type': 'bond', 'label': 'married'},
            {'chapter': 36, 'source': 'elizabeth', 'target': 'wickham', 'type': 'rupture', 'label': "his true character revealed"},
            {'chapter': 46, 'source': 'lydia', 'target': 'wickham', 'type': 'rupture', 'label': 'scandalous elopement'},
            {'chapter': 49, 'source': 'lydia', 'target': 'wickham', 'type': 'bond', 'label': 'married'},
            {'chapter': 55, 'source': 'jane', 'target': 'bingley', 'type': 'bond', 'label': 'reunited, engaged'},
            {'chapter': 58, 'source': 'elizabeth', 'target': 'darcy', 'type': 'bond', 'label': 'engaged'},
        ],
    },
    'anna': {
        'title': 'Anna Karenina',
        'author': 'Leo Tolstoy',
        'year': 1878,
        'min_chapter': 1,
        'max_chapter': 34,
        'characters': [
            {'id': 'anna', 'name': 'Anna Karenina', 'role': 'Protagonist'},
            {'id': 'karenin', 'name': 'Alexei Karenin', 'role': "Anna's husband"},
            {'id': 'vronsky', 'name': 'Count Vronsky', 'role': "Anna's lover"},
            {'id': 'kitty', 'name': 'Kitty Shcherbatskaya', 'role': "Dolly's sister"},
            {'id': 'levin', 'name': 'Konstantin Levin', 'role': 'Landowner'},
            {'id': 'dolly', 'name': 'Dolly Oblonskaya', 'role': "Stiva's wife"},
            {'id': 'stiva', 'name': 'Stiva Oblonsky', 'role': "Anna's brother"},
        ],
        'relationship_events': [
            {'chapter': 1, 'source': 'anna', 'target': 'karenin', 'type': 'bond', 'label': 'married'},
            {'chapter': 1, 'source': 'dolly', 'target': 'stiva', 'type': 'rupture', 'label': 'infidelity discovered'},
            {'chapter': 2, 'source': 'dolly', 'target': 'stiva', 'type': 'bond', 'label': 'reconciled'},
            {'chapter': 3, 'source': 'kitty', 'target': 'vronsky', 'type': 'bond', 'label': 'courtship'},
            {'chapter': 3, 'source': 'kitty', 'target': 'levin', 'type': 'rupture', 'label': 'spurned proposal'},
            {'chapter': 5, 'source': 'anna', 'target': 'vronsky', 'type': 'bond', 'label': 'drawn to each other'},
            {'chapter': 7, 'source': 'kitty', 'target': 'vronsky', 'type': 'rupture', 'label': 'he chooses Anna'},
            {'chapter': 16, 'source': 'kitty', 'target': 'levin', 'type': 'bond', 'label': 'married'},
            {'chapter': 20, 'source': 'anna', 'target': 'karenin', 'type': 'rupture', 'label': 'affair exposed'},
            {'chapter': 26, 'source': 'anna', 'target': 'vronsky', 'type': 'bond', 'label': 'living together'},
            {'chapter': 34, 'source': 'anna', 'target': 'vronsky', 'type': 'rupture', 'label': 'estranged, jealous rages'},
        ],
    },
    'solitude': {
        'title': 'One Hundred Years of Solitude',
        'author': 'Gabriel García Márquez',
        'year': 1967,
        'min_chapter': 1,
        'max_chapter': 20,
        'characters': [
            {'id': 'jose_arcadio', 'name': 'José Arcadio Buendía', 'role': 'Patriarch'},
            {'id': 'ursula', 'name': 'Úrsula Iguarán', 'role': 'Matriarch'},
            {'id': 'aureliano', 'name': 'Colonel Aureliano Buendía', 'role': 'Their son'},
            {'id': 'rebeca', 'name': 'Rebeca', 'role': 'Adopted daughter'},
            {'id': 'amaranta', 'name': 'Amaranta', 'role': 'Their daughter'},
            {'id': 'pilar', 'name': 'Pilar Ternera', 'role': 'Fortune teller'},
        ],
        'relationship_events': [
            {'chapter': 1, 'source': 'jose_arcadio', 'target': 'ursula', 'type': 'bond', 'label': 'married'},
            {'chapter': 1, 'source': 'aureliano', 'target': 'ursula', 'type': 'bond', 'label': 'mother and son'},
            {'chapter': 3, 'source': 'aureliano', 'target': 'pilar', 'type': 'bond', 'label': 'affair'},
            {'chapter': 4, 'source': 'rebeca', 'target': 'amaranta', 'type': 'rupture', 'label': 'rivalry over a suitor'},
            {'chapter': 6, 'source': 'aureliano', 'target': 'pilar', 'type': 'rupture', 'label': 'he abandons her'},
            {'chapter': 9, 'source': 'rebeca', 'target': 'amaranta', 'type': 'rupture', 'label': 'estranged for years'},
        ],
    },
}