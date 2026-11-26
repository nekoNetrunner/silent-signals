def greedy_mis(adj):
    chosen = set()
    for node in sorted(range(len(adj)), key=lambda i:(sum(adj[i]), i)):
        if all(not adj[node,j] for j in chosen):
            chosen.add(node)
    return chosen
