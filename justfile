venv:
    uv venv
    uv sync --extra dev

format:
    uv run --extra dev ruff format .

lint:
    uv run --extra dev ruff check .

typecheck:
    uv run --extra dev mypy .

check: format lint typecheck

set positional-arguments

run *args:
    uv run python generate_gallery.py "$@"

