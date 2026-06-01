from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Load our app settings and models so autogenerate can detect schema
from app.core.config import settings
from app.db.database import Base
import app.models.user       # noqa
import app.models.role       # noqa
import app.models.employee   # noqa
import app.models.project    # noqa
import app.models.attendance # noqa
import app.models.calendar_day  # noqa
import app.models.company    # noqa
import app.models.material   # noqa
import app.models.material_type  # noqa
import app.models.inventory  # noqa
import app.models.supplier   # noqa
import app.models.transaction  # noqa
import app.models.quotation  # noqa
import app.models.setting    # noqa

target_metadata = Base.metadata

DATABASE_URL = (
    f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}"
    f"@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"
)
config.set_main_option("sqlalchemy.url", DATABASE_URL)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
