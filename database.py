"""
Database Configuration Module — SQLAlchemy connection setup.
(This is the foundation that ALL other modules use to talk to PostgreSQL)

PURPOSE:
    Sets up the PostgreSQL database connection using SQLAlchemy ORM.
    Every module in the project imports SessionLocal from this file
    to create database sessions for reading/writing data.

HOW IT WORKS:
    1. Loads environment variables from .env file
    2. Builds the database connection URL (supports both cloud-style DATABASE_URL
       and individual DB_USER/DB_PASS/etc variables)
    3. Creates a SQLAlchemy engine with connection pooling
    4. Creates a session factory (SessionLocal) that other modules use

CONNECTION POOLING:
    The engine maintains a pool of database connections so we don't have to
    open a new connection every time we need to query the database. This is
    critical for production performance.
    - pool_size=10: Keep 10 connections ready at all times
    - max_overflow=20: Allow up to 20 extra connections during peak load
    - pool_pre_ping=True: Check if a connection is alive before using it
    - pool_recycle=300: Replace connections every 5 minutes to avoid stale ones

USAGE IN OTHER MODULES:
    from database import SessionLocal, Base, engine
    
    session = SessionLocal()
    try:
        # do stuff with session
        session.commit()
    finally:
        session.close()
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

# Step 1: Load environment variables from .env file
# (Contains DATABASE_URL, DB_USER, DB_PASS, etc.)
load_dotenv()

# Step 2: Build the database connection URL
# (Supports two formats for flexibility)
# Format A: Single DATABASE_URL (used by cloud platforms like Heroku, Railway)
#   Example: postgresql://user:pass@host:5432/dbname
# Format B: Individual variables (used for local development)
#   DB_USER, DB_PASS, DB_HOST, DB_PORT, DB_NAME
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASS = os.getenv("DB_PASS", "")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "quant_db")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Step 3: Create the SQLAlchemy engine with connection pooling
# (This is the main database connection object — shared across all modules)
engine = create_engine(
    DATABASE_URL,
    pool_size=10,         # Keep 10 connections ready at all times
    max_overflow=20,      # Allow up to 20 extra connections during peak load
    pool_pre_ping=True,   # Verify connections are alive before using them
    pool_recycle=300,     # Recycle connections every 5 min to avoid stale connections
)

# Step 4: Create the session factory
# (Other modules call SessionLocal() to get a new database session)
# autocommit=False: We manually call session.commit() when we want to save
# autoflush=False: We manually control when data gets flushed to the DB
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Step 5: Create the declarative base class
# (All database table models inherit from this — see init_db.py)
Base = declarative_base()