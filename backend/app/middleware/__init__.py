# -*- coding: utf-8 -*-
"""
Middleware ShieldCloud
"""
from app.middleware.rbac import require_role, require_any_role
from app.middleware.threat_detector import ThreatDetectorMiddleware

__all__ = ['require_role', 'require_any_role', 'ThreatDetectorMiddleware']
