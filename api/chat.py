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

class ChatMessage(BaseModel):
    id: int
    sender_id: str
    username: str
    message: str
    created_at: datetime

@app.get("/chat", response_model=List[ChatMessage])
async def get_chat_messages(limit: int = 50):
    response = supabase.table("chat_messages") \
        .select("id, message, created_at, user:users(username)") \
        .order("created_at", desc=True) \
        .limit(limit) \
        .execute()
    
    messages = []
    for msg in reversed(response.data):
        messages.append({
            "id": msg["id"],
            "sender_id": msg["user"]["id"],
            "username": msg["user"]["username"],
            "message": msg["message"],
            "created_at": msg["created_at"]
        })
    
    return messages

@app.post("/chat")
async def create_chat_message(message: str, current_user: User = Depends(get_current_user)):
    response = supabase.table("chat_messages") \
        .insert({
            "sender_id": current_user.id,
            "message": message
        }) \
        .execute()
    
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to send message")
    
    return {"status": "success"}
