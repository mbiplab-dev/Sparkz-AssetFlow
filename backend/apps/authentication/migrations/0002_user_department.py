import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0001_initial"),
        ("organization", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="department",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="employees",
                to="organization.department",
            ),
        ),
    ]
