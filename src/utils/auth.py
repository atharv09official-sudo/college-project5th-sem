import hashlib
import datetime
from typing import Optional

from .database import get_connection, init_db


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def create_user(name: str, email: str, password: str, role: str = "planner") -> int:
    init_db()
    password_hash = _hash_password(password)
    created_at = datetime.datetime.utcnow().isoformat()
    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO users (name, email, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, email, password_hash, role, created_at),
        )
        connection.commit()
        return int(cursor.lastrowid)


def authenticate(email: str, password: str) -> Optional[dict]:
    init_db()
    password_hash = _hash_password(password)
    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT user_id, name, email, role, created_at
            FROM users
            WHERE email = ? AND password_hash = ?
            """,
            (email, password_hash),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return {
            "user_id": row["user_id"],
            "name": row["name"],
            "email": row["email"],
            "role": row["role"],
            "created_at": row["created_at"],
        }


def get_user_by_id(user_id: int) -> Optional[dict]:
    init_db()
    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT user_id, name, email, role, created_at
            FROM users
            WHERE user_id = ?
            """,
            (user_id,),
        )
        row = cursor.fetchone()
        if row is None:
            return None
        return {
            "user_id": row["user_id"],
            "name": row["name"],
            "email": row["email"],
            "role": row["role"],
            "created_at": row["created_at"],
        }


if __name__ == "__main__":
    pass

