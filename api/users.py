from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from supabase import create_client, Client
import os
from .auth import get_current_user, get_password_hash

app = FastAPI()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class UserCreate(BaseModel):
    username: str
    password: str

@app.post("/users")
async def create_user(user: UserCreate, current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admin can create users")
    
    # Проверяем, существует ли пользователь
    existing = supabase.table("users") \
        .select("username") \
        .eq("username", user.username) \
        .execute()
    
    if existing.data:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Создаем нового пользователя
    response = supabase.table("users") \
        .insert({
            "username": user.username,
            "password_hash": get_password_hash(user.password),
            "is_admin": False
        }) \
        .execute()
    
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to create user")
    
    return {"status": "success"}
