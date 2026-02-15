# -*- coding: utf-8 -*-
"""
API Routes ShieldCloud
"""
from app.routes.auth import auth_bp
from app.routes.files import files_bp
from app.routes.audit import audit_bp
from app.routes.threats import threats_bp
from app.routes.users import users_bp

__all__ = ['auth_bp', 'files_bp', 'audit_bp', 'threats_bp', 'users_bp']
