"""Windows entry point. Each experiment owns its output, including partial runs."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument("--out", type=Path)
    parser.add_argument("--experiments", nargs="+", type=int, default=list(range(1, 8)))
    parser.add_argument("--data-only", action="store_true")
    parser.add_argument("--plots-only", action="store_true")
    parser.add_argument("--workers", type=int, default=3)
    args = parser.parse_args(argv)
    out = (args.out or (ROOT / "smoke" if args.smoke else ROOT)).resolve()
    node = os.environ.get("NODE_EXE") or shutil.which("node")
    if not node and not args.plots_only:
        parser.error("Install Node.js 24 or set NODE_EXE to node.exe")
    def run(exp):
        cmd = [node, str(ROOT / "experiments/batch.js"), str(exp), str(out)]
        if args.smoke:
            cmd.append("--smoke")
        subprocess.run(cmd, check=True)
    try:
        if not args.plots_only:
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                list(pool.map(run, args.experiments))
        if not args.data_only:
            from .figures import plot
            plot(out)
    except subprocess.CalledProcessError as exc:
        return exc.returncode
    return 0

if __name__ == "__main__":
    sys.exit(main())
