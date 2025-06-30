import os

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "f74ywpTMsjQXGVQ8FDznD3z")
    DB_NAME = os.getenv("DB_NAME", "users.db")
    SESSION_TYPE = "filesystem"
    SESSION_PERMANENT = True
    PERMANENT_SESSION_LIFETIME = 1800  # in seconds