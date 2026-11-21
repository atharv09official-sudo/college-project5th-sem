import os
from typing import Any, Dict, Iterable, List, Optional, Set


def _normalize_root(root: str) -> str:
    return os.path.abspath(os.path.normpath(root))


def _is_probably_text(data: bytes) -> bool:
    if not data:
        return True
    if b"\0" in data:
        return False
    text_bytes = 0
    for b in data:
        if b in (9, 10, 13):
            text_bytes += 1
        elif 32 <= b <= 126:
            text_bytes += 1
    return text_bytes / len(data) >= 0.7


def process_file(path: str, max_size: int = 10_000_000, max_read: int = 1_000_000) -> Dict[str, Any]:
    result: Dict[str, Any] = {"path": path}
    try:
        stat_result = os.stat(path)
        size = stat_result.st_size
        result["size"] = size
        result["modified"] = stat_result.st_mtime
    except OSError as exc:
        result["error"] = str(exc)
        return result

    if size > max_size:
        result["skipped"] = True
        result["reason"] = "file_too_large"
        return result

    try:
        with open(path, "rb") as handle:
            head = handle.read(min(4096, max_read))
            is_text = _is_probably_text(head)
            result["is_text"] = is_text
            if not is_text or max_read <= len(head):
                return result

            chunks: List[bytes] = [head]
            remaining = min(size, max_read) - len(head)
            chunk_size = 65536
            while remaining > 0:
                to_read = min(chunk_size, remaining)
                chunk = handle.read(to_read)
                if not chunk:
                    break
                chunks.append(chunk)
                remaining -= len(chunk)

            data = b"".join(chunks)
            if not data:
                result["line_count"] = 0
                return result
            line_count = data.count(b"\n")
            if data and not data.endswith(b"\n"):
                line_count += 1
            result["line_count"] = line_count
    except OSError as exc:
        result["error"] = str(exc)

    return result


def scan_directory(
    root: str,
    ignore_dirs: Optional[Iterable[str]] = None,
    max_file_size: int = 10_000_000,
    max_bytes_per_file: int = 1_000_000,
) -> Dict[str, Any]:
    base = _normalize_root(root)
    if ignore_dirs is None:
        ignore: Set[str] = {
            ".git",
            ".trae",
            "__pycache__",
            "node_modules",
            ".venv",
            "venv",
        }
    else:
        ignore = set(ignore_dirs)

    visited: Set[str] = set()
    files: List[Dict[str, Any]] = []
    errors: List[Dict[str, Any]] = []

    stack: List[str] = [base]

    while stack:
        current = stack.pop()
        try:
            real = os.path.realpath(current)
        except OSError as exc:
            errors.append({"path": current, "error": str(exc)})
            continue

        if real in visited:
            continue
        visited.add(real)

        try:
            with os.scandir(current) as iterator:
                for entry in iterator:
                    name = entry.name
                    path = entry.path
                    try:
                        if entry.is_dir(follow_symlinks=False):
                            if name in ignore:
                                continue
                            stack.append(path)
                        elif entry.is_file(follow_symlinks=False):
                            info = process_file(path, max_file_size, max_bytes_per_file)
                            files.append(info)
                    except OSError as exc:
                        errors.append({"path": path, "error": str(exc)})
        except OSError as exc:
            errors.append({"path": current, "error": str(exc)})

    total = len(files)
    skipped = sum(1 for f in files if f.get("skipped"))
    error_entries = len(errors) + sum(1 for f in files if "error" in f)

    return {
        "root": base,
        "total_files": total,
        "skipped_files": skipped,
        "error_entries": error_entries,
        "files": files,
        "errors": errors,
    }


def scan_project_root(
    max_file_size: int = 10_000_000,
    max_bytes_per_file: int = 1_000_000,
) -> Dict[str, Any]:
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(os.path.dirname(here))
    return scan_directory(root, max_file_size=max_file_size, max_bytes_per_file=max_bytes_per_file)
