"""Write activity events to the DB and mirror them to a local log file."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from django.conf import settings

from .models import ActivityLog

# Dedicated logger — configured in settings to write backend/logs/activity.log
activity_file_logger = logging.getLogger("assetflow.activity")


def _default_log_path() -> Path:
    return Path(settings.BASE_DIR) / "logs" / "activity.log"


def log_activity(
    *,
    action: str,
    message: str,
    actor=None,
    entity_type: str = "",
    entity_id: Any = "",
    before_data: dict | None = None,
    after_data: dict | None = None,
    ip_addr: str | None = None,
) -> ActivityLog:
    """Persist an activity log row and mirror it to the file logger."""
    entity_id_str = "" if entity_id is None or entity_id == "" else str(entity_id)

    row = ActivityLog.objects.create(
        actor=actor if actor is not None and getattr(actor, "is_authenticated", True) else None,
        action=action,
        entity_type=entity_type or "",
        entity_id=entity_id_str,
        message=message,
        before_data=before_data,
        after_data=after_data,
        ip_addr=ip_addr,
    )

    payload = {
        "id": row.id,
        "action": action,
        "message": message,
        "entity_type": entity_type,
        "entity_id": entity_id_str,
        "actor_id": getattr(actor, "pk", None),
        "actor_email": getattr(actor, "email", None),
        "before_data": before_data,
        "after_data": after_data,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }
    activity_file_logger.info(json.dumps(payload, default=str))
    return row
