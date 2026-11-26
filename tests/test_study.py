import os
import subprocess
from pathlib import Path
from src.topologies import make_topology
from src.protocols.centralized import greedy_mis
from src.verify import check_mis

ROOT=Path(__file__).resolve().parents[1]
def test_independent_python_grid():
    adj,_=make_topology("grid",side=20)
    assert check_mis(adj,greedy_mis(adj))==dict(n=400,edges=760,mean_degree=3.8,heads=182,density=.455,independent=True,dominating=True,valid_mis=True)

def test_shared_engine():
    subprocess.run([os.environ.get("NODE_EXE","node"),str(ROOT/"tests/checks.js")],check=True)

