from .run_all import main
if __name__ == "__main__":
    import sys
    sys.exit(main(["--experiments","4","--data-only", *sys.argv[1:]]))
