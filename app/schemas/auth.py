from typing import Optional
from pydantic import BaseModel, EmailStr
from app.core.enums import UserRole


class UserLogin(BaseModel):
    email: str
    password: str


class UserSignup(BaseModel):
    name: str
    email: str
    password: str
    role: UserRole = UserRole.PLANNER


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    email: str
    role: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
