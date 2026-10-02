from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, schools, users, students, academics, attendance, biometric_adms, finance, exams, live_classes, surveys, transport, hr, ai_analytics
import socketio
from app.core.socket import sio

app = FastAPI(title="SchoolERP API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(schools.router, prefix="/api/v1/schools", tags=["schools"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(students.router, prefix="/api/v1/students", tags=["students"])
app.include_router(academics.router, prefix="/api/v1/academics", tags=["academics"])
app.include_router(attendance.router, prefix="/api/v1/attendance", tags=["attendance"])
app.include_router(finance.router)
app.include_router(exams.router)
app.include_router(live_classes.router)
app.include_router(surveys.router)
app.include_router(transport.router)
app.include_router(hr.router)
app.include_router(ai_analytics.router)
app.include_router(biometric_adms.adms_router, tags=["biometric_adms"])

socket_app = socketio.ASGIApp(sio, app)