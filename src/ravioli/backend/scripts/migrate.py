from ravioli.backend.main import init_db
import os
import sys

# Add src to sys.path
sys.path.append(os.path.join(os.getcwd(), "src"))

if __name__ == "__main__":
    init_db()
