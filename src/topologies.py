"""Independent Python graph fixture for cross-language validation."""
import numpy as np

def make_topology(name, *, side):
    if name != "grid":
        raise ValueError("The Python fixture supports grid. The batch engine supports eight families.")
    n = side * side
    adj = np.zeros((n, n), dtype=bool)
    for i in range(n):
        if i % side:
            adj[i, i-1] = adj[i-1, i] = True
        if i >= side:
            adj[i, i-side] = adj[i-side, i] = True
    return adj, {"n": n, "side": side, "actual_mean_degree": adj.sum()/n if n else 0}

