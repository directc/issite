from fastapi import FastAPI, HTTPException, Depends
from datetime import datetime
from typing import List
from pydantic import BaseModel
from supabase import create_client, Client
import os
from .auth import get_current_user

app = FastAPI()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class Mine(BaseModel):
    id: int
    name: str
    current_time: int
    max_time: int
    updated_at: datetime

@app.get("/mines", response_model=List[Mine])
async def get_mines():
    # Обновляем таймеры перед возвратом
    await update_mines_timers()
    
    response = supabase.table("mines").select("*").order("id").execute()
    return response.data

@app.put("/mines")
async def update_mines(mines: List[dict], current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admin can update mines")
    
    for mine in mines:
        supabase.table("mines") \
            .update({
                "max_time": mine["max_time"],
                "current_time": mine["max_time"],  # Сбрасываем таймер
                "updated_at": datetime.utcnow().isoformat()
            }) \
            .eq("id", mine["id"]) \
            .execute()
    
    return {"status": "success"}

async def update_mines_timers():
    # Получаем текущие данные
    response = supabase.table("mines").select("*").execute()
    mines = response.data
    
    now = datetime.utcnow()
    updates = []
    
    for mine in mines:
        last_updated = datetime.fromisoformat(mine["updated_at"])
        seconds_passed = (now - last_updated).total_seconds()
        
        current_time = max(0, mine["current_time"] - int(seconds_passed))
        if current_time <= 0:
            current_time = mine["max_time"]
        
        if current_time != mine["current_time"]:
            updates.append({
                "id": mine["id"],
                "current_time": current_time,
                "updated_at": now.isoformat()
            })
    
    # Пакетное обновление
    if updates:
        supabase.table("mines").upsert(updates).execute()
