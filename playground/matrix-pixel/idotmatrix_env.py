from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional


def load_dotenv(path: str | Path, *, override: bool = False) -> None:
    """
    Minimal .env loader:
    - KEY=VALUE pairs
    - ignores blank lines and lines starting with '#'
    - strips optional surrounding single/double quotes on VALUE
    """
    p = Path(path)
    if not p.exists() or not p.is_file():
        return

    for raw_line in p.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not key:
            continue
        if not override and key in os.environ:
            continue
        if len(value) >= 2 and ((value[0] == value[-1] == '"') or (value[0] == value[-1] == "'")):
            value = value[1:-1]
        os.environ[key] = value


def load_local_env(*, override: bool = False) -> None:
    """
    Loads a `.env` file next to the calling script, if present.
    Existing environment variables take precedence by default.
    """
    main_file = getattr(sys.modules.get("__main__"), "__file__", None)
    if not main_file:
        return
    env_path = Path(main_file).resolve().parent / ".env"
    load_dotenv(env_path, override=override)


def platform_key() -> str:
    if sys.platform == "darwin":
        return "DARWIN"
    if sys.platform.startswith("linux"):
        return "LINUX"
    if sys.platform.startswith(("win32", "cygwin")):
        return "WINDOWS"
    return sys.platform.upper()


def resolve_address(cli_address: Optional[str] = None) -> Optional[str]:
    """
    Address resolution order:
    1) CLI-provided address (if any)
    2) IDOTMATRIX_ADDRESS_<PLATFORM> (e.g. ..._DARWIN / ..._LINUX)
    3) IDOTMATRIX_ADDRESS
    4) None (caller can fall back to connectBySearch)
    """
    if cli_address:
        return cli_address

    plat = platform_key()
    return os.environ.get(f"IDOTMATRIX_ADDRESS_{plat}") or os.environ.get("IDOTMATRIX_ADDRESS")

