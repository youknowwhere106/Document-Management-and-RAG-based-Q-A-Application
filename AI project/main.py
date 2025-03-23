# main.py
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import shutil
import os
from typing import List
import asyncio

from pdf_processor import process_pdfs, get_answer_from_pdfs

app = FastAPI(title="PDF Q&A API", description="API for PDF document question answering using Gemini")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Create uploads directory if it doesn't exist
os.makedirs("uploads", exist_ok=True)

# Store processing status
processing_status = {"status": "idle", "message": ""}

@app.post("/upload-pdfs/")
async def upload_pdfs(background_tasks: BackgroundTasks, files: List[UploadFile] = File(...)):
    """
    Upload multiple PDF files and process them for later Q&A.
    """
    # Validate input
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    
    
    # Validate file types
    for file in files:
        if not file.filename.endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"File {file.filename} is not a PDF")
    
    # Save files to disk
    file_paths = []
    for file in files:
        file_path = f"uploads/{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        file_paths.append(file_path)
    
    # Process PDFs in the background
    global processing_status
    processing_status = {"status": "processing", "message": "Processing PDFs..."}
    
    # Start processing in the background
    background_tasks.add_task(process_pdfs, file_paths, processing_status)
    
    return JSONResponse(
        content={
            "message": "Files uploaded successfully. Processing started.",
            "files": [file.filename for file in files],
            "status": processing_status["status"]
        }
    )

@app.get("/processing-status/")
async def get_processing_status():
    """
    Get the current PDF processing status.
    """
    return processing_status

@app.post("/ask-question/")
async def ask_question(question: str = Form(...)):
    """
    Ask a question about the previously uploaded PDFs.
    """
    if processing_status["status"] != "completed":
        return JSONResponse(
            status_code=400,
            content={
                "message": "PDF processing not completed. Current status: " + processing_status["status"],
                "status": processing_status["status"]
            }
        )
    
    try:
        answer = get_answer_from_pdfs(question)
        return {"question": question, "answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")

@app.get("/")
async def root():
    return {"message": "PDF Q&A API is running. Use /upload-pdfs/ to upload PDFs and /ask-question/ to ask questions."}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)