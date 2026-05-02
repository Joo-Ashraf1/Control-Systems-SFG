import itertools
import sympy
from typing import Any


def find_non_touching_loops(loops: list) -> dict:
    non_touching_loops: dict = {}

    for i in range(2, len(loops) + 1):
        n_non_touching_loops = []
        all_combos = itertools.combinations(loops, i)

        for combo in all_combos:
            if is_valid_combination(combo):
                n_non_touching_loops.append(combo)

        if not n_non_touching_loops:
            break
        non_touching_loops[i] = n_non_touching_loops

    return non_touching_loops


def is_valid_combination(combo: tuple) -> bool:
    pairs = itertools.combinations(combo, 2)
    for loop1, loop2 in pairs:
        if loops_touch(loop1, loop2):
            return False
    return True


def compute_delta(loops: list, non_touching_loops: dict) -> str:
    delta = "1"
    for loop in loops:
        delta += f" - ({loop['gain']})"

    for size, combos in non_touching_loops.items():
        sign = " + " if pow(-1, size) == 1 else " - "

        for combo in combos:
            combined_gain = "*".join([loop['gain'] for loop in combo])
            delta += f"{sign}({combined_gain})"

    try:
        parsed_math = sympy.simplify(delta)
        clean_delta = str(parsed_math)
        return clean_delta
    except Exception as e:
        return delta


def compute_delta_k(forward_paths: list, loops: list) -> list[Any] :
    delta_k = []

    for path in forward_paths:
        not_touch_path = []
        for loop in loops:
            if not loops_touch_path(loop, path):
                not_touch_path.append(loop)

        non_touching_loops = find_non_touching_loops(not_touch_path)
        delta_k.append(compute_delta(not_touch_path, non_touching_loops))

    return delta_k


def loops_touch(loop1: dict, loop2: dict) -> bool:
    nodes1 = set(loop1["nodesPath"])
    nodes2 = set(loop2["nodesPath"])
    return len(nodes1 & nodes2) > 0


def loops_touch_path(loop: dict, path: dict) -> bool:
    nodes1 = set(loop["nodesPath"])
    nodes2 = set(path["nodesPath"])
    return len(nodes1 & nodes2) > 0


def mason_rule(forward_paths : list , delta : str , delta_k : list )  -> str :
    if( len(forward_paths) == 0 ) : return "0"

    num = []
    for i , path in enumerate(forward_paths):
        gain = path["gain"]
        if delta_k[i] != "1" : gain += f" * ({delta_k[i]})"
        num.append(gain)

    numerator = " + ".join(num)
    denumerator = delta

    simplified = sympy.simplify(f"({numerator}) / ({denumerator})")

    return str(simplified)