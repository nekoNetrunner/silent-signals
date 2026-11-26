def check_mis(adj, selected):
    n = len(adj)
    edges = int(adj.sum()) // 2
    independent = all(not adj[i,j] for i in selected for j in selected)
    dominating = all(i in selected or any(adj[i,j] for j in selected) for i in range(n))
    return dict(n=n, edges=edges, mean_degree=2*edges/n if n else None,
                heads=len(selected),density=len(selected)/n if n else None,
                independent=independent, dominating=dominating, valid_mis=independent and dominating)
