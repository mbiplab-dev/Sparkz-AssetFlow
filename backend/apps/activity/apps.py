from django.apps import AppConfig


class ActivityConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.activity"
    label = "activity"
    verbose_name = "Activity Logs"

    def ready(self):
        # Register signal handlers when the app loads.
        from . import signals  # noqa: F401
