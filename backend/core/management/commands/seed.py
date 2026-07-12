from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from faker import Faker


class Command(BaseCommand):
    help = "Seed the database with fake data."

    def add_arguments(self, parser):
        parser.add_argument("--users", type=int, default=10)

    def handle(self, *args, **options):
        fake = Faker()
        User = get_user_model()

        n_users = options["users"]
        created = 0
        for _ in range(n_users):
            username = fake.unique.user_name()
            email = fake.unique.email()
            User.objects.create_user(username=username, email=email, password="password123")
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Created {created} users."))
