from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db
from app.normalize import InvalidIdentifierError
from app.license import license_manager, router as license_router
from app.routes import reports, lookup, map, alerts, admin, challenges


# Initialize Database
init_db()

app = FastAPI(
    title="Community Scam Map for India",
    description="Community Scam Map for India — Report and verify scams in seconds, anonymously.",
    version="1.0.0"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# License Verification Middleware
@app.middleware("http")
async def license_check_middleware(request: Request, call_next):
    path = request.url.path
    # Exempt /health, /license, and docs
    exempt_paths = {
        "/health", "/api/health",
        "/license", "/api/license",
        "/license/status", "/api/license/status",
        "/license/activate", "/api/license/activate",
        "/docs", "/redoc", "/openapi.json"
    }
    if path not in exempt_paths:
        if license_manager.is_expired():
            return JSONResponse(
                status_code=403,
                content={"error": "LICENSE_EXPIRED"}
            )
    return await call_next(request)


# Exception Handlers
@app.exception_handler(InvalidIdentifierError)
def invalid_identifier_exception_handler(request: Request, exc: InvalidIdentifierError):
    return JSONResponse(
        status_code=400,
        content={"error": str(exc)}
    )


@app.exception_handler(ValueError)
def value_error_exception_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"error": str(exc)}
    )


# 1. Health Endpoints (PRD: Reply 200 with {"ok": true})
@app.get("/health", tags=["Health"])
@app.get(f"{settings.API_V1_PREFIX}/health", tags=["Health"])
def health_check():
    return {"ok": True, "status": "healthy", "service": settings.PROJECT_NAME}


# 2. Register Judging Endpoints at root level (as specified in PRD Table A. API rules)
app.include_router(reports.router, tags=["Reports"])
app.include_router(lookup.router, tags=["Lookup"])
app.include_router(map.router, tags=["Map"])
app.include_router(alerts.router, tags=["Alerts"])
app.include_router(admin.router, tags=["Admin"])
app.include_router(challenges.router, tags=["Challenges"])
app.include_router(license_router, tags=["License"])

# 3. Register Judging Endpoints at /api prefix for Developer B and API consumers
app.include_router(reports.router, prefix=settings.API_V1_PREFIX, tags=["Reports (API)"])
app.include_router(lookup.router, prefix=settings.API_V1_PREFIX, tags=["Lookup (API)"])
app.include_router(map.router, prefix=settings.API_V1_PREFIX, tags=["Map (API)"])
app.include_router(alerts.router, prefix=settings.API_V1_PREFIX, tags=["Alerts (API)"])
app.include_router(admin.router, prefix=settings.API_V1_PREFIX, tags=["Admin (API)"])
app.include_router(challenges.router, prefix=settings.API_V1_PREFIX, tags=["Challenges (API)"])
app.include_router(license_router, prefix=settings.API_V1_PREFIX, tags=["License (API)"])
