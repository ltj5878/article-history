from datetime import UTC, datetime, timedelta
import os
from uuid import uuid4

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import session_scope
from .models import User

JWT_ALGORITHM = "HS256"
DEFAULT_ACCESS_TOKEN_MINUTES = 30
password_hash = PasswordHash.recommended()
bearer_scheme = HTTPBearer(auto_error=False)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=160)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=160)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    role: str
    is_active: bool = Field(alias="isActive")


class TokenResponse(BaseModel):
    access_token: str = Field(alias="accessToken")
    token_type: str = Field(default="bearer", alias="tokenType")
    expires_in: int = Field(alias="expiresIn")
    user: UserResponse


class DuplicateUserError(ValueError):
    pass


class AuthRepository:
    def __init__(self, session: Session):
        self.session = session

    def create_user(self, email: str, password: str, role: str = "user") -> User:
        user = User(
            id=str(uuid4()),
            email=normalize_email(email),
            password_hash=hash_password(password),
            role=role,
            is_active=True,
        )
        self.session.add(user)
        try:
            self.session.flush()
        except IntegrityError as exc:
            self.session.rollback()
            raise DuplicateUserError("Email already registered") from exc
        return user

    def authenticate(self, email: str, password: str) -> User | None:
        user = self.get_user_by_email(email)
        if not user or not user.is_active:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    def get_user_by_email(self, email: str) -> User | None:
        return self.session.scalar(select(User).where(User.email == normalize_email(email)))

    def get_user(self, user_id: str) -> User | None:
        return self.session.get(User, user_id)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, stored_hash: str) -> bool:
    return password_hash.verify(password, stored_hash)


def create_access_token(user: User, jwt_secret: str, minutes: int = DEFAULT_ACCESS_TOKEN_MINUTES) -> str:
    now = datetime.now(UTC)
    payload = {
        "sub": user.id,
        "role": user.role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=minutes)).timestamp()),
    }
    return jwt.encode(payload, jwt_secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str, jwt_secret: str) -> dict:
    try:
        return jwt.decode(token, jwt_secret, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token") from exc


def resolve_jwt_secret(jwt_secret: str | None = None) -> str:
    secret = jwt_secret or os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is required")
    return secret


def auth_dependencies(db_url: str, jwt_secret: str | None):
    def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> User:
        if not credentials or credentials.scheme.lower() != "bearer":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing authentication token")
        payload = decode_access_token(credentials.credentials, resolve_jwt_secret(jwt_secret))
        user_id = payload.get("sub")
        if not isinstance(user_id, str):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")
        with session_scope(db_url) as session:
            user = AuthRepository(session).get_user(user_id)
            if not user or not user.is_active:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token")
            session.expunge(user)
            return user

    def require_admin(user: User = Depends(get_current_user)) -> User:
        if user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin role required")
        return user

    return get_current_user, require_admin


def to_user_response(user: User) -> UserResponse:
    return UserResponse(id=user.id, email=user.email, role=user.role, isActive=user.is_active)
